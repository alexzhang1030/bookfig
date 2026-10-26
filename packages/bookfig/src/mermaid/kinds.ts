import type { BoxKind } from "../types.ts";
import type { MermaidGraph } from "./model.ts";

const CLASS_KIND: Record<string, BoxKind> = {
  focus: "focus",
  highlight: "focus",
  active: "focus",
  hatch: "hatch",
  model: "hatch",
  compute: "hatch",
  dark: "dark",
  group: "group",
  optional: "group",
  dashed: "group",
  async: "group",
  plain: "plain",
  external: "plain",
};

function lum(hexcol: string): number {
  let h = hexcol.replace("#", "");
  if (h.length === 3) {
    const a = h.charAt(0);
    const b = h.charAt(1);
    const c = h.charAt(2);
    h = a + a + b + b + c + c;
  }
  if (h.length !== 6) return 1;
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function kindFromProps(props: string): BoxKind | undefined {
  const p = props.toLowerCase();
  if (p.includes("stroke-dasharray")) return "group";
  const m = /fill\s*:\s*(#[0-9a-f]{3,6})/.exec(p);
  if (m?.[1] && lum(m[1]) < 0.45) return "focus";
  return undefined;
}

export function resolveKinds(g: MermaidGraph): void {
  for (const [nid, st] of g.styles) {
    const n = g.nodes.get(nid);
    if (!n) continue;
    for (const [k, v] of st) {
      if (k === "class") n.classes.push(v);
    }
  }
  for (const n of g.nodes.values()) {
    let kind: BoxKind | undefined;
    for (const cl of n.classes) {
      kind = CLASS_KIND[cl.toLowerCase()] ?? kindFromProps(g.classdefs.get(cl) ?? "") ?? kind;
    }
    for (const [k, v] of g.styles.get(n.id) ?? []) {
      if (k === "style") kind = kindFromProps(v) ?? kind;
    }
    if (kind === undefined) {
      switch (n.shape) {
        case "stadium":
        case "circle":
        case "dcircle":
        case "end":
          kind = "plain";
          break;
        case "round":
        case "diamond":
          kind = "component";
          break;
        case "start":
          kind = "focus";
          break;
        case "rect":
        case "subroutine":
        case "cylinder":
        case "hexagon":
        case "flag":
        case "para":
          kind = "component";
          break;
        default: {
          const _never: never = n.shape;
          void _never;
          kind = "component";
        }
      }
    }
    n.kind = kind;
  }
}
