import type { CaseMode } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import { laidBlockSize, layoutLabel, type LaidLine } from "./math.ts";
import type { MermaidNode } from "./model.ts";
import { FS, LH, LS, MAXW } from "./pen.ts";

export function linesFor(s: string, size = FS, maxw = MAXW): string[] {
  return layoutLabel(s, size, maxw).map((ln) =>
    ln.inlines
      .map((i) => (i.kind === "text" ? i.text : i.display ? `$$${i.tex}$$` : `$${i.tex}$`))
      .join(""),
  );
}

export function laidFor(s: string, size = FS, maxw = MAXW): LaidLine[] {
  return layoutLabel(s, size, maxw);
}

export function nodeGeometry(
  n: MermaidNode,
  mode: CaseMode,
): readonly [LaidLine[], number, number] {
  const shape = n.shape;
  if (shape === "start" || shape === "end") return [[], 44, 44];
  const lab = applyCase(n.label, mode);
  const maxw = shape === "diamond" ? 300 : MAXW;
  const ls = layoutLabel(lab, FS, maxw);
  const [tw, th] = laidBlockSize(ls);
  const padX = n.kind === "hatch" ? 70 : 40;
  const padY = n.kind === "hatch" ? 46 : 26;
  let w = tw + 2 * padX;
  let h = th + 2 * padY;
  switch (shape) {
    case "diamond":
      w = tw * 1.6 + 90;
      h = th * 2.7 + 40;
      break;
    case "circle":
    case "dcircle":
      w = h = Math.max(tw, th) * 1.15 + 50;
      break;
    case "hexagon":
    case "flag":
    case "para":
      w += h * 0.7;
      break;
    case "subroutine":
      w += 30;
      break;
    case "cylinder":
      h += 24;
      break;
    case "rect":
    case "round":
    case "stadium":
      break;
    default: {
      const _n: never = shape;
      void _n;
    }
  }
  return [ls, Math.max(w, 140), Math.max(h, 84)];
}

export { FS, LH, LS, MAXW };
