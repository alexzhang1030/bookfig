import { PALETTE } from "../palettes.ts";
import type { CaseMode } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import { UnsupportedError } from "./errors.ts";
import { laidBlockSize, layoutLabel } from "./math.ts";
import { parsePie } from "./parse-pie.ts";
import { Pen } from "./pen.ts";

const FILLS = [PALETTE.dark, PALETTE.line, PALETTE.mid, PALETTE.light] as const;

export function drawPie(header: string, lines: string[], pen: Pen, mode: CaseMode): string[] {
  const { title, showData, slices, warnings } = parsePie(header, lines);
  if (!slices.length) throw new UnsupportedError("pie chart with no slices");
  const total = slices.reduce((s, sl) => s + Math.abs(sl.value), 0);
  if (!(total > 0)) throw new UnsupportedError("pie chart values sum to 0");
  const R = 210;
  const cx = -220;
  const cy = 40;
  let a0 = -Math.PI / 2;
  slices.forEach((sl, i) => {
    const frac = Math.abs(sl.value) / total;
    const a1 = a0 + Math.PI * 2 * Math.max(frac, 0.0001);
    const fill = FILLS[i % FILLS.length] ?? PALETTE.line;
    pen.wedge(cx, cy, R, a0, a1, fill);
    a0 = a1;
  });
  let ly = cy - R + 10;
  const lx = cx + R + 80;
  let legendW = 0;
  slices.forEach((sl, i) => {
    const fill = FILLS[i % FILLS.length] ?? PALETTE.line;
    const name = applyCase(sl.label, mode);
    const text = showData ? `${name}   ${sl.value}` : name;
    const laid = layoutLabel(text, 26, 420);
    const [tw, th] = laidBlockSize(laid);
    pen.patch(lx - 10, ly + th / 2 - 12, 24, 24, fill);
    pen.rich(lx + 36 + tw / 2, ly + th / 2, laid, "line", "middle");
    legendW = Math.max(legendW, tw + 56);
    ly += th + 28;
  });
  const boxW = R * 2 + legendW + 200;
  const boxH = Math.max(R * 2, ly - (cy - R) + 20) + 80;
  const x0 = cx - R - 50;
  const y0 = cy - R - 70;
  pen.group(
    x0,
    y0,
    Math.max(boxW, lx + legendW - x0 + 40),
    boxH,
    title ? applyCase(title, mode) : "PIE",
  );
  return warnings;
}
