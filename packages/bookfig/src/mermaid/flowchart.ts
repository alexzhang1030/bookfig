import type { CaseMode, LineStyle, NodeShape } from "../types.ts";
import { applyCase } from "./case-mode.ts";
import { layoutDot } from "./graphviz.ts";
import { resolveKinds } from "./kinds.ts";
import { linesFor, nodeGeometry } from "./metrics.ts";
import type { MermaidEdge, MermaidGraph } from "./model.ts";
import { blockSize, FS, Pen } from "./pen.ts";

type Pt = readonly [number, number];
type Geo = Map<string, readonly [string[], number, number]>;
type Eps = Array<readonly [string, string, string | undefined, string | undefined] | undefined>;
type Elbl = Array<readonly [number, string, string[], number, number]>;
type Rect = readonly [number, number, number, number];

function quote(s: string): string {
  return `"${s.replaceAll('"', '\\"')}"`;
}

function membersOf(g: MermaidGraph, sid: string): string[] {
  const out = [...g.nodes.values()].filter((n) => n.sub === sid).map((n) => n.id);
  for (const c of g.subs.values()) {
    if (c.parent === sid) out.push(...membersOf(g, c.id));
  }
  return out;
}

function subChain(g: MermaidGraph, sid: string | undefined): string[] {
  const ch: string[] = [];
  let cur = sid;
  while (cur) {
    ch.push(cur);
    cur = g.subs.get(cur)?.parent;
  }
  return ch;
}

function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(p[0] - last[0]) < 0.5 && Math.abs(p[1] - last[1]) < 0.5) continue;
    out.push(p);
  }
  let i = 1;
  while (i < out.length - 1) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if (!a || !b || !c) {
      i += 1;
      continue;
    }
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1)
      out.splice(i, 1);
    else i += 1;
  }
  return out;
}

function orthogonalize(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0] ?? [0, 0]];
  for (const p of pts.slice(1)) {
    const q = out[out.length - 1] ?? p;
    if (Math.abs(p[0] - q[0]) > 0.5 && Math.abs(p[1] - q[1]) > 0.5) {
      out.push(Math.abs(p[0] - q[0]) < Math.abs(p[1] - q[1]) ? [p[0], q[1]] : [q[0], p[1]]);
    }
    out.push(p);
  }
  return out;
}

function inside(
  shape: NodeShape | "rect",
  cx: number,
  cy: number,
  w: number,
  h: number,
  p: Pt,
  slack = 0,
): boolean {
  const dx = Math.abs(p[0] - cx);
  const dy = Math.abs(p[1] - cy);
  if (shape === "diamond") return dx / (w / 2) + dy / (h / 2) <= 1 + slack;
  if (shape === "circle" || shape === "dcircle" || shape === "start" || shape === "end") {
    return Math.hypot(dx, dy) <= (w / 2) * (1 + slack);
  }
  return dx <= (w / 2) * (1 + slack) && dy <= (h / 2) * (1 + slack);
}

function clipEnd(
  pts: Pt[],
  shape: NodeShape | "rect",
  cx: number,
  cy: number,
  w: number,
  h: number,
): Pt[] {
  const out = [...pts];
  while (
    out.length > 2 &&
    out[out.length - 2] &&
    inside(shape, cx, cy, w, h, out[out.length - 2] ?? [0, 0])
  ) {
    out.pop();
  }
  const p = out[out.length - 2];
  const q = out[out.length - 1];
  if (!p || !q) return out;
  if (inside(shape, cx, cy, w, h, p)) return out;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const tc = (cx - p[0]) * ux + (cy - p[1]) * uy;
  let far: Pt = [p[0] + ux * Math.max(tc, L), p[1] + uy * Math.max(tc, L)];
  if (!inside(shape, cx, cy, w, h, far)) {
    far = [p[0] + ux * tc, p[1] + uy * tc];
    if (!inside(shape, cx, cy, w, h, far)) return out;
  }
  let lo = 0;
  let hi = Math.hypot(far[0] - p[0], far[1] - p[1]);
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (inside(shape, cx, cy, w, h, [p[0] + ux * mid, p[1] + uy * mid])) hi = mid;
    else lo = mid;
  }
  out[out.length - 1] = [p[0] + ux * hi, p[1] + uy * hi];
  return out;
}

function clipClusterEnd(pts: Pt[], bb: Rect): Pt[] {
  const [x, y, w, h] = bb;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p && inside("rect", x + w / 2, y + h / 2, w, h, p)) {
      return clipEnd(pts.slice(0, i + 1), "rect", x + w / 2, y + h / 2, w, h);
    }
  }
  return pts;
}

async function layoutFlowchart(
  g: MermaidGraph,
  mode: CaseMode,
): Promise<{
  geo: Geo;
  pos: Map<string, Pt>;
  bbs: Map<string, Rect>;
  routes: Map<string, Pt[]>;
  elbl: Elbl;
  eps: Eps;
}> {
  resolveKinds(g);
  const geo: Geo = new Map();
  for (const [nid, n] of g.nodes) geo.set(nid, nodeGeometry(n, mode));

  const tree = new Map<string | undefined, string[]>();
  const addTree = (sub: string | undefined, line: string) => {
    const cur = tree.get(sub) ?? [];
    cur.push(line);
    tree.set(sub, cur);
  };
  for (const n of g.nodes.values()) addTree(n.sub, `"${n.id}"`);

  const elbl: Elbl = [];
  const eps: Eps = [];
  for (let i = 0; i < g.edges.length; i++) {
    const e = g.edges[i];
    if (!e) {
      eps.push(undefined);
      continue;
    }
    let a = e.a;
    let b = e.b;
    let ca: string | undefined;
    let cb: string | undefined;
    if (g.subs.has(a)) {
      ca = a;
      const mem = membersOf(g, a);
      a = mem[mem.length - 1] ?? "";
    }
    if (g.subs.has(b)) {
      cb = b;
      const mem = membersOf(g, b);
      b = mem[0] ?? "";
    }
    if (!a || !b) {
      g.warnings.push(`edge to empty subgraph skipped: ${e.a}->${e.b}`);
      eps.push(undefined);
      continue;
    }
    eps.push([a, b, ca, cb]);
    if (e.label) {
      const lab = applyCase(e.label, mode);
      const ls = linesFor(lab, 24, 320);
      const [tw, th] = blockSize(ls, 24);
      const nid = `__l${i}`;
      const sa = subChain(g, g.nodes.get(a)?.sub);
      const sb = subChain(g, g.nodes.get(b)?.sub);
      const common = sa.find((x) => sb.includes(x));
      addTree(
        common,
        `"${nid}" [width=${((tw + 30) / 72).toFixed(3)} height=${((th + 14) / 72).toFixed(3)}]`,
      );
      elbl.push([i, nid, ls, tw + 30, th + 14]);
    }
  }

  const nodeDecl = (nid: string): string => {
    const geoN = geo.get(nid);
    const n = g.nodes.get(nid);
    if (!geoN || !n) return `"${nid}"`;
    const [, w, h] = geoN;
    const shp =
      n.shape === "diamond"
        ? "diamond"
        : n.shape === "circle" || n.shape === "dcircle" || n.shape === "start" || n.shape === "end"
          ? "circle"
          : "box";
    return `"${nid}" [width=${(w / 72).toFixed(3)} height=${(h / 72).toFixed(3)} shape=${shp}]`;
  };

  const rankdir = g.direction === "TD" ? "TB" : g.direction;
  const lines: string[] = [
    `digraph G { rankdir=${rankdir}; splines=ortho; nodesep=0.55; ranksep=0.55; newrank=true;`,
    `fontname=${quote("Noto Sans Mono CJK SC")}; fontsize=26; node [shape=box fixedsize=true label=""]; edge [dir=none];`,
  ];
  for (const nid of g.nodes.keys()) lines.push(nodeDecl(nid));

  const emitSub = (sid: string | undefined): string[] => {
    const out: string[] = [];
    for (const c of g.subs.values()) {
      if (c.parent === sid) {
        const t = applyCase(c.title, mode);
        out.push(
          `subgraph "cluster_${c.id}" { label=${quote(`${t}    `)}; labeljust=l; margin=26; fontsize=36;`,
        );
        out.push(...emitSub(c.id));
        out.push("}");
      }
    }
    for (const n of tree.get(sid) ?? []) {
      const nid = n.split('"')[1] ?? "";
      out.push(geo.has(nid) ? `"${nid}";` : n);
    }
    return out;
  };
  lines.push(...emitSub(undefined));
  const labOf = new Map(elbl.map(([i, nid]) => [i, nid]));
  g.edges.forEach((e, i) => {
    const ep = eps[i];
    if (!ep) return;
    const [a, b] = ep;
    const lab = labOf.get(i);
    if (lab) lines.push(`"${a}" -> "${lab}"; "${lab}" -> "${b}";`);
    else lines.push(`"${a}" -> "${b}";`);
    void e;
  });
  lines.push("}");

  const lay = await layoutDot(lines.join("\n"));
  const H = Number(lay.bb.split(",")[3] ?? "0");
  const flip = (x: string, y: string): Pt => [Number(x), H - Number(y)];
  const pos = new Map<string, Pt>();
  const bbs = new Map<string, Rect>();
  for (const o of lay.objects) {
    if (o.name.startsWith("cluster_") && o.bb) {
      const [x0, y0, x1, y1] = o.bb.split(",").map(Number);
      bbs.set(o.name.slice(8), [
        x0 ?? 0,
        H - (y1 ?? 0),
        (x1 ?? 0) - (x0 ?? 0),
        (y1 ?? 0) - (y0 ?? 0),
      ]);
    } else if (o.pos) {
      const [x, y] = o.pos.split(",");
      if (x && y) pos.set(o.name, flip(x, y));
    }
  }
  const routes = new Map<string, Pt[]>();
  for (const e of lay.edges) {
    const t = lay.objects[e.tail]?.name;
    const h = lay.objects[e.head]?.name;
    if (!t || !h || !e.pos) continue;
    const pts = e.pos
      .split(/\s+/)
      .filter((p) => !p.startsWith("e,") && !p.startsWith("s,"))
      .map((p) => {
        const [x, y] = p.split(",");
        return x && y ? flip(x, y) : undefined;
      })
      .filter((p): p is Pt => p !== undefined);
    routes.set(`${t}\t${h}`, pts.length >= 4 ? pts.filter((_, i) => i % 3 === 0) : pts);
  }
  return { geo, pos, bbs, routes, elbl, eps };
}

function multiTag(pen: Pen, cx: number, cy: number, ls: string[], w: number, h: number): void {
  pen.shape("plain", "rect", cx, cy, w, h);
  pen.text(cx, cy, ls, 24);
}

type Seg = {
  i: number;
  u: string;
  v: string;
  first: boolean;
  last: boolean;
  e: MermaidEdge;
  ca?: string;
  cb?: string;
};

export async function drawFlowchart(g: MermaidGraph, pen: Pen, mode: CaseMode): Promise<void> {
  const { geo, pos, bbs, routes, elbl, eps } = await layoutFlowchart(g, mode);
  const depth = (sid: string | undefined): number =>
    sid === undefined ? 0 : 1 + depth(g.subs.get(sid)?.parent);
  [...bbs.entries()]
    .sort((a, b) => depth(a[0]) - depth(b[0]))
    .forEach(([sid, [x, y, w, h]]) => {
      const title = g.subs.get(sid)?.title;
      pen.group(x, y, w, h, title ? applyCase(title, mode) : undefined);
    });
  for (const [nid, n] of g.nodes) {
    const p = pos.get(nid);
    const ge = geo.get(nid);
    if (!p || !ge) continue;
    const [ls, w, h] = ge;
    pen.shape(n.kind ?? "component", n.shape, p[0], p[1], w, h);
    if (ls.length)
      pen.text(p[0], p[1], ls, FS, n.kind === "focus" || n.kind === "dark" ? "bg" : "line");
  }
  const lab = new Map(elbl.map(([i, nid, ls, w, h]) => [i, [nid, ls, w, h] as const]));

  const nshape = (nid: string): readonly [NodeShape | "rect", number, number, number, number] => {
    if (nid.startsWith("__l")) {
      for (const v of lab.values()) {
        if (v[0] === nid) {
          const p = pos.get(nid) ?? [0, 0];
          return ["rect", p[0], p[1], v[2], v[3]];
        }
      }
    }
    const ge = geo.get(nid);
    const n = g.nodes.get(nid);
    const p = pos.get(nid) ?? [0, 0];
    return [n?.shape ?? "rect", p[0], p[1], ge?.[1] ?? 0, ge?.[2] ?? 0];
  };

  const routeKey = (a: string, b: string) => `${a}\t${b}`;
  const segPts = (
    a: string,
    b: string,
    ca: string | undefined,
    cb: string | undefined,
    first: boolean,
    last: boolean,
  ): Pt[] | undefined => {
    let pts = routes.get(routeKey(a, b));
    if (!pts) return undefined;
    pts = orthogonalize(simplify(pts));
    if (pts.length < 2) return undefined;
    pts = clipEnd(pts, ...nshape(b));
    pts = clipEnd([...pts].reverse(), ...nshape(a)).reverse();
    if (last && cb) {
      const bb = bbs.get(cb);
      if (bb) pts = clipClusterEnd(pts, bb);
    }
    if (first && ca) {
      const bb = bbs.get(ca);
      if (bb) pts = clipClusterEnd([...pts].reverse(), bb).reverse();
    }
    return simplify(pts);
  };

  const rects = new Map<string, Rect>();
  for (const nid of pos.keys()) {
    if (geo.has(nid)) {
      const ge = geo.get(nid);
      const p = pos.get(nid);
      if (ge && p)
        rects.set(nid, [p[0] - ge[1] / 2, p[1] - ge[2] / 2, p[0] + ge[1] / 2, p[1] + ge[2] / 2]);
    } else {
      for (const v of lab.values()) {
        if (v[0] === nid) {
          const p = pos.get(nid);
          if (p)
            rects.set(nid, [p[0] - v[2] / 2, p[1] - v[3] / 2, p[0] + v[2] / 2, p[1] + v[3] / 2]);
        }
      }
    }
  }

  const d = g.direction === "TD" ? "TB" : g.direction;
  const ax = d === "TB" || d === "BT" ? 1 : 0;
  const sg = d === "BT" || d === "RL" ? -1 : 1;

  const ends = (nid: string): readonly [number, number, number] => {
    const r = rects.get(nid) ?? [0, 0, 0, 0];
    const lo = ax ? r[1] : r[0];
    const hi = ax ? r[3] : r[2];
    const p = pos.get(nid) ?? [0, 0];
    const cross = ax ? p[0] : p[1];
    return sg > 0 ? [hi, lo, cross] : [lo, hi, cross];
  };

  const segs: Seg[] = [];
  g.edges.forEach((e, i) => {
    const ep = eps[i];
    if (!ep) return;
    const [a, b, ca, cb] = ep;
    const L = lab.get(i);
    const parts = L
      ? ([
          [a, L[0], true, false],
          [L[0], b, false, true],
        ] as const)
      : ([[a, b, true, true]] as const);
    for (const [u, v, first, last] of parts) {
      segs.push({ i, u, v, first, last, e, ca: first ? ca : undefined, cb: last ? cb : undefined });
    }
  });

  const forward = (sgm: Seg): boolean => {
    if (sgm.ca || sgm.cb) return false;
    const [ou] = ends(sgm.u);
    const [, iv] = ends(sgm.v);
    return (iv - ou) * sg > 30;
  };
  const fw = segs.filter(forward);
  const outs = new Map<string, Seg[]>();
  const ins = new Map<string, Seg[]>();
  for (const sgm of fw) {
    const o = outs.get(sgm.u) ?? [];
    o.push(sgm);
    outs.set(sgm.u, o);
    const inn = ins.get(sgm.v) ?? [];
    inn.push(sgm);
    ins.set(sgm.v, inn);
  }

  const used: Array<readonly [number, number, number, string]> = [];
  const P = (main: number, cross: number): Pt => (ax ? [cross, main] : [main, cross]);
  const hits = (pts: Pt[], skip: Set<string>): boolean => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      if (!a || !b) continue;
      const bx0 = Math.min(a[0], b[0]);
      const bx1 = Math.max(a[0], b[0]);
      const by0 = Math.min(a[1], b[1]);
      const by1 = Math.max(a[1], b[1]);
      for (const [nid, r] of rects) {
        if (skip.has(nid)) continue;
        if (bx0 < r[2] + 6 && bx1 > r[0] - 6 && by0 < r[3] + 6 && by1 > r[1] - 6) return true;
      }
    }
    return false;
  };

  const ownerKey = (o: readonly [string, ...string[]]): string => o.join(":");

  const elbow = (sgm: Seg): Pt[] | undefined => {
    const { u, v } = sgm;
    const [ou, , cu] = ends(u);
    const [, iv, cv0] = ends(v);
    let cv = cv0;
    const grp = ins.get(v) ?? [];
    if (grp.length > 1 && new Set(grp.map((x) => x.e.style)).size > 1) {
      const sorted = [...grp].sort((a, b) => ends(a.u)[2] - ends(b.u)[2]);
      const k = sorted.indexOf(sgm);
      cv = cv + (k - (grp.length - 1) / 2) * 28;
    }
    const ru = rects.get(u);
    const rv = rects.get(v);
    if (!ru || !rv) return undefined;
    const loU = ax ? ru[0] : ru[1];
    const hiU = ax ? ru[2] : ru[3];
    const loV = ax ? rv[0] : rv[1];
    const hiV = ax ? rv[2] : rv[3];
    if (
      Math.abs(cu - cv) < 40 &&
      Math.max(loU, loV) + 20 < Math.min(hiU, hiV) - 20 &&
      (outs.get(u) ?? []).length < 2
    ) {
      const c = loU + 20 < cv && cv < hiU - 20 ? cv : cu;
      const pts = [P(ou, c), P(iv, c)];
      if (!hits(pts, new Set([u, v]))) return pts;
    }
    if (Math.abs(cu - cv) < 1) {
      const pts = [P(ou, cu), P(iv, cu)];
      return hits(pts, new Set([u, v])) ? undefined : pts;
    }
    let mid: number;
    let owner: readonly [string, ...string[]];
    if ((outs.get(u) ?? []).length > 1) {
      const gap = Math.min(...(outs.get(u) ?? []).map((x) => Math.abs(ends(x.v)[1] - ou)));
      mid = ou + (sg * gap) / 2;
      owner = ["o", u];
    } else if ((ins.get(v) ?? []).length > 1) {
      const gap = Math.min(...(ins.get(v) ?? []).map((x) => Math.abs(iv - ends(x.u)[0])));
      mid = iv - (sg * gap) / 2;
      owner = ["i", v, sgm.e.style];
    } else {
      mid = (ou + iv) / 2;
      owner = ["s", u, v];
    }
    const lo = Math.min(cu, cv);
    const hi = Math.max(cu, cv);
    for (const off of [0, 18, -18, 36, -36]) {
      const m = mid + off;
      if (!(Math.min(ou, iv) + 12 < m && m < Math.max(ou, iv) - 12)) continue;
      if (
        used.some(
          ([t, l2, h2, o]) => Math.abs(t - m) < 10 && o !== ownerKey(owner) && lo < h2 && hi > l2,
        )
      )
        continue;
      const pts = [P(ou, cu), P(m, cu), P(m, cv), P(iv, cv)];
      if (hits(pts, new Set([u, v]))) continue;
      used.push([m, lo, hi, ownerKey(owner)]);
      return pts;
    }
    return undefined;
  };

  for (const sgm of segs) {
    const { u, v, e } = sgm;
    let pts = fw.includes(sgm) ? elbow(sgm) : undefined;
    if (pts) {
      pts = clipEnd(pts, ...nshape(v));
      pts = clipEnd([...pts].reverse(), ...nshape(u)).reverse();
    }
    if (!pts) pts = segPts(u, v, sgm.ca, sgm.cb, sgm.first, sgm.last);
    if (!pts) {
      g.warnings.push(`no route for ${u}->${v}`);
      continue;
    }
    pen.line(pts, e.style);
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const first = pts[0];
    const next = pts[1];
    if (sgm.last && e.head && last && prev) pen.head(last, prev, e.style);
    if (sgm.first && e.tail && first && next) pen.head(first, next, e.style);
  }
  for (const [nid, ls, w, h] of lab.values()) {
    const p = pos.get(nid);
    if (!p) continue;
    if (ls.length === 1 && ls[0] !== undefined) pen.tag(p[0], p[1], ls[0], 24);
    else multiTag(pen, p[0], p[1], ls, w, h);
  }
}

export type { LineStyle };
