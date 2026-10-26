import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { GALLERY } from "../src/gallery.ts";
import { UnsupportedError } from "../src/mermaid/errors.ts";
import { renderMermaid, unsupportedFigure } from "../src/mermaid/render.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/mermaid");
const snapDir = join(dirname(fileURLToPath(import.meta.url)), "snapshots");

test("fixture files stay in sync with the gallery", () => {
  for (const item of GALLERY) {
    const disk = readFileSync(join(fixtures, `${item.id}.mmd`), "utf8").replace(/\s+$/, "");
    expect(item.source.replace(/\s+$/, "")).toBe(disk);
  }
});

test("08_unsupported throws a clear UnsupportedError", async () => {
  const src = GALLERY.find((g) => g.id === "08_unsupported")?.source ?? "";
  await expect(renderMermaid(src)).rejects.toBeInstanceOf(UnsupportedError);
  await expect(renderMermaid(src)).rejects.toThrow(/pie/);
  const svg = unsupportedFigure("unsupported Mermaid diagram type 'pie'");
  expect(svg).toContain("UNSUPPORTED");
  await expect(svg).toMatchFileSnapshot(join(snapDir, "08_unsupported.svg"));
});

for (const item of GALLERY.filter((g) => g.id !== "08_unsupported")) {
  test(`svg snapshot ${item.id}`, async () => {
    const r = await renderMermaid(item.source);
    expect(r.svg.startsWith("<svg")).toBe(true);
    expect(r.svg).toContain("viewBox");
    await expect(r.svg).toMatchFileSnapshot(join(snapDir, `${item.id}.svg`));
  });
}
