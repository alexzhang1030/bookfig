import type { Font } from "opentype.js";
import { expect, test } from "vite-plus/test";
import { SITE_EXAMPLES } from "../../../apps/web/app/examples.ts";
import {
  embedBookFont,
  fontFromSvg,
  parseSvgFontFamily,
} from "../src/book-font.ts";
import { GALLERY } from "../src/gallery.ts";
import { renderMermaid } from "../src/mermaid/render.ts";
import { DEFAULT_FONT_FAMILY } from "../src/palettes.ts";
import { isWide } from "../src/text.ts";

type Box = { x: number; y: number; w: number; h: number };
type Label = { x: number; y: number; fs: number; ls: number; anchor: string; text: string };

function unescapeXml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function parseBoxes(svg: string): Box[] {
  const canvasW = Number(/width="([0-9.]+)"/.exec(svg)?.[1] ?? 2000);
  const canvasH = Number(/height="([0-9.]+)"/.exec(svg)?.[1] ?? 1200);
  const boxes: Box[] = [];
  for (const m of svg.matchAll(
    /<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g,
  )) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const w = Number(m[3]);
    const h = Number(m[4]);
    if (w > canvasW * 0.8 && h > canvasH * 0.8) continue;
    boxes.push({ x, y, w, h });
  }
  for (const m of svg.matchAll(
    /<path d="M([-\d.]+),([-\d.]+) h([-\d.]+) v([-\d.]+) h([-\d.]+) Z"/g,
  )) {
    boxes.push({
      x: Number(m[1]),
      y: Number(m[2]),
      w: Math.abs(Number(m[3])),
      h: Math.abs(Number(m[4])),
    });
  }
  for (const m of svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"/g)) {
    const cx = Number(m[1]);
    const cy = Number(m[2]);
    const r = Number(m[3]);
    boxes.push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });
  }
  for (const m of svg.matchAll(
    /<path d="M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+) Z"/g,
  )) {
    const xs = [Number(m[1]), Number(m[3]), Number(m[5]), Number(m[7])];
    const ys = [Number(m[2]), Number(m[4]), Number(m[6]), Number(m[8])];
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    boxes.push({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y });
  }
  return boxes;
}

function parseLabels(svg: string): Label[] {
  const out: Label[] = [];
  for (const m of svg.matchAll(
    /<text x="([-\d.]+)" y="([-\d.]+)" text-anchor="([^"]+)" font-size="([-\d.]+)"\s+letter-spacing="([-\d.]+)"[^>]*>([^<]*)<\/text>/g,
  )) {
    out.push({
      x: Number(m[1]),
      y: Number(m[2]),
      anchor: m[3] ?? "middle",
      fs: Number(m[4]),
      ls: Number(m[5]),
      text: unescapeXml(m[6] ?? ""),
    });
  }
  return out;
}

function measureFont(font: Font, text: string, size: number, ls: number): number {
  let w = 0;
  let n = 0;
  for (const ch of text) {
    const idx = font.charToGlyphIndex(ch);
    const g = idx ? font.glyphs.get(idx) : undefined;
    const adv = g?.advanceWidth;
    const em = adv !== undefined ? adv / font.unitsPerEm : isWide(ch) ? 1 : 0.6;
    w += em * size;
    n += 1;
  }
  return w + ls * Math.max(0, n - 1);
}

function measureEm(em: number, text: string, size: number, ls: number): number {
  let w = 0;
  let n = 0;
  for (const ch of text) {
    w += (isWide(ch) ? 1 : em) * size;
    n += 1;
  }
  return w + ls * Math.max(0, n - 1);
}

function labelsFit(
  svg: string,
  measure: (text: string, fs: number, ls: number) => number,
  slop = 2,
): { ok: boolean; overflows: string[] } {
  const boxes = parseBoxes(svg);
  const overflows: string[] = [];
  for (const t of parseLabels(svg)) {
    if (!t.text.trim()) continue;
    const tw = measure(t.text, t.fs, t.ls);
    const left = t.anchor === "start" ? t.x : t.anchor === "end" ? t.x - tw : t.x - tw / 2;
    const cx = left + tw / 2;
    const cy = t.y - t.fs * 0.3;
    const hit = boxes
      .filter(
        (b) =>
          cx >= b.x - slop &&
          cx <= b.x + b.w + slop &&
          cy >= b.y - slop &&
          cy <= b.y + b.h + slop,
      )
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (!hit) {
      overflows.push(`${JSON.stringify(t.text)} (no box)`);
      continue;
    }
    if (left < hit.x - slop || left + tw > hit.x + hit.w + slop) {
      overflows.push(`${JSON.stringify(t.text)} (${tw.toFixed(1)} > box ${hit.w.toFixed(1)})`);
    }
  }
  return { ok: overflows.length === 0, overflows };
}

test("exported SVG font matches layout and a wide stand-in overflows", async () => {
  const ids = ["01_agent_loop", "02_subgraphs", "03_fanout"];
  for (const id of ids) {
    const src =
      SITE_EXAMPLES.find((g) => g.id === id)?.source ??
      GALLERY.find((g) => g.id === id)?.source ??
      "";
    const r = await renderMermaid(src);
    const exported = embedBookFont(r.svg);
    expect(parseSvgFontFamily(exported)).toBe(DEFAULT_FONT_FAMILY);
    const font = fontFromSvg(exported);
    expect(font).toBeTruthy();
    if (!font) return;
    expect(font.getEnglishName("fontFamily")).toBe(DEFAULT_FONT_FAMILY);
    const fit = labelsFit(exported, (text, fs, ls) => measureFont(font, text, fs, ls));
    expect(fit.overflows, id).toEqual([]);
    expect(fit.ok).toBe(true);
    const wide = labelsFit(exported, (text, fs, ls) => measureEm(0.82, text, fs, ls));
    expect(wide.ok, `${id} must fail when a wide font is swapped in`).toBe(false);
  }
});

test("swapping the SVG family to Times is not treated as the bundled face", async () => {
  const src = SITE_EXAMPLES.find((g) => g.id === "01_agent_loop")?.source ?? "";
  const r = await renderMermaid(src);
  const swapped = r.svg.replaceAll(DEFAULT_FONT_FAMILY, "Times New Roman");
  expect(parseSvgFontFamily(swapped)).toBe("Times New Roman");
  expect(fontFromSvg(swapped)).toBeUndefined();
  const wide = labelsFit(swapped, (text, fs, ls) => measureEm(0.82, text, fs, ls));
  expect(wide.ok).toBe(false);
});

test("embedded export bytes parse as Noto Sans Mono", async () => {
  const r = await renderMermaid("flowchart TD\n    A[Hello] --> B[World]");
  const exported = embedBookFont(r.svg);
  expect(exported).toContain("data:font/ttf;base64,");
  const font = fontFromSvg(exported);
  expect(font?.getEnglishName("fontFamily")).toBe("Noto Sans Mono");
});
