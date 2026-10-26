import { textWidth } from "../text.ts";
import type { CaseMode } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import { UnsupportedError } from "./errors.ts";
import { laidBlockSize, layoutLabel } from "./math.ts";
import { parseSequence } from "./parse-sequence.ts";
import { FS, LS, Pen } from "./pen.ts";

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
  const { parts, alias, events, boxes, auto, warnings } = parseSequence(lines);
  if (!parts.length) throw new UnsupportedError("sequenceDiagram with no participants");
  const MS = 26;
  const box = new Map<
    string,
    readonly [ReturnType<typeof layoutLabel>, number, number, "participant" | "actor"]
  >();
  for (const p of parts) {
    const [lab, kind] = alias.get(p) ?? [p, "participant" as const];
    const ls = layoutLabel(applyCase(lab, mode), FS, 340);
    const [tw, th] = laidBlockSize(ls);
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
      const tw = laidBlockSize(layoutLabel(t, MS, 640))[0];
      const i = idx.get(ev[1]) ?? 0;
      const j = idx.get(ev[2]) ?? 0;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      if (lo === hi) {
        if (lo < n - 1) cons.push([lo, lo + 1, tw + 130]);
      } else cons.push([lo, hi, tw + 70]);
    } else if (ev[0] === "note") {
      const tw = laidBlockSize(layoutLabel(applyCase(ev[3], mode), MS, 480))[0] + 50;
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
        pen.rich(cx, y + bh / 2, ls);
        person(pen, cx, bottom ? y + bh + 46 : y - 46);
      } else {
        pen.shape("component", "rect", cx, y + bh / 2, w, bh);
        pen.rich(cx, y + bh / 2, ls);
      }
    }
  };

  let y = 0;
  if ([...alias.values()].some(([, k]) => k === "actor")) y = 80;
  const headerY = y;
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

  type ActOpen = { who: string; y0: number; depth: number };
  const openActs: ActOpen[] = [];
  const actBars: Array<{ who: string; y0: number; y1: number; depth: number }> = [];
  const depthOf = (who: string): number => openActs.filter((a) => a.who === who).length;
  const activate = (who: string, at: number) => {
    openActs.push({ who, y0: at, depth: depthOf(who) });
  };
  const deactivate = (who: string, at: number) => {
    for (let i = openActs.length - 1; i >= 0; i--) {
      const a = openActs[i];
      if (a && a.who === who) {
        actBars.push({ who, y0: a.y0, y1: at, depth: a.depth });
        openActs.splice(i, 1);
        return;
      }
    }
  };

  for (const ev of events) {
    switch (ev[0]) {
      case "activate":
        activate(ev[1], y);
        break;
      case "deactivate":
        deactivate(ev[1], y);
        break;
      case "msg": {
        const [, a, b, op, text, act] = ev;
        num += 1;
        const t = `${auto ? `${num}. ` : ""}${applyCase(text, mode)}`;
        const ls = layoutLabel(t, MS, 640);
        const [tw, th] = laidBlockSize(ls);
        const xa = X[idx.get(a) ?? 0] ?? 0;
        const xb = X[idx.get(b) ?? 0] ?? 0;
        const style = op.startsWith("--") || op.startsWith("<<--") ? "dashed" : "solid";
        if (a === b) {
          pen.backing(xa + 120 + tw / 2, y + th / 2, tw + 16, th + 4);
          pen.rich(xa + 120, y + th / 2, ls, "line", "start");
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
          if (last && prev) {
            if (op.endsWith("x")) pen.head(last, prev, style, "cross");
            else if (op.endsWith(")") || op.endsWith(">>") || op.endsWith(">"))
              pen.head(last, prev, style, op.endsWith(")") ? "circle" : "arrow");
          }
          touch(xa - 10, xa + 120 + tw);
          y += 90;
        } else {
          pen.backing((xa + xb) / 2, y + th / 2, tw + 16, th + 4);
          pen.rich((xa + xb) / 2, y + th / 2, ls);
          y += th + 18;
          pen.line(
            [
              [xa, y],
              [xb, y],
            ],
            style,
          );
          if (op.endsWith(">>") || op.endsWith(">") || op.endsWith(")")) {
            pen.head([xb, y], [xa, y], style, op.endsWith(")") ? "circle" : "arrow");
          }
          if (op.endsWith("x")) pen.head([xb, y], [xa, y], style, "cross");
          if (op.startsWith("<<")) pen.head([xa, y], [xb, y], style, "arrow");
          touch(Math.min(xa, xb, (xa + xb) / 2 - tw / 2), Math.max(xa, xb, (xa + xb) / 2 + tw / 2));
          y += 56;
        }
        if (act === "+") activate(b, y - 40);
        if (act === "-") deactivate(b, y - 16);
        break;
      }
      case "note": {
        const [, where, who, text] = ev;
        const ls = layoutLabel(applyCase(text, mode), MS, 480);
        const [tw, th] = laidBlockSize(ls);
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
        pen.rich(cx, y + h / 2, ls);
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
  const lifeEnd = y + 10;
  for (const a of openActs) actBars.push({ who: a.who, y0: a.y0, y1: lifeEnd, depth: a.depth });
  for (const p of parts) {
    const ix = idx.get(p);
    if (ix === undefined) continue;
    const cx = X[ix] ?? 0;
    pen.line(
      [
        [cx, topLife],
        [cx, lifeEnd],
      ],
      "dashed",
    );
    pen.toBackLast();
  }
  for (const bar of actBars) {
    const ix = idx.get(bar.who);
    if (ix === undefined) continue;
    const cx = X[ix] ?? 0;
    const w = 14;
    const x = cx - w / 2 + bar.depth * 8;
    const h = Math.max(20, bar.y1 - bar.y0);
    pen.bar(x, bar.y0, w, h);
  }
  for (const b of boxes) {
    if (!b.members.length) continue;
    const xs = b.members
      .map((m) => {
        const ix = idx.get(m);
        const w = box.get(m)?.[1] ?? 220;
        const cx = ix === undefined ? 0 : (X[ix] ?? 0);
        return [cx - w / 2, cx + w / 2] as const;
      })
      .filter(Boolean);
    const x0 = Math.min(...xs.map((p) => p[0])) - 28;
    const x1 = Math.max(...xs.map((p) => p[1])) + 28;
    const title = applyCase(b.title || "box", mode);
    pen.group(x0, headerY - 36, x1 - x0, lifeEnd + bh + 50 - (headerY - 36), title);
  }
  heads(lifeEnd, true);
  return warnings;
}
