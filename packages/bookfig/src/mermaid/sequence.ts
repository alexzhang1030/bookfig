import { textWidth } from "../text.ts";
import type { CaseMode } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import { UnsupportedError } from "./errors.ts";
import { linesFor } from "./metrics.ts";
import { parseSequence } from "./parse-sequence.ts";
import { blockSize, FS, LS, Pen } from "./pen.ts";

function person(pen: Pen, cx: number, cy: number): void {
  const r = 16;
  pen.shape("plain", "circle", cx, cy - 14, 2 * r, 2 * r);
  pen.line([
    [cx - 26, cy + 34],
    [cx - 26, cy + 18],
    [cx + 26, cy + 18],
    [cx + 26, cy + 34],
  ]);
  pen.ext(cx - 30, cy - 32, cx + 30, cy + 34);
}

export function drawSequence(lines: string[], pen: Pen, mode: CaseMode): string[] {
  const { parts, alias, events, auto, warnings } = parseSequence(lines);
  if (!parts.length) throw new UnsupportedError("sequenceDiagram with no participants");
  const MS = 26;
  const box = new Map<string, readonly [string[], number, number, "participant" | "actor"]>();
  for (const p of parts) {
    const [lab, kind] = alias.get(p) ?? [p, "participant" as const];
    const ls = linesFor(applyCase(lab, mode), FS, 340);
    const [tw, th] = blockSize(ls);
    box.set(p, [ls, Math.max(tw + 70, 220), th + 44, kind]);
  }
  const idx = new Map(parts.map((p, i) => [p, i]));
  const n = parts.length;
  const gaps = Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
    const a = box.get(parts[i] ?? "");
    const b = box.get(parts[i + 1] ?? "");
    return Math.max((a?.[1] ?? 0) / 2 + (b?.[1] ?? 0) / 2 + 60, 300);
  });
  const cons: Array<readonly [number, number, number]> = [];
  let num = 0;
  for (const ev of events) {
    if (ev[0] === "msg") {
      num += 1;
      const t = `${auto ? `${num}. ` : ""}${applyCase(ev[4], mode)}`;
      const tw = blockSize(linesFor(t, MS, 640), MS)[0];
      const i = idx.get(ev[1]) ?? 0;
      const j = idx.get(ev[2]) ?? 0;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      if (lo === hi) {
        if (lo < n - 1) cons.push([lo, lo + 1, tw + 130]);
      } else cons.push([lo, hi, tw + 70]);
    } else if (ev[0] === "note") {
      const tw = blockSize(linesFor(ev[3], MS, 480), MS)[0] + 50;
      const ids = ev[2].map((x) => idx.get(x) ?? 0).sort((a, b) => a - b);
      const first = ids[0] ?? 0;
      if (ev[1] === "right of" && first < n - 1) cons.push([first, first + 1, tw + 60]);
      if (ev[1] === "left of" && first > 0) cons.push([first - 1, first, tw + 60]);
      if (ev[1] === "over" && ids.length === 1) {
        if (first > 0) {
          const prev = box.get(parts[first - 1] ?? "");
          cons.push([first - 1, first, tw / 2 + (prev?.[1] ?? 0) / 2 + 30]);
        }
        if (first < n - 1) {
          const next = box.get(parts[first + 1] ?? "");
          cons.push([first, first + 1, tw / 2 + (next?.[1] ?? 0) / 2 + 30]);
        }
      }
    }
  }
  for (const [i, j, need] of [...cons].sort((a, b) => a[1] - a[0] - (b[1] - b[0]))) {
    const have = gaps.slice(i, j).reduce((a, b) => a + b, 0);
    if (have < need && j > i) {
      for (let k = i; k < j; k++) gaps[k] = (gaps[k] ?? 0) + (need - have) / (j - i);
    }
  }
  const X = [0];
  for (const gp of gaps) X.push((X[X.length - 1] ?? 0) + gp);
  const bh = Math.max(...[...box.values()].map((b) => b[2]));

  const heads = (y: number, bottom = false): void => {
    for (const p of parts) {
      const b = box.get(p);
      const ix = idx.get(p);
      if (!b || ix === undefined) continue;
      const [ls, w, , kind] = b;
      const cx = X[ix] ?? 0;
      if (kind === "actor") {
        pen.shape("plain", "rect", cx, y + bh / 2, w, bh);
        pen.text(cx, y + bh / 2, ls);
        person(pen, cx, bottom ? y + bh + 46 : y - 46);
      } else {
        pen.shape("component", "rect", cx, y + bh / 2, w, bh);
        pen.text(cx, y + bh / 2, ls);
      }
    }
  };

  let y = 0;
  if ([...alias.values()].some(([, k]) => k === "actor")) y = 80;
  heads(y);
  const topLife = y + bh;
  y += bh + 60;
  type Block = {
    kind: string;
    label: string;
    y0: number;
    x0: number;
    x1: number;
    divs: Array<readonly [number, string, string]>;
  };
  const stack: Block[] = [];
  num = 0;
  const touch = (x0: number, x1: number) => {
    for (const b of stack) {
      b.x0 = Math.min(b.x0, x0);
      b.x1 = Math.max(b.x1, x1);
    }
  };

  for (const ev of events) {
    switch (ev[0]) {
      case "msg": {
        const [, a, b, op, text] = ev;
        num += 1;
        const t = `${auto ? `${num}. ` : ""}${applyCase(text, mode)}`;
        const ls = linesFor(t, MS, 640);
        const [tw, th] = blockSize(ls, MS);
        const xa = X[idx.get(a) ?? 0] ?? 0;
        const xb = X[idx.get(b) ?? 0] ?? 0;
        const style = op.startsWith("--") || op.startsWith("<<--") ? "dashed" : "solid";
        if (a === b) {
          pen.backing(xa + 120 + tw / 2, y + th / 2, tw + 16, th + 4);
          pen.text(xa + 120, y + th / 2, ls, MS, "line", "start");
          y += th + 10;
          const pts: Array<readonly [number, number]> = [
            [xa, y],
            [xa + 90, y],
            [xa + 90, y + 50],
            [xa, y + 50],
          ];
          pen.line(pts, style);
          const last = pts[pts.length - 1];
          const prev = pts[pts.length - 2];
          if (last && prev) pen.head(last, prev);
          touch(xa - 10, xa + 120 + tw);
          y += 90;
          break;
        }
        pen.backing((xa + xb) / 2, y + th / 2, tw + 16, th + 4);
        pen.text((xa + xb) / 2, y + th / 2, ls, MS);
        y += th + 18;
        pen.line(
          [
            [xa, y],
            [xb, y],
          ],
          style,
        );
        if (op.endsWith(">>") || op.endsWith(")")) pen.head([xb, y], [xa, y]);
        if (op.endsWith("x")) {
          const d = 12;
          pen.line([
            [xb - d - 4, y - d],
            [xb - 4 + d - 8, y + d],
          ]);
          pen.line([
            [xb - d - 4, y + d],
            [xb - 4 + d - 8, y - d],
          ]);
        }
        if (op.startsWith("<<")) pen.head([xa, y], [xb, y]);
        touch(Math.min(xa, xb, (xa + xb) / 2 - tw / 2), Math.max(xa, xb, (xa + xb) / 2 + tw / 2));
        y += 56;
        break;
      }
      case "note": {
        const [, where, who, text] = ev;
        const ls = linesFor(applyCase(text, mode), MS, 480);
        const [tw, th] = blockSize(ls, MS);
        let w = tw + 50;
        const h = th + 30;
        const xs = who.map((p) => X[idx.get(p) ?? 0] ?? 0).sort((a, b) => a - b);
        let cx: number;
        if (where === "over") {
          cx = ((xs[0] ?? 0) + (xs[xs.length - 1] ?? 0)) / 2;
          w = Math.max(w, (xs[xs.length - 1] ?? 0) - (xs[0] ?? 0) + 120);
        } else if (where === "right of") cx = (xs[0] ?? 0) + 30 + w / 2;
        else cx = (xs[0] ?? 0) - 30 - w / 2;
        pen.shape("plain", "rect", cx, y + h / 2, w, h);
        pen.text(cx, y + h / 2, ls, MS);
        touch(cx - w / 2, cx + w / 2);
        y += h + 40;
        break;
      }
      case "begin":
        y += 10;
        stack.push({ kind: ev[1], label: ev[2], y0: y, x0: 1e9, x1: -1e9, divs: [] });
        y += 60;
        break;
      case "else":
        if (stack[stack.length - 1]) stack[stack.length - 1]?.divs.push([y, ev[1], ev[2]]);
        y += 64;
        break;
      case "end": {
        const b = stack.pop();
        if (!b) {
          warnings.push("unmatched end");
          break;
        }
        y += 6;
        if (b.x0 > b.x1) {
          b.x0 = X[0] ?? 0;
          b.x1 = X[X.length - 1] ?? 0;
        }
        const x0 = b.x0 - 40;
        let x1 = b.x1 + 40;
        const title = applyCase(`${b.kind} ${b.label}`.trim(), mode);
        x1 = Math.max(x1, x0 + textWidth(title, 24, LS) + 80);
        pen.group(x0, b.y0, x1 - x0, y - b.y0);
        pen.tag(x0 + 24 + (textWidth(title, 24, LS) + 28) / 2, b.y0, title, 24, "component");
        for (const [dy, _w, lab] of b.divs) {
          pen.line(
            [
              [x0, dy],
              [x1, dy],
            ],
            "dashed",
          );
          if (lab) {
            const t = applyCase(lab, mode);
            pen.tag(x0 + 24 + (textWidth(t, 22, LS) + 28) / 2, dy, t, 22);
          }
        }
        touch(x0, x1);
        y += 30;
        break;
      }
      default: {
        const _n: never = ev;
        void _n;
      }
    }
  }
  for (const p of parts) {
    const ix = idx.get(p);
    if (ix === undefined) continue;
    const cx = X[ix] ?? 0;
    pen.line(
      [
        [cx, topLife],
        [cx, y + 10],
      ],
      "dashed",
    );
    pen.toBackLast();
  }
  heads(y + 10, true);
  return warnings;
}
