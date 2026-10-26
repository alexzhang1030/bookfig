import { PALETTE } from "../palettes.ts";
import { textWidth } from "../text.ts";
import type { CaseMode } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import { UnsupportedError } from "./errors.ts";
import { laidBlockSize, layoutLabel } from "./math.ts";
import { parsePie } from "./parse-pie.ts";
import { LS, Pen } from "./pen.ts";

const FILLS = [PALETTE.dark, PALETTE.line, PALETTE.mid, PALETTE.light] as const;

export function drawPie(header: string, lines: string[], pen: Pen, mode: CaseMode): string[] {
  const { title, showData, slices, warnings } = parsePie(header, lines);
  if (!slices.length) throw new UnsupportedError("pie chart with no slices");
  const total = slices.reduce((s, sl) => s + Math.abs(sl.value), 0);
  if (!(total > 0)) throw new UnsupportedError("pie chart values sum to 0");
  const R = 220;
  const cx = 0;
  const cy = 40;
  let a0 = -Math.PI / 2;
  const labels: Array<{ x: number; y: number; text: string }> = [];
  slices.forEach((sl, i) => {
    const frac = Math.abs(sl.value) / total;
    const a1 = a0 + Math.PI * 2 * frac;
    const fill = FILLS[i % FILLS.length] ?? PALETTE.line;
    pen.wedge(cx, cy, R, a0, a1, fill);
    const mid = (a0 + a1) / 2;
    const lx = cx + (R + 56) * Math.cos(mid);
    const ly = cy + (R + 56) * Math.sin(mid);
    const name = applyCase(sl.label, mode);
    const text = showData ? `${name}  ${sl.value}` : name;
    labels.push({ x: lx, y: ly, text });
    const ix = cx + R * Math.cos(mid);
    const iy = cy + R * Math.sin(mid);
    pen.line([
      [cx + (R - 8) * Math.cos(mid), cy + (R - 8) * Math.sin(mid)],
      [ix + 18 * Math.cos(mid), iy + 18 * Math.sin(mid)],
    ]);
    a0 = a1;
  });
  for (const lab of labels) {
    const laid = layoutLabel(lab.text, 24, 360);
    const [tw, th] = laidBlockSize(laid);
    pen.backing(lab.x, lab.y, tw + 16, th + 8);
    pen.rich(lab.x, lab.y, laid);
  }
  if (title) {
    const t = applyCase(title, mode);
    const tw = textWidth(t, 28, LS);
    pen.tag(cx, cy - R - 70, t, 28, "component");
    void tw;
  }
  const boxW = R * 2 + 280;
  const boxH = R * 2 + 180;
  pen.group(cx - boxW / 2, cy - R - 100, boxW, boxH, title ? undefined : "PIE");
  return warnings;
}
