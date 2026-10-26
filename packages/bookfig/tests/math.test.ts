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
