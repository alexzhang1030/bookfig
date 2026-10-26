import { Fig } from "../fig.ts";
import type { BoxKind, NodeShape } from "../types.ts";
import { assertNever } from "../types.ts";

export function drawShape(
  f: Fig,
  kind: BoxKind,
  shape: NodeShape,
  X: number,
  Y: number,
  w: number,
  h: number,
  s: number,
): void {
  const c = f.c;
  const lw = f.lw;
  let fill: string;
  switch (kind) {
    case "component":
      fill = c.light;
      break;
    case "plain":
      fill = c.bg;
      break;
    case "group":
      fill = c.lighter;
      break;
    case "focus":
      fill = c.line;
      break;
    case "dark":
      fill = c.dark;
      break;
    case "hatch":
      fill = f.hatchUrl;
      break;
    default:
      assertNever(kind, "shape kind");
  }
  const stroke = kind === "dark" ? c.dark : c.line;
  const dash = kind === "group" ? ' stroke-dasharray="10 8"' : "";
  const st = `fill="${fill}" stroke="${stroke}" stroke-width="${lw}"${dash}`;
  const x0 = X - w / 2;
  const y0 = Y - h / 2;
  let d: string;
  switch (shape) {
    case "diamond":
      d = `M${X.toFixed(1)},${y0.toFixed(1)} L${(X + w / 2).toFixed(1)},${Y.toFixed(1)} L${X.toFixed(1)},${(y0 + h).toFixed(1)} L${(X - w / 2).toFixed(1)},${Y.toFixed(1)} Z`;
      break;
    case "hexagon": {
      const k = Math.min(h / 2, w / 6);
      d = `M${(x0 + k).toFixed(1)},${y0.toFixed(1)} H${(x0 + w - k).toFixed(1)} L${(x0 + w).toFixed(1)},${Y.toFixed(1)} L${(x0 + w - k).toFixed(1)},${(y0 + h).toFixed(1)} H${(x0 + k).toFixed(1)} L${x0.toFixed(1)},${Y.toFixed(1)} Z`;
      break;
    }
    case "flag": {
      const k = h / 3;
      d = `M${x0.toFixed(1)},${y0.toFixed(1)} H${(x0 + w).toFixed(1)} V${(y0 + h).toFixed(1)} H${x0.toFixed(1)} L${(x0 + k).toFixed(1)},${Y.toFixed(1)} Z`;
      break;
    }
    case "para": {
      const k = h / 3;
      d = `M${(x0 + k).toFixed(1)},${y0.toFixed(1)} H${(x0 + w).toFixed(1)} L${(x0 + w - k).toFixed(1)},${(y0 + h).toFixed(1)} H${x0.toFixed(1)} Z`;
      break;
    }
    case "circle":
    case "dcircle":
    case "start":
    case "end": {
      const r = w / 2;
      if (shape === "start") {
        f.raw(
          `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c.line}"/>`,
          Y + r,
        );
        return;
      }
      f.raw(`<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${r.toFixed(1)}" ${st}/>`, Y + r);
      if (shape === "dcircle" || shape === "end") {
        const ri = shape === "dcircle" ? r - 10 * s : r * 0.55;
        f.raw(
          `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${ri.toFixed(1)}" fill="${shape === "end" ? c.line : "none"}" stroke="${stroke}" stroke-width="${lw}"/>`,
        );
      }
      return;
    }
    case "rect":
    case "round":
    case "stadium":
    case "subroutine":
    case "cylinder":
      d = `M${x0.toFixed(1)},${y0.toFixed(1)} h${w.toFixed(1)} v${h.toFixed(1)} h${(-w).toFixed(1)} Z`;
      break;
    default:
      assertNever(shape, "node shape");
  }
  f.raw(`<path d="${d}" ${st}/>`, y0 + h);
  if (shape === "subroutine") {
    const k = 14 * s;
    f.raw(
      `<path d="M${(x0 + k).toFixed(1)},${y0.toFixed(1)} v${h.toFixed(1)} M${(x0 + w - k).toFixed(1)},${y0.toFixed(1)} v${h.toFixed(1)}" stroke="${stroke}" stroke-width="${lw}"/>`,
    );
  }
  if (shape === "cylinder") {
    const k = 12 * s;
    f.raw(
      `<path d="M${x0.toFixed(1)},${(y0 + k).toFixed(1)} h${w.toFixed(1)} M${x0.toFixed(1)},${(y0 + 2 * k).toFixed(1)} h${w.toFixed(1)}" stroke="${stroke}" stroke-width="${lw}"/>`,
    );
  }
  if (kind === "hatch") {
    const pw = w - 36 * s;
    const ph = h - 36 * s;
    f.raw(
      `<rect x="${(X - pw / 2).toFixed(1)}" y="${(Y - ph / 2).toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="${c.bg}" stroke="${c.line}" stroke-width="${lw}"/>`,
    );
  }
}
