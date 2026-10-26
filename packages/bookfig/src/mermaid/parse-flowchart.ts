import type { HeadMark, LineStyle, NodeShape } from "../types.ts";
import { applyLinkStyles, emptyGraph, type MermaidEdge, type MermaidGraph } from "./model.ts";
import { cleanLabel } from "./preprocess.ts";
import { ID_SRC, matchAt, splitMax } from "./regex.ts";

const SHAPES: ReadonlyArray<readonly [string, string, NodeShape]> = [
  ["(((", ")))", "dcircle"],
  ["([", "])", "stadium"],
  ["[[", "]]", "subroutine"],
  ["[(", ")]", "cylinder"],
  ["((", "))", "circle"],
  ["{{", "}}", "hexagon"],
  ["[/", "/]", "para"],
  ["[\\", "\\]", "para"],
  ["[/", "\\]", "para"],
  ["[\\", "/]", "para"],
  ["[", "]", "rect"],
  ["(", ")", "round"],
  ["{", "}", "diamond"],
  [">", "]", "flag"],
];

const EDGE_RE = String.raw`([<ox])?(-{2,}>|-\.+->|-\.+-|={2,}>|-{2,}[ox](?![\w])|={2,}[ox](?![\w])|-{3,}|={3,}|~~~)`;
const EDGE_TEXT_RE = String.raw`([<ox])?(--|==|-\.)\s*([^\-=>.|\s][^|]*?)\s*(-{2,}[>ox]?|={2,}[>ox]?|\.-+[>ox]?)(?=\s|[\w\u4e00-\u9fff"]|$)`;

function looksLikeEdge(s: string): boolean {
  return /^([<ox])?(-{2,}|={2,}|-\.|~~~)/.test(s);
}

function nodeEndsAfter(s: string, pos: number): boolean {
  const rest = s.slice(pos).replace(/^\s+/, "");
  if (!rest) return true;
  if (rest.startsWith(":::") || rest.startsWith(";") || rest.startsWith("&")) return true;
  return looksLikeEdge(rest);
}

function findCloser(s: string, start: number, closer: string): number {
  let k = start;
  while (k < s.length) {
    const j = s.indexOf(closer, k);
    if (j < 0) return -1;
    if (nodeEndsAfter(s, j + closer.length)) return j;
    k = j + 1;
  }
  return -1;
}

function markOf(ch: string): HeadMark {
  switch (ch) {
    case ">":
    case "<":
      return "arrow";
    case "o":
      return "circle";
    case "x":
      return "cross";
    default:
      return "none";
  }
}

function parseNode(
  g: MermaidGraph,
  s: string,
  pos: number,
  curSub: string | undefined,
): [string | undefined, number] {
  const m = matchAt(ID_SRC, "", s, pos);
  if (!m) return [undefined, pos];
  const nid = m[0];
  pos = m.index + m[0].length;
  let label: string | undefined;
  let shape: NodeShape | undefined;
  for (const [op, cl, sh] of SHAPES) {
    if (s.startsWith(op, pos)) {
      const j = pos + op.length;
      const rest = s.slice(j).trimStart();
      let k = -1;
      if (rest.startsWith('"') || rest.startsWith("`")) {
        const qch = rest[0] ?? '"';
        const q = s.indexOf(qch, j);
        const q2 = q >= 0 ? s.indexOf(qch, q + 1) : -1;
        if (q2 < 0) continue;
        k = s.indexOf(cl, q2);
      } else {
        k = findCloser(s, j, cl);
      }
      if (k < 0) continue;
      label = s.slice(j, k);
      shape = sh;
      pos = k + cl.length;
      break;
    }
  }
  let cls: string | undefined;
  if (s.startsWith(":::", pos)) {
    const m2 = matchAt(ID_SRC, "", s, pos + 3);
    if (m2) {
      cls = m2[0];
      pos = m2.index + m2[0].length;
    }
  }
  let n = g.nodes.get(nid);
  if (!n) {
    n = {
      id: nid,
      label: g.subs.has(nid) ? (g.subs.get(nid)?.title ?? nid) : nid,
      shape: "rect",
      kind: undefined,
      sub: undefined,
      classes: [],
    };
    g.nodes.set(nid, n);
  }
  if (label !== undefined && shape !== undefined) {
    n.label = cleanLabel(label);
    n.shape = shape;
  }
  if (cls) n.classes.push(cls);
  if (curSub && n.sub === undefined && !g.subs.has(nid)) n.sub = curSub;
  return [nid, pos];
}

function parseEdge(s: string, pos: number): [Omit<MermaidEdge, "a" | "b"> | undefined, number] {
  for (const src of [EDGE_RE, EDGE_TEXT_RE]) {
    const m = matchAt(src, "", s, pos);
    if (!m) continue;
    let op: string;
    let text: string | undefined;
    if (src === EDGE_RE) {
      op = m[2] ?? "";
      text = undefined;
    } else {
      op = (m[2] ?? "") + (m[4] ?? "");
      text = m[3];
    }
    pos = m.index + m[0].length;
    const ws = /^\s*\|([^|]*)\|/.exec(s.slice(pos));
    if (ws) {
      text = ws[1];
      pos += ws[0].length;
    }
    const style: LineStyle =
      op === "~~~" ? "invis" : op.includes(".") ? "dashed" : op.includes("=") ? "thick" : "solid";
    const last = op[op.length - 1] ?? "";
    const prefix = m[1] ?? "";
    const head = markOf(last === ">" || last === "o" || last === "x" ? last : "");
    const tail = markOf(prefix);
    return [{ style, head, tail, label: text ? cleanLabel(text) : "" }, pos];
  }
  return [undefined, pos];
}

function parseStatement(g: MermaidGraph, s: string, curSub: string | undefined): boolean {
  let pos = 0;
  const groups: string[][] = [];
  const ops: Array<Omit<MermaidEdge, "a" | "b">> = [];
  while (true) {
    const grp: string[] = [];
    while (true) {
      while (pos < s.length && s[pos] === " ") pos += 1;
      const [nid, next] = parseNode(g, s, pos, curSub);
      pos = next;
      if (nid === undefined) return false;
      grp.push(nid);
      const amp = /^\s*&\s*/.exec(s.slice(pos));
      if (amp) {
        pos += amp[0].length;
        continue;
      }
      break;
    }
    groups.push(grp);
    while (pos < s.length && s[pos] === " ") pos += 1;
    if (pos >= s.length) break;
    const [e, next] = parseEdge(s, pos);
    pos = next;
    if (!e) return false;
    ops.push(e);
  }
  ops.forEach((e, i) => {
    const left = groups[i] ?? [];
    const right = groups[i + 1] ?? [];
    for (const a of left) {
      for (const b of right) {
        g.edges.push({ a, b, style: e.style, head: e.head, tail: e.tail, label: e.label });
      }
    }
  });
  return true;
}

export function parseFlowchart(lines: string[], g: MermaidGraph): void {
  const stack: string[] = [];
  for (const raw of lines) {
    for (const stmt of raw.split(/;\s*(?=\S|$)/).map((x) => x.trim())) {
      if (!stmt) continue;
      const low = stmt.toLowerCase();
      if (low.startsWith("subgraph")) {
        const rest = stmt.slice(8).trim();
        const named = /^([\w\u4e00-\u9fff]+)\s*\[(.*)\]\s*$/.exec(rest);
        let sid: string;
        let title: string;
        if (named) {
          sid = named[1] ?? `sg${g.subs.size}`;
          title = cleanLabel(named[2] ?? rest);
        } else if (rest.startsWith('"')) {
          title = cleanLabel(rest);
          sid = `sg${g.subs.size}`;
        } else {
          sid = rest.split(/\s+/)[0] || `sg${g.subs.size}`;
          title = cleanLabel(rest);
        }
        g.subs.set(sid, { id: sid, title, parent: stack[stack.length - 1] });
        stack.push(sid);
        continue;
      }
      if (low === "end") {
        stack.pop();
        continue;
      }
      if (low.startsWith("direction ")) continue;
      if (low.startsWith("classdef ")) {
        const parts = splitMax(stmt, 2);
        const names = (parts[1] ?? "").split(",");
        const props = parts[2] ?? "";
        for (const name of names) g.classdefs.set(name, props);
        continue;
      }
      if (low.startsWith("class ")) {
        const parts = stmt.split(/\s+/);
        if (parts.length >= 3) {
          const cls = parts[2] ?? "";
          for (const nid of (parts[1] ?? "").split(",")) {
            const n = g.nodes.get(nid);
            if (n) n.classes.push(cls);
            else {
              const cur = g.styles.get(nid) ?? [];
              cur.push(["class", cls]);
              g.styles.set(nid, cur);
            }
          }
        }
        continue;
      }
      if (low.startsWith("style ")) {
        const parts = splitMax(stmt, 2);
        const nid = parts[1] ?? "";
        const cur = g.styles.get(nid) ?? [];
        cur.push(["style", parts[2] ?? ""]);
        g.styles.set(nid, cur);
        continue;
      }
      if (low.startsWith("linkstyle")) {
        const parts = splitMax(stmt, 2);
        const spec = parts[2] ?? "";
        const ids = (parts[1] ?? "").split(",").map((x) => x.trim());
        if (ids[0]?.toLowerCase() === "default") g.linkDefault = spec;
        else {
          for (const id of ids) {
            const i = Number(id);
            if (Number.isFinite(i)) g.linkStyles.set(i, spec);
          }
        }
        continue;
      }
      if (
        low.startsWith("click") ||
        low.startsWith("href") ||
        low.startsWith("acctitle") ||
        low.startsWith("accdescr")
      ) {
        continue;
      }
      if (!parseStatement(g, stmt, stack[stack.length - 1])) {
        g.warnings.push(`unparsed: ${stmt}`);
      }
    }
  }
  applyLinkStyles(g);
}

export function parseFlowchartDocument(
  direction: string,
  lines: string[],
  title?: string,
): MermaidGraph {
  const g = emptyGraph(direction, title);
  parseFlowchart(lines, g);
  return g;
}
