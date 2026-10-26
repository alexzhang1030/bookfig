import type { BoxKind, HeadMark, LineStyle, NodeShape } from "../types.ts";

export type MermaidNode = {
  id: string;
  label: string;
  shape: NodeShape;
  kind: BoxKind | undefined;
  sub: string | undefined;
  classes: string[];
};

export type MermaidEdge = {
  a: string;
  b: string;
  style: LineStyle;
  head: HeadMark;
  tail: HeadMark;
  label: string;
};

export type MermaidSub = {
  id: string;
  title: string;
  parent: string | undefined;
};

export type StyleEntry = readonly ["class" | "style", string];

export type MermaidGraph = {
  direction: string;
  nodes: Map<string, MermaidNode>;
  edges: MermaidEdge[];
  subs: Map<string, MermaidSub>;
  classdefs: Map<string, string>;
  styles: Map<string, StyleEntry[]>;
  linkStyles: Map<number, string>;
  linkDefault: string | undefined;
  warnings: string[];
  title: string | undefined;
};

export function emptyGraph(direction = "TB", title?: string): MermaidGraph {
  return {
    direction,
    nodes: new Map(),
    edges: [],
    subs: new Map(),
    classdefs: new Map(),
    styles: new Map(),
    linkStyles: new Map(),
    linkDefault: undefined,
    warnings: [],
    title,
  };
}

export function ensureNode(
  g: MermaidGraph,
  id: string,
  sub: string | undefined,
  label?: string,
): MermaidNode {
  let n = g.nodes.get(id);
  if (!n) {
    n = { id, label: label ?? id, shape: "rect", kind: undefined, sub, classes: [] };
    g.nodes.set(id, n);
  }
  return n;
}

export function styleFromLinkSpec(spec: string): LineStyle | undefined {
  const p = spec.toLowerCase();
  if (p.includes("stroke-dasharray")) return "dashed";
  const w = /stroke-width\s*:\s*([\d.]+)/.exec(p);
  if (w?.[1] && Number(w[1]) >= 3) return "thick";
  return undefined;
}

export function applyLinkStyles(g: MermaidGraph): void {
  const def = g.linkDefault ? styleFromLinkSpec(g.linkDefault) : undefined;
  if (def) {
    for (const e of g.edges) e.style = def;
  }
  for (const [i, spec] of g.linkStyles) {
    const e = g.edges[i];
    const st = styleFromLinkSpec(spec);
    if (e && st) e.style = st;
  }
}
