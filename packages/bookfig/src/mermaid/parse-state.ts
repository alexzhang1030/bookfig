import { cleanLabel } from "./preprocess.ts";
import { emptyGraph, ensureNode, type MermaidGraph } from "./model.ts";
import { splitMax } from "./regex.ts";

export function parseState(lines: string[], g: MermaidGraph): void {
  const stack: string[] = [];
  const scope = () => stack[stack.length - 1] ?? "root";
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    const low = s.toLowerCase();
    if (low.startsWith("direction ")) {
      g.direction = (s.split(/\s+/)[1] ?? "TB").toUpperCase();
      continue;
    }
    if (
      low.startsWith("note ") ||
      low.startsWith("end note") ||
      low.startsWith("classdef") ||
      low.startsWith("class ")
    ) {
      if (low.startsWith("classdef ")) {
        const p = splitMax(s, 2);
        g.classdefs.set(p[1] ?? "", p[2] ?? "");
      } else if (low.startsWith("class ")) {
        const p = s.split(/\s+/);
        const cls = p[2] ?? "";
        for (const nid of (p[1] ?? "").split(",")) {
          const n = g.nodes.get(nid);
          if (n) n.classes.push(cls);
        }
      }
      continue;
    }
    const asState = /^state\s+"([^"]+)"\s+as\s+(\w+)\s*(\{)?$/.exec(s);
    if (asState) {
      const id = asState[2] ?? "";
      const title = cleanLabel(asState[1] ?? id);
      ensureNode(g, id, stack[stack.length - 1], title);
      const n = g.nodes.get(id);
      if (n) n.label = title;
      if (asState[3]) {
        g.subs.set(id, { id, title, parent: stack[stack.length - 1] });
        g.nodes.delete(id);
        stack.push(id);
      }
      continue;
    }
    const st = /^state\s+(\w+)\s*(<<\w+>>)?\s*(\{)?$/.exec(s);
    if (st) {
      const id = st[1] ?? "";
      if (st[3]) {
        g.subs.set(id, { id, title: id, parent: stack[stack.length - 1] });
        stack.push(id);
      } else {
        ensureNode(g, id, stack[stack.length - 1]);
        if (st[2]?.includes("choice")) {
          const n = g.nodes.get(id);
          if (n) {
            n.shape = "diamond";
            n.label = "";
          }
        }
      }
      continue;
    }
    if (s === "}") {
      stack.pop();
      continue;
    }
    const edge =
      /^(\[\*\]|[\w\u4e00-\u9fff]+)\s*(-->)\s*(\[\*\]|[\w\u4e00-\u9fff]+)\s*(?::\s*(.*))?$/.exec(s);
    if (edge) {
      let a = edge[1] ?? "";
      let b = edge[3] ?? "";
      const lab = edge[4] ?? "";
      const sub = stack[stack.length - 1];
      if (a === "[*]") {
        a = `__start_${scope()}`;
        ensureNode(g, a, sub, "");
        const n = g.nodes.get(a);
        if (n) n.shape = "start";
      } else {
        ensureNode(g, a, sub);
      }
      if (b === "[*]") {
        b = `__end_${scope()}`;
        ensureNode(g, b, sub, "");
        const n = g.nodes.get(b);
        if (n) n.shape = "end";
      } else {
        ensureNode(g, b, sub);
      }
      g.edges.push({ a, b, style: "solid", head: "arrow", tail: "none", label: cleanLabel(lab) });
      continue;
    }
    const desc = /^([\w\u4e00-\u9fff]+)\s*:\s*(.+)$/.exec(s);
    if (desc) {
      const id = desc[1] ?? "";
      ensureNode(g, id, stack[stack.length - 1]);
      const n = g.nodes.get(id);
      if (n) n.label = cleanLabel(desc[2] ?? id);
      continue;
    }
    g.warnings.push(`unparsed: ${s}`);
  }
}

export function parseStateDocument(lines: string[], title?: string): MermaidGraph {
  const g = emptyGraph("TB", title);
  parseState(lines, g);
  return g;
}
