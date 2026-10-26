#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { isPaletteName, PALETTES } from "./palettes.ts";
import { isCaseMode } from "./types.ts";
import { UnsupportedError } from "./mermaid/errors.ts";
import { renderMermaid, unsupportedFigure } from "./mermaid/render.ts";
import { writePng, writeSvg } from "./node.ts";

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      palette: { type: "string", default: "blue" },
      svg: { type: "string" },
      case: { type: "string", default: "auto" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help || positionals.length < 2) {
    console.log(
      "bookfig <in.mmd> <out.png|out.svg> [--palette blue|green] [--svg out.svg] [--case auto|upper|keep]",
    );
    return values.help ? 0 : 1;
  }
  const inp = positionals[0] ?? "";
  const out = positionals[1] ?? "";
  const palette = values.palette ?? "blue";
  const caseMode = values.case ?? "auto";
  if (!isPaletteName(palette)) {
    console.error(`unknown palette '${palette}' (supported: ${Object.keys(PALETTES).join(", ")})`);
    return 1;
  }
  if (!isCaseMode(caseMode)) {
    console.error(`unknown case mode '${caseMode}' (supported: auto, upper, keep)`);
    return 1;
  }
  const text = readFileSync(inp, "utf8");
  try {
    const r = await renderMermaid(text, { palette, caseMode });
    if (out.endsWith(".svg")) writeSvg(out, r.svg);
    else writePng(out, r.svg);
    if (values.svg) writeSvg(values.svg, r.svg);
    for (const w of r.warnings) console.error("warning:", w);
    console.log(`${out}  type=${r.type} scale=${r.scale}`);
    return 0;
  } catch (err) {
    if (err instanceof UnsupportedError) {
      console.error(`unsupported: ${err.message}`);
      const svg = unsupportedFigure(err.message, { palette });
      if (out.endsWith(".svg")) writeSvg(out, svg);
      else if (out.endsWith(".png")) writePng(out, svg);
      if (values.svg) writeSvg(values.svg, svg);
      return 2;
    }
    throw err;
  }
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("cli.ts") || entry.endsWith("cli.mjs") || entry.endsWith("cli.js")) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    },
  );
}
