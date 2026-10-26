import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { GALLERY } from "../src/gallery.ts";
import { renderMermaid } from "../src/mermaid/render.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/mermaid");
const snapDir = join(dirname(fileURLToPath(import.meta.url)), "snapshots");

const extra = ["11_syntax", "12_sequence_activate", "13_backedge", "14_math_glyphs"];

test("fixture files stay in sync with the gallery", () => {
  for (const item of GALLERY) {
    const disk = readFileSync(join(fixtures, `${item.id}.mmd`), "utf8").replace(/\s+$/, "");
    expect(item.source.replace(/\s+$/, "")).toBe(disk);
  }
});

for (const item of GALLERY) {
  test(`svg snapshot ${item.id}`, async () => {
    const r = await renderMermaid(item.source);
    expect(r.svg.startsWith("<svg")).toBe(true);
    expect(r.svg).toContain("viewBox");
    expect(r.svg).not.toContain("foreignObject");
    await expect(r.svg).toMatchFileSnapshot(join(snapDir, `${item.id}.svg`));
  });
}

for (const id of extra) {
  test(`svg snapshot ${id}`, async () => {
    const src = readFileSync(join(fixtures, `${id}.mmd`), "utf8");
    const r = await renderMermaid(src);
    expect(r.svg.startsWith("<svg")).toBe(true);
    expect(r.svg).not.toContain("UNSUPPORTED");
    await expect(r.svg).toMatchFileSnapshot(join(snapDir, `${id}.svg`));
  });
}

test("wide LR diagram keeps readable type (scale 1, canvas grows)", async () => {
  const src = GALLERY.find((g) => g.id === "02_subgraphs")?.source ?? "";
  const r = await renderMermaid(src);
  expect(r.scale).toBe(1);
  const w = Number(/width="([0-9.]+)"/.exec(r.svg)?.[1] ?? "0");
  expect(w).toBeGreaterThanOrEqual(2000);
  expect(r.svg).not.toMatch(/font-size="1[0-8]\./);
});

test("pie renders in book-figure style", async () => {
  const src = GALLERY.find((g) => g.id === "08_pie")?.source ?? "";
  const r = await renderMermaid(src);
  expect(r.type).toBe("pie");
  expect(r.svg).not.toContain("UNSUPPORTED");
  expect(r.svg).toMatch(/<path d="M/);
  expect(r.svg).toContain("DOGS");
});

test("math labels become KaTeX SVG, not foreignObject", async () => {
  const src = GALLERY.find((g) => g.id === "10_math")?.source ?? "";
  const r = await renderMermaid(src);
  expect(r.svg).not.toContain("foreignObject");
  expect(r.svg).toContain("data-tex");
  expect(r.svg).toContain('data-face="KaTeX_');
  expect(r.svg).toContain("<path d=");
});

test("02 fail back-edge lands on TELEOP with an arrow, not between TELEOP and EP", async () => {
  const src = GALLERY.find((g) => g.id === "02_subgraphs")?.source ?? "";
  const r = await renderMermaid(src);
  const fail = /<path d="([^"]+)" fill="none"[^>]*stroke-dasharray="12 9"/.exec(r.svg)?.[1] ?? "";
  expect(fail).toMatch(/L/);
  const nums = [...fail.matchAll(/(-?[0-9.]+)/g)].map((m) => Number(m[1]));
  const lastX = nums[nums.length - 2] ?? 0;
  const lastY = nums[nums.length - 1] ?? 0;
  expect(r.svg).toContain("TELEOP");
  expect(lastX).toBeGreaterThan(200);
  expect(lastX).toBeLessThan(400);
  const data =
    /<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"[^/]*\/>\s*<rect[^/]*\/>\s*<text[^>]*>数据 DATA/.exec(
      r.svg,
    );
  expect(data).toBeTruthy();
  const dataBottom = Number(data?.[2]) + Number(data?.[4]);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const runY = Math.max(...ys);
  expect(runY).toBeGreaterThan(dataBottom);
  const tele =
    /<path d="M([0-9.]+),([0-9.]+) h([0-9.]+) v([0-9.]+) h-[0-9.]+ Z"[\s\S]{0,200}<text[^>]*>遥操作 TELEOP/.exec(
      r.svg,
    );
  expect(tele).toBeTruthy();
  const tx = Number(tele?.[1]);
  const ty = Number(tele?.[2]);
  const tw = Number(tele?.[3]);
  const th = Number(tele?.[4]);
  expect(lastX).toBeGreaterThan(tx);
  expect(lastX).toBeLessThan(tx + tw);
  expect(lastY).toBeGreaterThan(ty + th - 4);
  expect(lastY).toBeLessThan(ty + th + 4);
  const heads = [
    ...r.svg.matchAll(
      /<path d="M(-?[0-9.]+),(-?[0-9.]+) L(-?[0-9.]+),(-?[0-9.]+) L(-?[0-9.]+),(-?[0-9.]+)"/g,
    ),
  ];
  const near = heads.some((h) => Math.hypot(Number(h[3]) - lastX, Number(h[4]) - lastY) < 8);
  expect(near).toBe(true);
});

test("14 math glyphs fixture is real TeX, not escaped backslashes", async () => {
  const src = readFileSync(join(fixtures, "14_math_glyphs.mmd"), "utf8");
  expect(src).toContain("$\\hat{y}_i$");
  expect(src).not.toContain("$\\\\hat");
  const r = await renderMermaid(src);
  expect(r.svg).toContain('data-tex="\\hat{y}_i"');
  expect(r.svg).toContain("KaTeX_Size2-Regular");
  expect(r.svg).toContain('data-text="∑"');
  expect(r.svg).toContain('data-text="^"');
  expect(r.svg).not.toContain(">hat</");
  expect(r.svg).not.toContain(">ha</");
});

test("circle and cross heads appear in the SVG", async () => {
  const src = readFileSync(join(fixtures, "11_syntax.mmd"), "utf8");
  const r = await renderMermaid(src);
  expect(r.svg).toContain("<circle");
  expect((r.svg.match(/<path d="M/g) ?? []).length).toBeGreaterThan(2);
});
