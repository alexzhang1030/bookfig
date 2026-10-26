import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIMITIVE_EXAMPLES } from "../src/examples.ts";
import { GALLERY } from "../src/gallery.ts";
import { renderKatex } from "../src/mermaid/math.ts";
import { renderMermaid, unsupportedFigure } from "../src/mermaid/render.ts";
import { tileSvgs, writePng, writeSvg } from "../src/node.ts";
import { PALETTE } from "../src/palettes.ts";
import { escapeXml } from "../src/text.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const outDirs = [join(root, "artifacts"), "/opt/cursor/artifacts"];

function ensure(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function mathZoomSvg(): string {
  const items: Array<{ label: string; tex: string }> = [
    { label: "log", tex: "\\log" },
    { label: "10^{-3}", tex: "10^{-3}" },
    { label: "i=1", tex: "i=1" },
  ];
  const size = 96;
  const graphics = items.map((it) => ({ ...it, g: renderKatex(it.tex, false, size) }));
  const pad = 40;
  const gap = 56;
  const labelH = 36;
  const colW = Math.max(220, ...graphics.map((x) => x.g.width)) + pad * 2;
  const innerH = Math.max(...graphics.map((x) => x.g.height));
  const rowH = innerH + pad * 2 + labelH;
  const W = pad + graphics.length * (colW + gap) - gap + pad;
  const H = pad + 48 + rowH + pad;
  const blue = PALETTE.line;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="${PALETTE.bg}"/>`,
    `<text x="${W / 2}" y="${pad + 28}" text-anchor="middle" font-size="22" fill="${blue}">math zoom · log / 10^{-3} / i=1</text>`,
  ];
  graphics.forEach((item, i) => {
    const x = pad + i * (colW + gap);
    const y = pad + 48;
    parts.push(
      `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" fill="${PALETTE.lighter}" stroke="${blue}" stroke-width="2"/>`,
      `<text x="${x + colW / 2}" y="${y + 28}" text-anchor="middle" font-size="16" fill="${blue}">${escapeXml(item.label)}</text>`,
      `<g transform="translate(${(x + (colW - item.g.width) / 2).toFixed(2)},${(y + labelH + pad * 0.4).toFixed(2)})">${item.g.svg}</g>`,
    );
  });
  parts.push("</svg>");
  return parts.join("");
}

async function main(): Promise<void> {
  for (const dir of outDirs) ensure(dir);
  const mermaidSvgs: string[] = [];
  const firstNine = GALLERY.filter((g) => g.id !== "10_math");
  for (const item of GALLERY) {
    let svg: string;
    try {
      const r = await renderMermaid(item.source);
      svg = r.svg;
      console.log(item.id, r.type, "scale", r.scale, "warn", r.warnings.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(item.id, "unsupported:", msg);
      svg = unsupportedFigure(msg);
    }
    if (item.id !== "10_math") mermaidSvgs.push(svg);
    for (const dir of outDirs) {
      writeSvg(join(dir, `${item.id}.svg`), svg);
      writePng(join(dir, `${item.id}.png`), svg);
    }
  }
  const sheet = tileSvgs(mermaidSvgs, 2, 980, 20);
  const two = firstNine.find((g) => g.id === "02_subgraphs");
  const math = GALLERY.find((g) => g.id === "10_math");
  let twoSvg = mermaidSvgs[1] ?? "";
  let mathSvg = "";
  if (two) {
    const r = await renderMermaid(two.source);
    twoSvg = r.svg;
  }
  if (math) {
    const r = await renderMermaid(math.source);
    mathSvg = r.svg;
  }
  const glyphsSrc = readFileSync(join(here, "../fixtures/mermaid/14_math_glyphs.mmd"), "utf8");
  const glyphs = await renderMermaid(glyphsSrc);
  for (const dir of outDirs) {
    writeSvg(join(dir, "14_math_glyphs.svg"), glyphs.svg);
    writePng(join(dir, "14_math_glyphs.png"), glyphs.svg);
    writeSvg(join(dir, "14_math_glyphs_v4.svg"), glyphs.svg);
    writePng(join(dir, "14_math_glyphs_v4.png"), glyphs.svg);
    writeSvg(join(dir, "14_math_glyphs_v5.svg"), glyphs.svg);
    writePng(join(dir, "14_math_glyphs_v5.png"), glyphs.svg);
  }
  const primSvgs = PRIMITIVE_EXAMPLES.map(([name, make]) => {
    const svg = make().svg();
    for (const dir of outDirs) {
      writeSvg(join(dir, `${name}.svg`), svg);
      writePng(join(dir, `${name}.png`), svg);
    }
    return svg;
  });
  const primSheet = tileSvgs(primSvgs, 2, 980, 20);
  for (const dir of outDirs) {
    writeSvg(join(dir, "mermaid_sheet.svg"), sheet);
    writePng(join(dir, "mermaid_sheet.png"), sheet);
    writeSvg(join(dir, "mermaid_sheet_v2.svg"), sheet);
    writePng(join(dir, "mermaid_sheet_v2.png"), sheet);
    writeSvg(join(dir, "mermaid_sheet_v3.svg"), sheet);
    writePng(join(dir, "mermaid_sheet_v3.png"), sheet);
    writeSvg(join(dir, "mermaid_sheet_v4.svg"), sheet);
    writePng(join(dir, "mermaid_sheet_v4.png"), sheet);
    writeSvg(join(dir, "mermaid_sheet_v5.svg"), sheet);
    writePng(join(dir, "mermaid_sheet_v5.png"), sheet);
    writeSvg(join(dir, "02_subgraphs_v2.svg"), twoSvg);
    writePng(join(dir, "02_subgraphs_v2.png"), twoSvg);
    writeSvg(join(dir, "02_subgraphs_v3.svg"), twoSvg);
    writePng(join(dir, "02_subgraphs_v3.png"), twoSvg);
    if (mathSvg) {
      writeSvg(join(dir, "math_example_v2.svg"), mathSvg);
      writePng(join(dir, "math_example_v2.png"), mathSvg);
      writeSvg(join(dir, "math_example_v3.svg"), mathSvg);
      writePng(join(dir, "math_example_v3.png"), mathSvg);
      writeSvg(join(dir, "math_example_v4.svg"), mathSvg);
      writePng(join(dir, "math_example_v4.png"), mathSvg);
      writeSvg(join(dir, "math_example_v5.svg"), mathSvg);
      writePng(join(dir, "math_example_v5.png"), mathSvg);
    }
    writeSvg(join(dir, "sheet.svg"), primSheet);
    writePng(join(dir, "sheet.png"), primSheet);
    const zoom = mathZoomSvg();
    writeSvg(join(dir, "math_zoom_v5.svg"), zoom);
    writePng(join(dir, "math_zoom_v5.png"), zoom);
    writeFileSync(join(dir, "README.txt"), "bookfig render artifacts (Node SVG → PNG)\n", "utf8");
  }
  console.log("wrote artifacts to", outDirs.join(", "));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
