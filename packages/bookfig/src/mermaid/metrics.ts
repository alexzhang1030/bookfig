import { wrap } from "../text.ts";
import type { CaseMode } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import type { MermaidNode } from "./model.ts";
import { blockSize, FS, LH, LS, MAXW } from "./pen.ts";

export function linesFor(s: string, size = FS, maxw = MAXW): string[] {
  const out: string[] = [];
  for (const ln of s.split("\n")) {
    if (ln) out.push(...wrap(ln, maxw, size, LS));
    else out.push("");
  }
  return out;
}

export function nodeGeometry(n: MermaidNode, mode: CaseMode): readonly [string[], number, number] {
  const shape = n.shape;
  if (shape === "start" || shape === "end") return [[], 44, 44];
  const lab = applyCase(n.label, mode);
  const maxw = shape === "diamond" ? 300 : MAXW;
  const ls = linesFor(lab, FS, maxw);
  const [tw, th] = blockSize(ls);
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
