import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { ensureWeb, WEB } from "./web-harness.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900, screenshot: "topbar_1440.png", mobile: false },
  { name: "390x844", width: 390, height: 844, screenshot: "topbar_390.png", mobile: true },
] as const;

const ICON_PATHS = [
  "/favicon.ico",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/site.webmanifest",
] as const;

const HEAD_LINKS = [
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
] as const;

type Box = { x: number; y: number; width: number; height: number };

type LogoMetrics = {
  viewport: string;
  innerWidth: number;
  innerHeight: number;
  scrollWidth: number;
  logo: {
    naturalWidth: number;
    naturalHeight: number;
    height: number;
    width: number;
    x: number;
    y: number;
    right: number;
    bottom: number;
  };
  toolbar: Box;
  logoInsideToolbar: boolean;
  logoInsideViewport: boolean;
  overlapCount: number;
};

let browser: Browser | undefined;

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
  await ensureWeb();
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

async function openPage(width: number, height: number, mobile: boolean): Promise<Page> {
  if (!browser) throw new Error("browser missing");
  await ensureWeb();
  const page = await browser.newPage({
    viewport: { width, height },
    ...(mobile ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}),
  });
  page.setDefaultTimeout(30_000);
  await page.goto(WEB, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>(
      '[data-testid="toolbar"] img[alt="bookfig"]',
    );
    return Boolean(img && img.complete && img.naturalWidth > 0);
  });
  return page;
}

test("top-bar logo and icon set at 1440 and 390", { timeout: 90_000 }, async () => {
  const measured: Record<string, LogoMetrics> = {};

  for (const vp of VIEWPORTS) {
    const page = await openPage(vp.width, vp.height, vp.mobile);
    try {
      for (const path of ICON_PATHS) {
        const res = await page.request.get(`${WEB}${path}`);
        expect(res.status(), path).toBe(200);
      }

      const head = await page.evaluate((want) => {
        return want.map((link) => {
          const rel = `link[rel="${link.rel}"][href="${link.href}"]`;
          const extra =
            "sizes" in link
              ? `${rel}[sizes="${link.sizes}"]`
              : "type" in link
                ? `${rel}[type="${link.type}"]`
                : rel;
          return { href: link.href, exists: Boolean(document.querySelector(extra)) };
        });
      }, HEAD_LINKS);
      for (const tag of head) {
        expect(tag.exists, tag.href).toBe(true);
      }

      const metrics = await page.evaluate((viewport) => {
        const toolbar = document.querySelector<HTMLElement>('[data-testid="toolbar"]');
        const logo = toolbar?.querySelector<HTMLImageElement>('img[alt="bookfig"]');
        if (!toolbar || !logo) {
          throw new Error("toolbar logo missing");
        }
        const logoBox = logo.getBoundingClientRect();
        const barBox = toolbar.getBoundingClientRect();
        const others = [...toolbar.querySelectorAll<HTMLElement>("*")].filter(
          (el) => el !== logo && !el.contains(logo) && !logo.contains(el),
        );
        const overlapCount = others.filter((el) => {
          const b = el.getBoundingClientRect();
          if (b.width <= 0 || b.height <= 0) return false;
          return !(
            logoBox.right <= b.left + 1 ||
            b.right <= logoBox.left + 1 ||
            logoBox.bottom <= b.top + 1 ||
            b.bottom <= logoBox.top + 1
          );
        }).length;
        const logoInsideToolbar =
          logoBox.left >= barBox.left - 0.5 &&
          logoBox.top >= barBox.top - 0.5 &&
          logoBox.right <= barBox.right + 0.5 &&
          logoBox.bottom <= barBox.bottom + 0.5;
        const logoInsideViewport =
          logoBox.left >= -0.5 &&
          logoBox.top >= -0.5 &&
          logoBox.right <= window.innerWidth + 0.5 &&
          logoBox.bottom <= window.innerHeight + 0.5;
        return {
          viewport,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          logo: {
            naturalWidth: logo.naturalWidth,
            naturalHeight: logo.naturalHeight,
            height: logoBox.height,
            width: logoBox.width,
            x: logoBox.x,
            y: logoBox.y,
            right: logoBox.right,
            bottom: logoBox.bottom,
          },
          toolbar: { x: barBox.x, y: barBox.y, width: barBox.width, height: barBox.height },
          logoInsideToolbar,
          logoInsideViewport,
          overlapCount,
        };
      }, vp.name);

      expect(metrics.logo.naturalWidth).toBeGreaterThan(0);
      expect(Math.abs(metrics.logo.height - 24)).toBeLessThanOrEqual(0.5);
      expect(metrics.logoInsideToolbar).toBe(true);
      expect(metrics.logoInsideViewport).toBe(true);
      expect(metrics.scrollWidth).toBe(metrics.innerWidth);
      expect(metrics.overlapCount).toBe(0);

      await page.screenshot({ path: join(root, "artifacts", vp.screenshot), scale: "css" });
      measured[vp.name] = metrics;
    } finally {
      await page.close();
    }
  }

  writeFileSync(
    join(root, "artifacts", "logo_metrics.json"),
    `${JSON.stringify(measured, null, 2)}\n`,
  );
});
