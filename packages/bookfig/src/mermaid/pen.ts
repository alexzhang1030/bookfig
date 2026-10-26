import { Fig } from "../fig.ts";
import { textWidth } from "../text.ts";
import type { BoxKind, LineStyle, NodeShape, TagKind, TextAnchor } from "../types.ts";
import { drawShape } from "./shapes.ts";

export const FS = 30;
export const LS = 2;
export const LH = 1.3;
export const MAXW = 420;
export const AVAIL_W = 1800;

export type PenOp =
  | readonly ["shape", BoxKind, NodeShape, number, number, number, number]
  | readonly ["text", number, number, string[], number, "line" | "bg" | "dark", TextAnchor, string]
  | readonly ["line", Array<readonly [number, number]>, LineStyle]
  | readonly ["head", readonly [number, number], readonly [number, number], LineStyle]
  | readonly ["tag", number, number, string, number, TagKind]
  | readonly ["group", number, number, number, number, string | undefined, number]
  | readonly ["backing", number, number, number, number];

export function blockSize(lines: string[], size = FS): readonly [number, number] {
  const w = lines.reduce((m, l) => Math.max(m, textWidth(l, size, LS)), 0);
  return [w, lines.length * size * LH];
}

export class Pen {
  ops: PenOp[] = [];
  x0 = 1e9;
  y0 = 1e9;
  x1 = -1e9;
  y1 = -1e9;

  ext(x0: number, y0: number, x1: number, y1: number): void {
    this.x0 = Math.min(this.x0, x0);
    this.y0 = Math.min(this.y0, y0);
    this.x1 = Math.max(this.x1, x1);
    this.y1 = Math.max(this.y1, y1);
  }

  shape(kind: BoxKind, shape: NodeShape, cx: number, cy: number, w: number, h: number): void {
    this.ops.push(["shape", kind, shape, cx, cy, w, h]);
    this.ext(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  }

  text(
    cx: number,
    cy: number,
    lines: string[],
    size = FS,
    color: "line" | "bg" | "dark" = "line",
    anchor: TextAnchor = "middle",
    weight = "normal",
  ): void {
    this.ops.push(["text", cx, cy, lines, size, color, anchor, weight]);
    const [w, h] = blockSize(lines, size);
    const xa = anchor === "middle" ? cx - w / 2 : anchor === "start" ? cx : cx - w;
    this.ext(xa, cy - h / 2, xa + w, cy + h / 2);
  }

  line(pts: Array<readonly [number, number]>, style: LineStyle = "solid"): void {
    this.ops.push(["line", pts, style]);
    this.ext(
      Math.min(...pts.map((p) => p[0])),
      Math.min(...pts.map((p) => p[1])),
      Math.max(...pts.map((p) => p[0])),
      Math.max(...pts.map((p) => p[1])),
    );
  }

  head(
    tip: readonly [number, number],
    frm: readonly [number, number],
    style: LineStyle = "solid",
  ): void {
    this.ops.push(["head", tip, frm, style]);
  }

  tag(
    cx: number,
    cy: number,
    text: string,
    size = 24,
    kind: TagKind = "plain",
  ): readonly [number, number] {
    const w = textWidth(text, size, LS) + 28;
    const h = size * 1.55;
    this.ops.push(["tag", cx, cy, text, size, kind]);
    this.ext(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
    return [w, h];
  }

  group(x: number, y: number, w: number, h: number, title?: string, size = 24): void {
    this.ops.push(["group", x, y, w, h, title, size]);
    this.ext(x, y - size, x + w, y + h);
  }

  backing(cx: number, cy: number, w: number, h: number): void {
    this.ops.push(["backing", cx, cy, w, h]);
  }

  toBackLast(): void {
    const last = this.ops.pop();
    if (last) this.ops.unshift(last);
  }

  emit(f: Fig, top: number, avail = AVAIL_W): number {
    const W = this.x1 - this.x0;
    const s = Math.min(1, avail / Math.max(W, 1));
    const ox = (f.W - W * s) / 2 - this.x0 * s;
    const oy = top - this.y0 * s;
    const T = (p: readonly [number, number]): readonly [number, number] => [
      p[0] * s + ox,
      p[1] * s + oy,
    ];
    const c = f.c;
    f.ls = LS * s;
    const col = (k: "line" | "bg" | "dark"): string => {
      switch (k) {
        case "line":
          return c.line;
        case "bg":
          return c.bg;
        case "dark":
          return c.dark;
        default: {
          const _n: never = k;
          return _n;
        }
      }
    };
    const ordered = [...this.ops].sort(
      (a, b) => Number(a[0] !== "group") - Number(b[0] !== "group"),
    );
    for (const op of ordered) {
      switch (op[0]) {
        case "group": {
          const [, x, y, w, h, title, size] = op;
          const [X, Y] = T([x, y]);
          f.raw(
            `<rect x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${(w * s).toFixed(1)}" height="${(h * s).toFixed(1)}" fill="${c.lighter}" fill-opacity="0.55" stroke="${c.line}" stroke-width="${f.lw}" stroke-dasharray="10 8"/>`,
            Y + h * s,
          );
          if (title) {
            const tw = textWidth(title, size * s, f.ls) + 28 * s;
            f.tag(
              X + 18 * s + tw / 2,
              Y + (10 + size * 0.78) * s,
              title,
              size * s,
              "component",
              false,
              14 * s,
            );
          }
          break;
        }
        case "shape": {
          const [, kind, shape, cx, cy, w, h] = op;
          const [X, Y] = T([cx, cy]);
          drawShape(f, kind, shape, X, Y, w * s, h * s, s);
          break;
        }
        case "line": {
          const [, pts, style] = op;
          const P = pts.map((p) => T(p));
          if (style === "thick") f.line(P, false, c.dark, 6);
          else if (style === "dashed") f.line(P, true, undefined, undefined, "12 9");
          else if (style === "invis") {
            /* skip */
          } else f.line(P);
          break;
        }
        case "head": {
          const [, tip, frm, style] = op;
          if (style !== "invis") {
            f.head(T(tip), T(frm), Math.max(12, 20 * s), style === "thick" ? c.dark : undefined);
          }
          break;
        }
        case "backing": {
          const [, cx, cy, w, h] = op;
          const [X, Y] = T([cx, cy]);
          f.raw(
            `<rect x="${(X - (w * s) / 2).toFixed(1)}" y="${(Y - (h * s) / 2).toFixed(1)}" width="${(w * s).toFixed(1)}" height="${(h * s).toFixed(1)}" fill="${c.bg}"/>`,
          );
          break;
        }
        case "text": {
          const [, cx, cy, lines, size, color, anchor, weight] = op;
          const [X, Y] = T([cx, cy]);
          const n = lines.length;
          const lh = size * LH * s;
          lines.forEach((ln, i) => {
            f.text(
              X,
              Y + (i - (n - 1) / 2) * lh,
              ln,
              size * s,
              anchor,
              col(color),
              weight,
              false,
              f.ls,
            );
          });
          break;
        }
        case "tag": {
          const [, cx, cy, text, size, kind] = op;
          const [X, Y] = T([cx, cy]);
          f.tag(X, Y, text, size * s, kind, false, 14 * s);
          break;
        }
        default: {
          const _n: never = op;
          void _n;
        }
      }
    }
    return s;
  }
}
