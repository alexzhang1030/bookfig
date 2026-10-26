import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { GALLERY } from "../src/gallery.ts";
import { renderMermaid } from "../src/mermaid/render.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/mermaid");
const snapDir = join(dirname(fileURLToPath(import.meta.url)), "snapshots");

const extra = ["11_syntax", "12_sequence_activate", "13_backedge"];

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
  expect(r.svg).toContain("KaTeX");
});

test("circle and cross heads appear in the SVG", async () => {
  const src = readFileSync(join(fixtures, "11_syntax.mmd"), "utf8");
  const r = await renderMermaid(src);
  expect(r.svg).toContain("<circle");
  expect((r.svg.match(/<path d="M/g) ?? []).length).toBeGreaterThan(2);
});
