import type { BoxKind, LineStyle, NodeShape } from "../types.ts";

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
  head: boolean;
  tail: boolean;
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
