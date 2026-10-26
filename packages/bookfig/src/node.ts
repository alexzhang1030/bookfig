import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { DEFAULT_FONT_FAMILY } from "./palettes.ts";

function katexFontFiles(): string[] {
  try {
    const req = createRequire(import.meta.url);
    const root = dirname(req.resolve("katex/package.json"));
    const dir = join(root, "dist/fonts");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".ttf"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

const FONT_CANDIDATES = [
  process.env.BOOKFIG_FONT_PATH,
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf",
  ...katexFontFiles(),
].filter((p): p is string => Boolean(p));

export type PngOptions = {
  fontFiles?: string[];
  fontFamily?: string;
};

export function svgToPngBuffer(svg: string, opts: PngOptions = {}): Buffer {
  const fontFiles = opts.fontFiles ?? FONT_CANDIDATES;
  const resvg = new Resvg(svg, {
    font: {
      fontFiles,
      loadSystemFonts: true,
      defaultFontFamily: opts.fontFamily ?? DEFAULT_FONT_FAMILY,
    },
  });
  return Buffer.from(resvg.render().asPng());
}

export function writeSvg(path: string, svg: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg, "utf8");
}

export function writePng(path: string, svg: string, opts: PngOptions = {}): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svgToPngBuffer(svg, opts));
}

export function tileSvgs(svgs: string[], cols = 2, thumbW = 980, gap = 20, bg = "#FFFFFF"): string {
  const sizes = svgs.map(svgSize);
  const thumbs = sizes.map((sz) => ({
    w: thumbW,
    h: Math.round((sz.h * thumbW) / Math.max(sz.w, 1)),
  }));
  const rows: number[][] = [];
  for (let i = 0; i < thumbs.length; i += cols) {
    rows.push(Array.from({ length: Math.min(cols, thumbs.length - i) }, (_, k) => i + k));
  }
  const rowHs = rows.map((r) => Math.max(...r.map((i) => thumbs[i]?.h ?? 0)));
  const H = rowHs.reduce((a, b) => a + b, 0) + gap * (rows.length + 1);
  const W = cols * thumbW + gap * (cols + 1);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="${bg}"/>`,
  ];
  let yy = gap;
  rows.forEach((r, ri) => {
    let xx = gap;
    for (const i of r) {
      const src = svgs[i] ?? "";
      const th = thumbs[i];
      const sz = sizes[i];
      if (!th || !sz) continue;
      const inner = src.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
      const scale = th.w / Math.max(sz.w, 1);
      parts.push(`<g transform="translate(${xx},${yy}) scale(${scale})">${inner}</g>`);
      xx += thumbW + gap;
    }
    yy += (rowHs[ri] ?? 0) + gap;
  });
  parts.push("</svg>");
  return parts.join("");
}

function svgSize(svg: string): { w: number; h: number } {
  const vb = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg);
  if (vb) return { w: Number(vb[1]), h: Number(vb[2]) };
  const w = /width="([0-9.]+)"/.exec(svg);
  const h = /height="([0-9.]+)"/.exec(svg);
  return { w: Number(w?.[1] ?? 2000), h: Number(h?.[1] ?? 1200) };
}
