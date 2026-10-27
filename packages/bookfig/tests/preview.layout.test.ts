import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB = "http://127.0.0.1:43173";
const EXAMPLES = ["01", "02", "03"] as const;

let desktop: Browser | undefined;
let mobile: Browser | undefined;
let started: ChildProcess | undefined;

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

async function launchPref(first: typeof chromium, second: typeof chromium): Promise<Browser> {
  try {
    return await first.launch({ headless: true });
  } catch {
    return second.launch({ headless: true });
  }
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
  desktop = await launchPref(chromium, webkit);
  mobile = await launchPref(webkit, chromium);
});

afterAll(async () => {
  await desktop?.close();
  await mobile?.close();
  if (started?.pid) started.kill("SIGTERM");
});

type LabelMetric = {
  text: string;
  overflowX: boolean;
  hasBox: boolean;
  font: string;
  fontOk: boolean;
};

type PageMetrics = {
  labels: LabelMetric[];
  previewScrollW: number;
  previewClientW: number;
  pageScrollW: number;
  innerW: number;
  scale: number | null;
  scaleText: string;
  svgInPreview: boolean;
  fontsReady: boolean;
  fontFamily: string;
};

async function waitReady(page: Page): Promise<void> {
  await page.waitForSelector(".preview svg", { timeout: 30_000 });
  await page.waitForFunction(async () => {
    await document.fonts.ready;
    const svg = document.querySelector<SVGSVGElement>("[data-testid='preview'] svg");
    const scale = document.querySelector("[data-testid='preview-scale']")?.textContent ?? "";
    return Boolean(svg && svg.dataset.fitApplied === "1" && /scale /.test(scale));
  });
}

async function loadExample(page: Page, id: string): Promise<void> {
  await page.locator(".examples button", { hasText: id }).click();
  await waitReady(page);
}

async function measurePage(page: Page): Promise<PageMetrics> {
  await waitReady(page);
  return page.evaluate(async () => {
    await document.fonts.ready;
    const preview = document.querySelector("[data-testid='preview']");
    const svg = preview?.querySelector("svg");
    if (!preview || !svg) {
      return {
        labels: [],
        previewScrollW: 0,
        previewClientW: 0,
        pageScrollW: 0,
        innerW: 0,
        scale: null,
        scaleText: "",
        svgInPreview: false,
        fontsReady: false,
        fontFamily: "",
      };
    }
    const boxes = [...svg.querySelectorAll("rect, path, circle")]
      .map((el) => {
        try {
          return (el as SVGGraphicsElement).getBBox();
        } catch {
          return null;
        }
      })
      .filter((b): b is DOMRect => Boolean(b && b.width > 8 && b.height > 8))
      .filter((b) => b.width < svg.viewBox.baseVal.width * 0.85 || b.height < svg.viewBox.baseVal.height * 0.85);
    const labels = [...svg.querySelectorAll("text")].map((t) => {
      const tb = t.getBBox();
      const cs = getComputedStyle(t);
      const hit = boxes
        .filter(
          (b) =>
            tb.x + tb.width / 2 >= b.x - 2 &&
            tb.x + tb.width / 2 <= b.x + b.width + 2 &&
            tb.y + tb.height / 2 >= b.y - 2 &&
            tb.y + tb.height / 2 <= b.y + b.height + 2,
        )
        .sort((a, b) => a.width * a.height - b.width * b.height)[0];
      const overflowX = hit
        ? tb.x < hit.x - 2 || tb.x + tb.width > hit.x + hit.width + 2
        : true;
      return {
        text: t.textContent ?? "",
        overflowX,
        hasBox: Boolean(hit),
        font: cs.fontFamily,
        fontOk: document.fonts.check(`${cs.fontSize} "Noto Sans Mono"`),
      };
    });
    const pb = preview.getBoundingClientRect();
    const sb = svg.getBoundingClientRect();
    const scaleText = document.querySelector("[data-testid='preview-scale']")?.textContent ?? "";
    const m = /scale ([\d.]+)/.exec(scaleText);
    const first = svg.querySelector("text");
    return {
      labels,
      previewScrollW: preview.scrollWidth,
      previewClientW: preview.clientWidth,
      pageScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      scale: m ? Number(m[1]) : null,
      scaleText,
      svgInPreview:
        sb.left >= pb.left - 2 &&
        sb.right <= pb.right + 2 &&
        sb.top >= pb.top - 2 &&
        sb.bottom <= pb.bottom + 2,
      fontsReady: document.fonts.status === "loaded",
      fontFamily: first ? getComputedStyle(first).fontFamily : "",
    };
  });
}

function expectLabels(m: PageMetrics): void {
  expect(m.fontsReady).toBe(true);
  expect(m.fontFamily).toMatch(/Noto Sans Mono/);
  expect(m.labels.length).toBeGreaterThan(0);
  for (const lab of m.labels) {
    if (!lab.text.trim()) continue;
    expect(lab.hasBox, lab.text).toBe(true);
    expect(lab.overflowX, lab.text).toBe(false);
    expect(lab.font, lab.text).toMatch(/Noto Sans Mono/);
    expect(lab.fontOk, lab.text).toBe(true);
  }
  expect(m.previewScrollW).toBeLessThanOrEqual(m.previewClientW + 1);
  expect(m.pageScrollW).toBeLessThanOrEqual(m.innerW + 1);
  expect(m.svgInPreview).toBe(true);
}

async function openDesktop(): Promise<Page> {
  if (!desktop) throw new Error("desktop browser missing");
  const page = await desktop.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30_000);
  await page.goto(WEB, { waitUntil: "domcontentloaded" });
  await waitReady(page);
  return page;
}

async function openMobile(): Promise<Page> {
  if (!mobile) throw new Error("mobile browser missing");
  const page = await mobile.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(30_000);
  await page.goto(WEB, { waitUntil: "domcontentloaded" });
  await waitReady(page);
  return page;
}

test("1440 desktop Fit keeps 01/02/03 in the panel with the bundled font", { timeout: 90_000 }, async () => {
  const page = await openDesktop();
  try {
    for (const id of EXAMPLES) {
      await loadExample(page, id);
      const m = await measurePage(page);
      expectLabels(m);
      expect(m.scale, id).not.toBeNull();
      if (id === "01" || id === "02") expect(m.scale ?? 1, id).toBeLessThan(1);
      expect(m.scale ?? 1, id).toBeLessThanOrEqual(1);
      expect(m.scaleText).toMatch(/scale /);
    }
  } finally {
    await page.close();
  }
});

test("390 WebKit Fit keeps 01/02/03 labels inside boxes", { timeout: 90_000 }, async () => {
  const page = await openMobile();
  try {
    for (const id of EXAMPLES) {
      await loadExample(page, id);
      const m = await measurePage(page);
      expectLabels(m);
      expect(m.scale ?? 1, id).toBeLessThanOrEqual(1);
    }
  } finally {
    await page.close();
  }
});
