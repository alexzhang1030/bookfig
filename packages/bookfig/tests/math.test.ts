import { expect, test } from "vite-plus/test";
import { svgToPngBuffer } from "../src/node.ts";
import { hasMath, layoutLabel, renderKatex, splitMath } from "../src/mermaid/math.ts";
import { renderMermaid } from "../src/mermaid/render.ts";

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

test("renderKatex returns a sized SVG group without foreignObject", () => {
  const g = renderKatex("x^2 + \\frac{1}{2}", false, 28);
  expect(g.width).toBeGreaterThan(20);
  expect(g.height).toBeGreaterThan(16);
  expect(g.svg).toContain("<text");
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
  expect(hat.svg).toContain("^");
  expect(hat.svg).toContain("style=\"font-family:KaTeX_Main");
  expect(hat.svg).toContain("style=\"font-family:KaTeX_Math");
  expect(hat.width).toBeLessThan(y.width + 18);
  expect(hat.svg).toMatch(/translate\(-?[0-9.]+,0\.00\)/);
});

test("figure CSS cannot restyle KaTeX text to the book font", async () => {
  const r = await renderMermaid(`flowchart TD\n    A["$\\hat{y}_i$"]\n`);
  expect(r.svg).toContain("svg{font-family:");
  expect(r.svg).not.toMatch(/<style>text\{font-family/);
  expect(r.svg).toContain('style="font-family:KaTeX_Math');
  expect(r.svg).toContain('style="font-family:KaTeX_Main');
  expect(r.svg).toContain("data-tex=\"\\hat{y}_i\"");
  expect(r.svg).not.toContain(">hat</");
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
  expect(g.svg).toContain("KaTeX_Size2");
  expect(g.svg).toContain("∑");
});

test("layoutLabel sizes a box around the formula", () => {
  const lines = layoutLabel("loss $$\\sum_i x_i$$", 28, 400);
  const [w, h] = [lines.reduce((m, l) => Math.max(m, l.w), 0), lines.reduce((s, l) => s + l.h, 0)];
  expect(w).toBeGreaterThan(80);
  expect(h).toBeGreaterThan(20);
  expect(lines.some((l) => l.inlines.some((i) => i.kind === "math"))).toBe(true);
});

test("Node PNG of a math diagram is a real PNG", async () => {
  const r = await renderMermaid(`flowchart LR\n    A["$E = mc^2$"] --> B["$$\\int_0^1 x dx$$"]\n`);
  const png = svgToPngBuffer(r.svg);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.length).toBeGreaterThan(2000);
});
