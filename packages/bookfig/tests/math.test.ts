import { expect, test } from "vite-plus/test";
import { katexFontFile, katexFontFiles, svgToPngBuffer, svgToRgba } from "../src/node.ts";
import { applyCase } from "../src/mermaid/case-mode.ts";
import { listKatexFaceNames, outlineGlyph } from "../src/mermaid/katex-outline.ts";
import { hasMath, layoutLabel, renderKatex, splitMath } from "../src/mermaid/math.ts";
import { renderMermaid } from "../src/mermaid/render.ts";
import { textWidth } from "../src/text.ts";

function meanAbs(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return s / Math.max(n, 1);
}

function textSvg(ch: string, family: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="80" height="80" fill="#ffffff"/>
    <text x="16" y="58" font-family="${family}" font-size="48" font-style="normal" fill="#000000">${ch}</text>
  </svg>`;
}

function pathSvg(d: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="80" height="80" fill="#ffffff"/>
    <path d="${d}" fill="#000000"/>
  </svg>`;
}

function facePixels(ch: string, file: string, family: string): Buffer {
  return svgToRgba(textSvg(ch, family), { fontFiles: [file], loadSystemFonts: false }).pixels;
}

test("splitMath finds $ and $$ and leaves text alone", () => {
  expect(splitMath("plain")).toEqual([{ kind: "text", text: "plain" }]);
  expect(splitMath("a $x^2$ b")).toEqual([
    { kind: "text", text: "a " },
    { kind: "math", tex: "x^2", display: false },
    { kind: "text", text: " b" },
  ]);
  expect(splitMath("$$\\frac{a}{b}$$")).toEqual([
    { kind: "math", tex: "\\frac{a}{b}", display: true },
  ]);
  expect(hasMath("nope")).toBe(false);
  expect(hasMath("yes $x$")).toBe(true);
});

test("KaTeX TTF family is KaTeX_Main, not the Regular full name", () => {
  const faces = listKatexFaceNames();
  const regular = faces.find((f) => f.file === "KaTeX_Main-Regular");
  const italic = faces.find((f) => f.file === "KaTeX_Main-Italic");
  expect(regular?.family).toBe("KaTeX_Main");
  expect(regular?.style).toBe("Regular");
  expect(regular?.fullName).toBe("KaTeX_Main-Regular");
  expect(regular?.postScriptName).toBe("KaTeX_Main-Regular");
  expect(italic?.family).toBe("KaTeX_Main");
  expect(italic?.style).toBe("Italic");
  expect(italic?.postScriptName).toBe("KaTeX_Main-Italic");
});

test("resvg maps KaTeX_Main to Italic and cannot match the Regular full name", () => {
  const regular = katexFontFile("KaTeX_Main-Regular.ttf");
  const italic = katexFontFile("KaTeX_Main-Italic.ttf");
  const all = katexFontFiles();
  const refReg = facePixels("1", regular, "KaTeX_Main");
  const refIta = facePixels("1", italic, "KaTeX_Main");
  expect(meanAbs(refReg, refIta)).toBeGreaterThan(4);

  const familyAll = svgToRgba(textSvg("1", "KaTeX_Main"), {
    fontFiles: all,
    loadSystemFonts: false,
  }).pixels;
  expect(meanAbs(familyAll, refIta)).toBeLessThan(0.2);
  expect(meanAbs(familyAll, refReg)).toBeGreaterThan(4);

  const fullNameAll = svgToRgba(textSvg("1", "KaTeX_Main-Regular"), {
    fontFiles: all,
    loadSystemFonts: false,
  }).pixels;
  expect(meanAbs(fullNameAll, refReg)).toBeGreaterThan(2);

  const stack = svgToRgba(textSvg("1", "KaTeX_Main-Regular, KaTeX_Main"), {
    fontFiles: all,
    loadSystemFonts: false,
  }).pixels;
  expect(meanAbs(stack, refIta)).toBeLessThan(0.2);
});

test("digit 1 outline matches KaTeX_Main-Regular pixels, not Italic", () => {
  const regular = katexFontFile("KaTeX_Main-Regular.ttf");
  const italic = katexFontFile("KaTeX_Main-Italic.ttf");
  const d = outlineGlyph("KaTeX_Main-Regular", "1", 16, 58, 48);
  expect(d.startsWith("M") || d.startsWith("m")).toBe(true);
  const outlined = svgToRgba(pathSvg(d), { fontFiles: [], loadSystemFonts: false }).pixels;
  const refReg = facePixels("1", regular, "KaTeX_Main");
  const refIta = facePixels("1", italic, "KaTeX_Main");
  const dReg = meanAbs(outlined, refReg);
  const dIta = meanAbs(outlined, refIta);
  expect(dReg).toBeLessThan(1.2);
  expect(dReg).toBeLessThan(dIta / 3);
});

test("renderKatex digits and \\log use Main-Regular outlines, even with no fonts in resvg", () => {
  const one = renderKatex("1", false, 48);
  expect(one.svg).toContain("<path");
  expect(one.svg).not.toContain("<text");
  expect(one.svg).toContain('data-face="KaTeX_Main-Regular"');
  expect(one.svg).toContain('data-text="1"');

  const log = renderKatex("\\log", false, 48);
  for (const ch of ["l", "o", "g"]) {
    expect(log.svg).toContain(`data-face="KaTeX_Main-Regular"`);
    expect(log.svg).toContain(`data-text="${ch}"`);
  }
  expect(log.svg).not.toContain("KaTeX_Math");

  const nest = renderKatex("10^{-3}", false, 40);
  expect(nest.svg).toMatch(/data-face="KaTeX_Main-Regular"[^/]*data-text="1"/);
  expect(nest.svg).toMatch(/data-face="KaTeX_Main-Regular"[^/]*data-text="0"/);
  expect(nest.svg).toMatch(/data-face="KaTeX_Main-Regular"[^/]*data-text="−"/);
  expect(nest.svg).toMatch(/data-face="KaTeX_Main-Regular"[^/]*data-text="3"/);

  const g = renderKatex("1", false, 48);
  const boxed = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(g.width)}" height="${Math.ceil(g.height)}"><rect width="100%" height="100%" fill="#ffffff"/>${g.svg}</svg>`;
  const noFonts = svgToPngBuffer(boxed, { fontFiles: [], loadSystemFonts: false });
  expect(noFonts.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(noFonts.length).toBeGreaterThan(200);
});

test("renderKatex returns a sized SVG group without foreignObject", () => {
  const g = renderKatex("x^2 + \\frac{1}{2}", false, 28);
  expect(g.width).toBeGreaterThan(20);
  expect(g.height).toBeGreaterThan(16);
  expect(g.svg).toContain("<path");
  expect(g.svg).not.toContain("foreignObject");
  expect(g.svg).toContain("#1F6FEB");
});

test("display fraction gets a real rule and stacks taller than inline", () => {
  const g = renderKatex("\\frac{a}{b}", true, 28);
  expect(g.height).toBeGreaterThan(40);
  const w = Number(/frac-line[^>]*width="([0-9.]+)"/.exec(g.svg)?.[1] ?? "0");
  expect(w).toBeGreaterThan(12);
  expect(g.svg).toContain("#1F6FEB");
  expect(g.svg).not.toContain("foreignObject");
});

test("hat sits on y and does not take a side slot", () => {
  const y = renderKatex("y", false, 40);
  const hat = renderKatex("\\hat{y}", false, 40);
  expect(hat.svg).toContain('data-text="^"');
  expect(hat.svg).toContain("KaTeX_Main-Regular");
  expect(hat.svg).toContain("KaTeX_Math-Italic");
  expect(hat.width).toBeLessThan(y.width + 18);
  expect(hat.svg).toMatch(/translate\(-?[0-9.]+,0\.00\)/);
});

test("figure CSS cannot restyle KaTeX glyphs to the book font", async () => {
  const r = await renderMermaid(`flowchart TD\n    A["$\\hat{y}_i$"]\n`);
  expect(r.svg).toContain("svg{font-family:");
  expect(r.svg).not.toMatch(/<style>text\{font-family/);
  expect(r.svg).toContain('data-face="KaTeX_Math-Italic"');
  expect(r.svg).toContain('data-face="KaTeX_Main-Regular"');
  expect(r.svg).toContain('data-tex="\\hat{y}_i"');
  expect(r.svg).not.toContain(">hat</");
  const math = r.svg.match(/data-tex="\\hat\{y\}_i"[\s\S]*?<\/g>/)?.[0] ?? "";
  expect(math).toContain("<path");
  expect(math).not.toContain("<text");
});

test("script minus and digit stay tight, nested scripts stay compact", () => {
  const neg = renderKatex("10^{-3}", false, 40);
  const cube = renderKatex("10^{3}", false, 40);
  expect(neg.width).toBeLessThan(cube.width + 24);
  const nest = renderKatex("e^{z_i}", false, 40);
  const plain = renderKatex("e^{z}", false, 40);
  expect(nest.width).toBeLessThan(plain.width + 22);
});

test("display sum uses the large-op Size2 font", () => {
  const g = renderKatex("\\sum_i x", true, 40);
  expect(g.svg).toContain("KaTeX_Size2-Regular");
  expect(g.svg).toContain('data-text="∑"');
});

test("layoutLabel sizes a box around the formula", () => {
  const lines = layoutLabel("loss $$\\sum_i x_i$$", 28, 400);
  const [w, h] = [lines.reduce((m, l) => Math.max(m, l.w), 0), lines.reduce((s, l) => s + l.h, 0)];
  expect(w).toBeGreaterThan(80);
  expect(h).toBeGreaterThan(20);
  expect(lines.some((l) => l.inlines.some((i) => i.kind === "math"))).toBe(true);
});

test("space between words and $x^2$ survives auto case and layout", () => {
  const cased = applyCase("area $x^2$", "auto");
  expect(cased).toBe("AREA $x^2$");
  const lines = layoutLabel(cased, 30, 420);
  const row = lines[0]?.inlines ?? [];
  const text = row.find((i) => i.kind === "text");
  const math = row.find((i) => i.kind === "math");
  expect(text?.kind === "text" && text.text.endsWith(" ")).toBe(true);
  expect(text?.kind === "text" ? text.text.trim() : "").toBe("AREA");
  expect(math?.kind).toBe("math");
  const word = textWidth("AREA", 30, 2);
  const space = textWidth(" ", 30, 2);
  expect(text?.w ?? 0).toBeGreaterThan(word);
  expect((text?.w ?? 0) - word).toBeGreaterThan(space * 0.8);
  expect((text?.w ?? 0) - word).toBeLessThan(space * 2.5);
});

test("rendered AREA and $x^2$ keep a space-sized gap", async () => {
  const r = await renderMermaid(`flowchart TD\n    A["area $x^2$"]`);
  const texts = [
    ...r.svg.matchAll(
      /<text x="(-?[\d.]+)"[^>]*font-size="([\d.]+)"[^>]*letter-spacing="([\d.]+)"[^>]*>([^<]*)<\/text>/g,
    ),
  ];
  const area = texts.find((t) => (t[4] ?? "").includes("AREA"));
  const math = /<g transform="translate\((-?[\d.]+),(-?[\d.]+)\)">[\s\S]{0,80}data-tex="x\^2"/.exec(
    r.svg,
  );
  expect(area).toBeTruthy();
  expect(math).toBeTruthy();
  const x = Number(area?.[1] ?? 0);
  const fs = Number(area?.[2] ?? 30);
  const ls = Number(area?.[3] ?? 2);
  const raw = (area?.[4] ?? "").replace(/&nbsp;/g, " ");
  expect(raw.endsWith(" ")).toBe(true);
  expect(r.svg).toContain('xml:space="preserve"');
  const wordW = textWidth(raw.trimEnd(), fs, ls);
  const spaceW = textWidth(" ", fs, ls);
  const mathX = Number(math?.[1] ?? 0);
  const gap = mathX - (x + wordW);
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeGreaterThan(spaceW * 0.5);
  expect(gap).toBeLessThan(spaceW * 3);
});

test("Node PNG of a math diagram is a real PNG", async () => {
  const r = await renderMermaid(`flowchart LR\n    A["$E = mc^2$"] --> B["$$\\int_0^1 x dx$$"]\n`);
  const png = svgToPngBuffer(r.svg);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.length).toBeGreaterThan(2000);
});
