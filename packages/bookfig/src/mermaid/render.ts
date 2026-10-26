import { Fig } from "../fig.ts";
import type { CaseMode } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import { UnsupportedError } from "./errors.ts";
import { drawFlowchart } from "./flowchart.ts";
import { parseFlowchartDocument } from "./parse-flowchart.ts";
import { parseStateDocument } from "./parse-state.ts";
import { Pen } from "./pen.ts";
import { drawPie } from "./pie.ts";
import { preprocess } from "./preprocess.ts";
import { drawSequence } from "./sequence.ts";

export type RenderOptions = {
  caseMode?: CaseMode;
  width?: number;
  fontFamily?: string;
};

export type RenderResult = {
  type: string;
  svg: string;
  warnings: string[];
  scale: number;
};

const SUPPORTED = "flowchart/graph, sequenceDiagram, stateDiagram, pie";

export async function renderMermaid(text: string, opts: RenderOptions = {}): Promise<RenderResult> {
  const { title, lines } = preprocess(text);
  if (!lines.length) throw new UnsupportedError("empty diagram");
  const head = (lines[0] ?? "").trim().split(/\s+/);
  const kind = (head[0] ?? "").toLowerCase();
  const mode = opts.caseMode ?? "auto";
  const pen = new Pen();
  let warns: string[] = [];
  if (kind === "flowchart" || kind === "graph" || kind === "flowchart-elk") {
    const dir = (head[1] ?? "TB").toUpperCase();
    const g = parseFlowchartDocument(dir, lines.slice(1), title);
    await drawFlowchart(g, pen, mode);
    warns = g.warnings;
  } else if (kind === "statediagram" || kind === "statediagram-v2") {
    const g = parseStateDocument(lines.slice(1), title);
    await drawFlowchart(g, pen, mode);
    warns = g.warnings;
  } else if (kind === "sequencediagram") {
    warns = drawSequence(lines.slice(1), pen, mode);
  } else if (kind === "pie") {
    warns = drawPie((lines[0] ?? "").slice(3).trim(), lines.slice(1), pen, mode);
  } else {
    throw new UnsupportedError(
      `unsupported Mermaid diagram type '${head[0] ?? ""}' (supported: ${SUPPORTED})`,
    );
  }
  const contentW = Math.max(0, pen.x1 - pen.x0);
  const width = Math.max(opts.width ?? 2000, Math.ceil(contentW + 140));
  const f = new Fig({
    width,
    fontFamily: opts.fontFamily,
  });
  let top = 90;
  if (title) {
    f.title(applyCase(title, mode), 100);
    top = 190;
  }
  const scale = pen.emit(f, top);
  warns = [...warns, ...f.warnings];
  return { type: kind, svg: f.svg(), warnings: warns, scale: Math.round(scale * 1000) / 1000 };
}

export function unsupportedFigure(message: string, opts: RenderOptions = {}): string {
  const f = new Fig({
    width: opts.width,
    fontFamily: opts.fontFamily,
  });
  f.title("UNSUPPORTED");
  f.box(200, 220, 1600, 220, message, { kind: "group", upper: false });
  f.box(200, 500, 1600, 140, `supported: ${SUPPORTED}`, {
    kind: "plain",
    upper: false,
  });
  return f.svg();
}
