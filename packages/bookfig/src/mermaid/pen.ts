import { Fig } from "../fig.ts";
import { textWidth } from "../text.ts";
import type { BoxKind, HeadMark, LineStyle, NodeShape, TagKind, TextAnchor } from "../types.ts";
import { drawShape } from "./shapes.ts";
import type { LaidLine } from "./math.ts";

export const FS = 30;
export const LS = 2;
export const LH = 1.3;
export const MAXW = 420;

export type PenOp =
  | readonly ["shape", BoxKind, NodeShape, number, number, number, number]
  | readonly ["text", number, number, string[], number, "line" | "bg" | "dark", TextAnchor, string]
  | readonly ["rich", number, number, LaidLine[], "line" | "bg" | "dark", TextAnchor]
  | readonly ["line", Array<readonly [number, number]>, LineStyle]
  | readonly ["head", readonly [number, number], readonly [number, number], LineStyle, HeadMark]
  | readonly ["tag", number, number, string, number, TagKind]
  | readonly ["group", number, number, number, number, string | undefined, number]
  | readonly ["backing", number, number, number, number]
  | readonly ["bar", number, number, number, number]
  | readonly ["wedge", number, number, number, number, number, string];

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

  rich(
    cx: number,
    cy: number,
    lines: LaidLine[],
    color: "line" | "bg" | "dark" = "line",
    anchor: TextAnchor = "middle",
  ): void {
    this.ops.push(["rich", cx, cy, lines, color, anchor]);
    const w = lines.reduce((m, l) => Math.max(m, l.w), 0);
    const h = lines.reduce((s, l) => s + l.h, 0);
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
    mark: HeadMark = "arrow",
  ): void {
    this.ops.push(["head", tip, frm, style, mark]);
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

  bar(x: number, y: number, w: number, h: number): void {
    this.ops.push(["bar", x, y, w, h]);
    this.ext(x, y, x + w, y + h);
  }

  wedge(cx: number, cy: number, r: number, a0: number, a1: number, fill: string): void {
    this.ops.push(["wedge", cx, cy, r, a0, a1, fill]);
    this.ext(cx - r, cy - r, cx + r, cy + r);
  }

  toBackLast(): void {
    const last = this.ops.pop();
    if (last) this.ops.unshift(last);
  }

  emit(f: Fig, top: number): number {
    const W = this.x1 - this.x0;
    const s = 1;
    const need = Math.max(f.W, Math.ceil(W + 2 * f.pad));
    if (need > f.W) f.W = need;
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
    const ordered = [...this.ops].sort((a, b) => {
      const rank = (op: PenOp): number => {
        if (op[0] === "group") return 0;
        if (op[0] === "bar") return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });
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
          const [, tip, frm, style, mark] = op;
          if (style === "invis" || mark === "none") break;
          const color = style === "thick" ? c.dark : undefined;
          const size = Math.max(12, 20 * s);
          switch (mark) {
            case "arrow":
              f.head(T(tip), T(frm), size, color);
              break;
            case "circle":
              f.circleHead(T(tip), T(frm), size, color);
              break;
            case "cross":
              f.crossHead(T(tip), T(frm), size, color);
              break;
            default: {
              const _n: never = mark;
              void _n;
            }
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
        case "bar": {
          const [, x, y, w, h] = op;
          const [X, Y] = T([x, y]);
          f.raw(
            `<rect x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${(w * s).toFixed(1)}" height="${(h * s).toFixed(1)}" fill="${c.mid}" stroke="${c.line}" stroke-width="${f.lw}"/>`,
            Y + h * s,
          );
          break;
        }
        case "wedge": {
          const [, cx, cy, r, a0, a1, fill] = op;
          const [X, Y] = T([cx, cy]);
          const R = r * s;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const x0 = X + R * Math.cos(a0);
          const y0 = Y + R * Math.sin(a0);
          const x1 = X + R * Math.cos(a1);
          const y1 = Y + R * Math.sin(a1);
          const d = `M${X.toFixed(1)},${Y.toFixed(1)} L${x0.toFixed(1)},${y0.toFixed(1)} A${R.toFixed(1)},${R.toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
          f.raw(`<path d="${d}" fill="${fill}" stroke="${c.line}" stroke-width="${f.lw}"/>`, Y + R);
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
        case "rich": {
          const [, cx, cy, lines, color, anchor] = op;
          const [X, Y] = T([cx, cy]);
          const totalH = lines.reduce((sum, l) => sum + l.h, 0);
          let yy = Y - totalH / 2;
          for (const line of lines) {
            let xx = anchor === "middle" ? X - line.w / 2 : anchor === "start" ? X : X - line.w;
            const mid = yy + line.h / 2;
            for (const inline of line.inlines) {
              if (inline.kind === "text") {
                f.text(
                  xx,
                  mid,
                  inline.text,
                  inline.h / LH,
                  "start",
                  col(color),
                  "normal",
                  false,
                  f.ls,
                );
                xx += inline.w;
              } else {
                const gx = xx + 2;
                const gy = mid - inline.h / 2 + 2;
                f.raw(
                  `<g transform="translate(${gx.toFixed(1)},${gy.toFixed(1)})">${inline.svg}</g>`,
                );
                xx += inline.w;
              }
            }
            yy += line.h;
          }
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
