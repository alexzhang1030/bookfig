import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB = "http://127.0.0.1:43173";
const VW = 390;
const VH = 844;

type Box = { x: number; y: number; width: number; height: number };

let browser: Browser | undefined;
let started: ChildProcess | undefined;

function overlaps(a: Box, b: Box, slop = 1): boolean {
  return !(
    a.x + a.width <= b.x + slop ||
    b.x + b.width <= a.x + slop ||
    a.y + a.height <= b.y + slop ||
    b.y + b.height <= a.y + slop
  );
}

function withinViewport(box: Box, vw: number, vh: number, slop = 1): boolean {
  return (
    box.x >= -slop &&
    box.y >= -slop &&
    box.x + box.width <= vw + slop &&
    box.y + box.height <= vh + slop
  );
}

async function webUp(): Promise<boolean> {
  try {
    const res = await fetch(WEB, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForWeb(timeoutMs: number): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await webUp()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Nuxt preview did not start on ${WEB}`);
}

async function launchBrowser(): Promise<Browser> {
  const errors: string[] = [];
  for (const [name, launcher] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ] as const) {
    try {
      return await launcher.launch({ headless: true });
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Playwright browsers missing (${errors.join(" | ")})`);
}

beforeAll(async () => {
  if (!(await webUp())) {
    started = spawn("pnpm", ["--filter", "web", "dev"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NUXT_TELEMETRY_DISABLED: "1" },
    });
    await waitForWeb(80_000);
  }
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
  if (started?.pid) started.kill("SIGTERM");
});

async function openMobile(): Promise<Page> {
  if (!browser) throw new Error("browser missing");
  const page = await browser.newPage({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(30_000);
  await page.goto(WEB, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".preview svg, [data-testid='preview'] svg", { timeout: 30_000 });
  return page;
}

async function measureFit(page: Page): Promise<{ svgW: number; previewW: number }> {
  await page.getByTestId("zoom-fit").click();
  await page.waitForFunction(() => {
    const preview = document.querySelector("[data-testid='preview']");
    const svg = preview?.querySelector("svg");
    if (!preview || !svg) return false;
    const previewW = preview.getBoundingClientRect().width;
    const svgW = svg.getBoundingClientRect().width;
    return previewW > 0 && svgW > previewW * 0.8 && svgW <= previewW + 1;
  });
  return page.evaluate(() => {
    const preview = document.querySelector("[data-testid='preview']");
    const svg = preview?.querySelector("svg");
    return {
      svgW: svg?.getBoundingClientRect().width ?? 0,
      previewW: preview?.getBoundingClientRect().width ?? 0,
    };
  });
}

function expectFit(m: { svgW: number; previewW: number }): void {
  expect(m.previewW).toBeGreaterThan(80);
  expect(m.svgW).toBeLessThanOrEqual(m.previewW + 1);
  expect(m.svgW).toBeGreaterThan(m.previewW * 0.8);
}

test("390-wide mobile chrome stays in viewport and export works", { timeout: 60_000 }, async () => {
  const page = await openMobile();
  try {
    await page.locator(".examples button", { hasText: "02" }).click();
    await page.waitForSelector(".preview svg");
    const metrics = await page.evaluate(() => {
      const vw = window.innerWidth;
      const scrollW = document.documentElement.scrollWidth;
      const editor = document.querySelector("textarea.editor");
      const font = editor ? getComputedStyle(editor).fontSize : "";
      const han = editor ? /[\u4e00-\u9fff]/.test((editor as HTMLTextAreaElement).value) : true;
      return {
        vw,
        scrollW,
        viewport: document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? "",
        font,
        han,
      };
    });
    expect(metrics.vw).toBe(VW);
    expect(metrics.scrollW).toBeLessThanOrEqual(VW + 1);
    expect(metrics.viewport).toContain("viewport-fit=cover");
    expect(Number.parseFloat(metrics.font)).toBeGreaterThanOrEqual(16);
    expect(metrics.han).toBe(false);

    const editor = await page.getByTestId("editor-pane").boundingBox();
    const preview = await page.getByTestId("preview-pane").boundingBox();
    const toolbar = await page.getByTestId("toolbar").boundingBox();
    const exportSvg = page.getByTestId("export-svg");
    const exportPng = page.getByTestId("export-png");
    const svgBox = await exportSvg.boundingBox();
    const pngBox = await exportPng.boundingBox();
    const chips = page.locator(".controls button");
    const chipCount = await chips.count();
    const chipBoxes: Box[] = [];
    for (let i = 0; i < chipCount; i++) {
      const box = await chips.nth(i).boundingBox();
      if (box) chipBoxes.push(box);
    }

    expect(editor).toBeTruthy();
    expect(preview).toBeTruthy();
    expect(toolbar).toBeTruthy();
    expect(svgBox).toBeTruthy();
    expect(pngBox).toBeTruthy();
    if (!editor || !preview || !toolbar || !svgBox || !pngBox) return;

    expect(overlaps(editor, preview)).toBe(false);
    expect(overlaps(editor, toolbar)).toBe(false);
    expect(overlaps(preview, toolbar)).toBe(false);
    expect(overlaps(svgBox, pngBox)).toBe(false);
    for (const box of [editor, preview, toolbar, svgBox, pngBox, ...chipBoxes]) {
      expect(withinViewport(box, VW, VH)).toBe(true);
    }
    for (let i = 0; i < chipBoxes.length; i++) {
      for (let j = i + 1; j < chipBoxes.length; j++) {
        const a = chipBoxes[i];
        const b = chipBoxes[j];
        if (a && b) expect(overlaps(a, b)).toBe(false);
      }
    }

    expect(await exportSvg.isEnabled()).toBe(true);
    expect(await exportPng.isEnabled()).toBe(true);
    await exportSvg.click();
    expect(await exportSvg.isEnabled()).toBe(true);
  } finally {
    await page.close();
  }
});

test(
  "390 Fit mode scales the default and wide figures to the preview width",
  { timeout: 60_000 },
  async () => {
    const page = await openMobile();
    try {
      expectFit(await measureFit(page));
      await page.locator(".examples button", { hasText: "02" }).click();
      await page.waitForSelector(".preview svg");
      expectFit(await measureFit(page));
      const scale = await page.getByTestId("preview-scale").innerText();
      expect(scale).toMatch(/scale 0\.\d{2}/);
    } finally {
      await page.close();
    }
  },
);

test(
  "390 editor sits above the dashed rule and shows whole lines",
  { timeout: 60_000 },
  async () => {
    const page = await openMobile();
    try {
      const editor = page.getByTestId("editor");
      const rest = await editor.evaluate((el) => {
        const cs = getComputedStyle(el);
        const pane = document.querySelector("[data-testid='editor-pane']");
        if (!pane) return null;
        const ta = el.getBoundingClientRect();
        const pb = pane.getBoundingClientRect();
        const border = Number.parseFloat(getComputedStyle(pane).borderBottomWidth);
        const lh = Number.parseFloat(cs.lineHeight);
        const padT = Number.parseFloat(cs.paddingTop);
        const padB = Number.parseFloat(cs.paddingBottom);
        const content = ta.height - padT - padB;
        return {
          h: ta.height,
          gap: pb.bottom - border - ta.bottom,
          lines: lh > 0 ? content / lh : 0,
        };
      });
      expect(rest).toBeTruthy();
      if (!rest) return;
      expect(rest.h).toBeLessThan(140);
      expect(rest.gap).toBeGreaterThanOrEqual(8);
      expect(Math.abs(rest.lines - Math.round(rest.lines))).toBeLessThan(0.15);
      expect(Math.round(rest.lines)).toBeGreaterThanOrEqual(2);
      await editor.focus();
      const open = await editor.evaluate((el) => el.getBoundingClientRect().height);
      expect(open).toBeGreaterThanOrEqual(VH * 0.5 - 2);
      await page.getByTestId("preview").click();
      const after = await editor.evaluate((el) => el.getBoundingClientRect().height);
      expect(after).toBeLessThan(140);
    } finally {
      await page.close();
    }
  },
);

test(
  "390 Fit crops small figures so a node is at least 60px wide",
  { timeout: 60_000 },
  async () => {
    const page = await openMobile();
    try {
      await page.getByTestId("editor").fill('flowchart TD\n    A["area $x^2$"] --> B["plain"]');
      await page.waitForFunction(() =>
        Boolean(document.querySelector("[data-testid='preview'] svg [data-tex='x^2']")),
      );
      await page.getByTestId("zoom-fit").click();
      await page.waitForFunction(() => {
        const svg = document.querySelector<SVGSVGElement>("[data-testid='preview'] svg");
        return Boolean(
          svg?.dataset.fitApplied === "1" || (svg && svg.viewBox.baseVal.width < 1200),
        );
      });
      const small = await page.evaluate(() => {
        const preview = document.querySelector("[data-testid='preview']");
        const svg = preview?.querySelector("svg");
        const nodes = [...(svg?.querySelectorAll("path") ?? [])].filter((p) => {
          const d = p.getAttribute("d") ?? "";
          return /h-?[0-9.]+\s+v-?[0-9.]+/.test(d) && d.includes("Z");
        });
        const widths = nodes.map((n) => n.getBoundingClientRect().width);
        return {
          nodeW: widths.length ? Math.max(...widths) : 0,
          svgW: svg?.getBoundingClientRect().width ?? 0,
          previewW: preview?.getBoundingClientRect().width ?? 0,
          viewW: svg?.viewBox.baseVal.width ?? 0,
          origW: Number(svg?.getAttribute("width") ?? 0),
          scale: document.querySelector("[data-testid='preview-scale']")?.textContent ?? "",
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
        };
      });
      expect(small.nodeW).toBeGreaterThanOrEqual(60);
      expect(small.svgW).toBeLessThanOrEqual(small.previewW + 1);
      expect(small.scrollW).toBeLessThanOrEqual(small.innerW + 1);
      expect(small.viewW).toBeLessThan(1600);

      await page.locator(".examples button", { hasText: "01" }).click();
      await page.waitForSelector(".preview svg");
      expectFit(await measureFit(page));
      const big = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      }));
      expect(big.scrollW).toBeLessThanOrEqual(big.innerW + 1);
    } finally {
      await page.close();
    }
  },
);

test("area $x^2$ keeps a space-sized gap after AREA", { timeout: 60_000 }, async () => {
  const page = await openMobile();
  try {
    await page.getByTestId("editor").fill('flowchart TD\n    A["area $x^2$"] --> B["plain"]');
    await page.waitForFunction(() =>
      Boolean(document.querySelector("[data-testid='preview'] svg [data-tex='x^2']")),
    );
    await page.getByTestId("zoom-fit").click();
    const measured = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>("[data-testid='preview'] svg");
      if (!svg) return null;
      const area = [...svg.querySelectorAll("text")].find((t) =>
        (t.textContent ?? "").includes("AREA"),
      );
      const math = svg.querySelector('[data-tex="x^2"]');
      if (!area || !math) return null;
      const raw = area.textContent ?? "";
      const letters = raw.trimEnd();
      const x = Number(area.getAttribute("x") ?? 0);
      const fs = Number(area.getAttribute("font-size") ?? 30);
      const ls = Number(area.getAttribute("letter-spacing") ?? 2);
      let wordW = 0;
      let n = 0;
      for (const _ch of letters) {
        wordW += fs * 0.5 + (n ? ls : 0);
        n += 1;
      }
      const space = fs * 0.5 + ls;
      const tr = math.parentElement?.getAttribute("transform") ?? "";
      const mathX = Number(/translate\((-?[\d.]+)/.exec(tr)?.[1] ?? 0);
      return { gap: mathX - (x + wordW), space, raw };
    });
    expect(measured?.raw?.endsWith(" ")).toBe(true);
    expect(measured).toBeTruthy();
    if (!measured) return;
    expect(measured.gap).toBeGreaterThan(0);
    expect(measured.gap).toBeGreaterThan(measured.space * 0.5);
    expect(measured.gap).toBeLessThan(measured.space * 3);
  } finally {
    await page.close();
  }
});
