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
