import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIMITIVE_EXAMPLES } from "../src/examples.ts";
import { GALLERY } from "../src/gallery.ts";
import { renderMermaid, unsupportedFigure } from "../src/mermaid/render.ts";
import { tileSvgs, writePng, writeSvg } from "../src/node.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const outDirs = [join(root, "artifacts"), "/opt/cursor/artifacts"];

function ensure(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

async function main(): Promise<void> {
  for (const dir of outDirs) ensure(dir);
  const mermaidSvgs: string[] = [];
  const mermaidPngs: string[] = [];
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
    mermaidSvgs.push(svg);
    for (const dir of outDirs) {
      writeSvg(join(dir, `${item.id}.svg`), svg);
      writePng(join(dir, `${item.id}.png`), svg);
      mermaidPngs.push(join(dir, `${item.id}.png`));
    }
  }
  const sheet = tileSvgs(mermaidSvgs, 2, 980, 20);
  for (const dir of outDirs) {
    writeSvg(join(dir, "mermaid_sheet.svg"), sheet);
    writePng(join(dir, "mermaid_sheet.png"), sheet);
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
    writeSvg(join(dir, "sheet.svg"), primSheet);
    writePng(join(dir, "sheet.png"), primSheet);
    writeFileSync(join(dir, "README.txt"), "bookfig render artifacts (Node SVG → PNG)\n", "utf8");
  }
  console.log("wrote artifacts to", outDirs.join(", "));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
