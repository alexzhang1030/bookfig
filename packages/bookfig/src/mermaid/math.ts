import katex, { type KatexOptions } from "katex";
import { PALETTE } from "../palettes.ts";
import { escapeXml, textWidth, wrap } from "../text.ts";

const LH = 1.3;
const LS = 2;

export type MathRun =
  | { kind: "text"; text: string }
  | { kind: "math"; tex: string; display: boolean };

export type LaidInline =
  | { kind: "text"; text: string; w: number; h: number }
  | { kind: "math"; tex: string; display: boolean; w: number; h: number; svg: string };

export type LaidLine = { inlines: LaidInline[]; w: number; h: number };

type KatexStyle = Record<string, string | undefined>;

type KatexDom = {
  children?: KatexDom[];
  classes?: string[];
  height?: number;
  depth?: number;
  width?: number;
  italic?: number;
  maxFontSize?: number;
  style?: KatexStyle;
  attributes?: Record<string, string>;
  text?: string;
  pathName?: string;
  alternate?: string;
  toMarkup?: () => string;
};

type KatexApi = typeof katex & {
  __renderToHTMLTree: (tex: string, opts?: KatexOptions) => KatexDom;
};

const ktx = katex as KatexApi;

function hasClass(node: KatexDom, name: string): boolean {
  return (node.classes ?? []).includes(name);
}

function parseEm(value: string | undefined): number {
  if (!value) return 0;
  const m = /^(-?[\d.]+)em$/i.exec(value.trim());
  if (m?.[1]) return Number(m[1]);
  const px = /^(-?[\d.]+)px$/i.exec(value.trim());
  if (px?.[1]) return Number(px[1]);
  return 0;
}

const SIZE_MULT = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.44, 1.728, 2.074, 2.488];

const FONT_MARK = new Set([
  "large-op",
  "small-op",
  "delimsizing",
  "mathcal",
  "cal",
  "mathbb",
  "amsrm",
  "mathfrak",
  "mathsf",
  "mathtt",
  "mathscr",
  "mathnormal",
  "mathdefault",
  "mathit",
  "textit",
  "mathrm",
  "mathbf",
  "textbf",
  "boldsymbol",
]);

function fontMarks(classes: string[] | undefined): string[] {
  return (classes ?? []).filter((c) => FONT_MARK.has(c));
}

/** Exact TTF full name first: resvg ignores font-style and otherwise picks KaTeX_Main-Italic. */
function fontFromClasses(classes: string[]): {
  family: string;
  face: string;
  weight: string;
  style: string;
} {
  const c = new Set(classes.filter(Boolean));
  const bold = c.has("mathbf") || c.has("textbf");
  if (c.has("large-op")) return { family: "KaTeX_Size2", face: "KaTeX_Size2-Regular", weight: "normal", style: "normal" };
  if (c.has("small-op")) return { family: "KaTeX_Size1", face: "KaTeX_Size1-Regular", weight: "normal", style: "normal" };
  if (c.has("delimsizing")) {
    const n = c.has("size4") ? 4 : c.has("size3") ? 3 : c.has("size2") ? 2 : 1;
    const family = `KaTeX_Size${n}`;
    return { family, face: `${family}-Regular`, weight: "normal", style: "normal" };
  }
  if (c.has("mathcal") || c.has("cal")) {
    return {
      family: "KaTeX_Caligraphic",
      face: bold ? "KaTeX_Caligraphic-Bold" : "KaTeX_Caligraphic-Regular",
      weight: bold ? "bold" : "normal",
      style: "normal",
    };
  }
  if (c.has("mathbb") || c.has("amsrm")) {
    return { family: "KaTeX_AMS", face: "KaTeX_AMS-Regular", weight: "normal", style: "normal" };
  }
  if (c.has("mathfrak")) {
    return {
      family: "KaTeX_Fraktur",
      face: bold ? "KaTeX_Fraktur-Bold" : "KaTeX_Fraktur-Regular",
      weight: bold ? "bold" : "normal",
      style: "normal",
    };
  }
  if (c.has("mathsf")) {
    if (c.has("textit") || c.has("mathsfit") || c.has("mathitsf")) {
      return { family: "KaTeX_SansSerif", face: "KaTeX_SansSerif-Italic", weight: "normal", style: "italic" };
    }
    return {
      family: "KaTeX_SansSerif",
      face: bold ? "KaTeX_SansSerif-Bold" : "KaTeX_SansSerif-Regular",
      weight: bold ? "bold" : "normal",
      style: "normal",
    };
  }
  if (c.has("mathtt")) {
    return { family: "KaTeX_Typewriter", face: "KaTeX_Typewriter-Regular", weight: "normal", style: "normal" };
  }
  if (c.has("mathscr")) {
    return { family: "KaTeX_Script", face: "KaTeX_Script-Regular", weight: "normal", style: "normal" };
  }
  if (c.has("boldsymbol")) {
    return { family: "KaTeX_Math", face: "KaTeX_Math-BoldItalic", weight: "bold", style: "italic" };
  }
  if (c.has("mathnormal") || c.has("mathdefault")) {
    return {
      family: "KaTeX_Math",
      face: bold ? "KaTeX_Math-BoldItalic" : "KaTeX_Math-Italic",
      weight: bold ? "bold" : "normal",
      style: "italic",
    };
  }
  if (c.has("mathit") || c.has("textit")) {
    return {
      family: "KaTeX_Main",
      face: bold ? "KaTeX_Main-BoldItalic" : "KaTeX_Main-Italic",
      weight: bold ? "bold" : "normal",
      style: "italic",
    };
  }
  return {
    family: "KaTeX_Main",
    face: bold ? "KaTeX_Main-Bold" : "KaTeX_Main-Regular",
    weight: bold ? "bold" : "normal",
    style: "normal",
  };
}

function childEm(node: KatexDom, em: number): number {
  const classes = node.classes ?? [];
  if (!classes.includes("katex-sizing") && !classes.includes("fontsize-ensurer")) return em;
  let from: number | undefined;
  let to: number | undefined;
  for (const name of classes) {
    const reset = /^reset-size(\d+)$/.exec(name);
    const size = /^size(\d+)$/.exec(name);
    if (reset?.[1]) from = Number(reset[1]);
    else if (size?.[1]) to = Number(size[1]);
  }
  if (!from || !to) return em;
  const a = SIZE_MULT[from - 1];
  const b = SIZE_MULT[to - 1];
  if (!a || !b) return em;
  return em * (b / a);
}

function ctor(node: KatexDom): string {
  return (node as { constructor?: { name?: string } }).constructor?.name ?? "";
}

function isSymbol(node: KatexDom): boolean {
  return (
    ctor(node) === "SymbolNode" || (typeof node.text === "string" && node.children === undefined)
  );
}

function isSvg(node: KatexDom): boolean {
  return ctor(node) === "SvgNode";
}

export function splitMath(s: string): MathRun[] {
  const runs: MathRun[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      runs.push({ kind: "text", text: buf });
      buf = "";
    }
  };
  while (i < s.length) {
    if (s[i] === "\\" && s[i + 1] === "$") {
      buf += "$";
      i += 2;
      continue;
    }
    if (s.startsWith("$$", i)) {
      const end = s.indexOf("$$", i + 2);
      if (end >= 0) {
        flush();
        const tex = s.slice(i + 2, end).trim();
        if (tex) runs.push({ kind: "math", tex, display: true });
        i = end + 2;
        continue;
      }
    }
    if (s[i] === "$") {
      const end = s.indexOf("$", i + 1);
      if (end > i + 1) {
        flush();
        const tex = s.slice(i + 1, end).trim();
        if (tex) runs.push({ kind: "math", tex, display: false });
        i = end + 1;
        continue;
      }
    }
    buf += s[i];
    i += 1;
  }
  flush();
  return runs.length ? runs : [{ kind: "text", text: s }];
}

export function hasMath(s: string): boolean {
  return splitMath(s).some((r) => r.kind === "math");
}

export function mapTextRuns(s: string, fn: (text: string) => string): string {
  return splitMath(s)
    .map((r) => {
      if (r.kind === "math") return r.display ? `$$${r.tex}$$` : `$${r.tex}$`;
      return fn(r.text);
    })
    .join("");
}

type Box = {
  w: number;
  h: number;
  d: number;
  parts: string[];
};

function emptyBox(): Box {
  return { w: 0, h: 0, d: 0, parts: [] };
}

function shift(box: Box, dx: number, dy: number): Box {
  if (!dx && !dy) return box;
  const t = `translate(${dx.toFixed(2)},${dy.toFixed(2)})`;
  return {
    w: box.w,
    h: box.h,
    d: box.d,
    parts: box.parts.length ? [`<g transform="${t}">${box.parts.join("")}</g>`] : [],
  };
}

function layoutNode(node: KatexDom, em: number, root: number, color: string, inherited: string[] = []): Box {
  const marks = [...inherited, ...fontMarks(node.classes)];
  if (hasClass(node, "katex-strut") || hasClass(node, "pstrut") || hasClass(node, "vlist-s")) {
    return emptyBox();
  }
  if (isSymbol(node)) {
    const text = node.text ?? "";
    if (!text || text === "\u200b") return emptyBox();
    const scale = node.maxFontSize && node.maxFontSize > 0 ? node.maxFontSize : em / root;
    const fs = root * scale;
    const { family, face, weight, style } = fontFromClasses([...marks, ...(node.classes ?? [])]);
    const stack = `${face}, ${family}`;
    const w = (node.width ?? 0) * fs;
    const italic = (node.italic ?? 0) * fs;
    const h = (node.height ?? 0) * fs;
    const d = (node.depth ?? 0) * fs;
    const dy = parseEm(node.style?.top) * em;
    const css = `font-family:${stack};font-weight:${weight};font-style:${style}`;
    const part = `<text x="0" y="${dy.toFixed(2)}" text-anchor="start" dominant-baseline="alphabetic" font-family="${stack}" font-size="${fs.toFixed(2)}" font-weight="${weight}" font-style="${style}" style="${css}" fill="${color}" stroke="none">${escapeXml(text)}</text>`;
    return { w: Math.max(w + italic, 0), h, d, parts: [part] };
  }
  if (ctor(node) === "PathNode") {
    const d = node.alternate ?? "";
    return { w: 0, h: 0, d: 0, parts: d ? [`<path d="${escapeXml(d)}" fill="${color}"/>`] : [] };
  }
  if (ctor(node) === "LineNode") {
    const a = node.attributes ?? {};
    const attrs = Object.entries(a)
      .map(([k, v]) => `${k}="${escapeXml(v)}"`)
      .join(" ");
    return { w: 0, h: 0, d: 0, parts: [`<line ${attrs} stroke="${color}"/>`] };
  }
  if (isSvg(node)) {
    const markup = node.toMarkup?.() ?? "";
    const attr = node.attributes ?? {};
    const h = parseEm(attr.height) * em || parseEm(node.style?.height) * em;
    const wHint = parseEm(attr.width);
    const w = (wHint > 50 ? 1.2 : wHint || parseEm(node.style?.minWidth) || 1) * em;
    const inner = markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const vb = attr.viewBox ?? "0 0 400000 1000";
    const svg = `<svg x="0" y="${(-h).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="${escapeXml(vb)}" preserveAspectRatio="${escapeXml(attr.preserveAspectRatio ?? "xMinYMin slice")}" fill="${color}" stroke="${color}">${inner}</svg>`;
    return { w, h, d: 0, parts: [svg] };
  }
  if (hasClass(node, "frac-line")) {
    const thick = parseEm(node.style?.borderBottomWidth) * em || 0.04 * em;
    return {
      w: 0,
      h: thick,
      d: 0,
      parts: [
        `<rect class="frac-line" x="0" y="${(-thick / 2).toFixed(2)}" width="__FRAC__" height="${thick.toFixed(2)}" fill="${color}"/>`,
      ],
    };
  }
  if (hasClass(node, "accent-body") && !hasClass(node, "accent-full")) {
    const inner = layoutFlow(node, em, root, color, true, marks);
    return { w: 0, h: inner.h, d: inner.d, parts: inner.parts };
  }
  if (hasClass(node, "mspace")) {
    return { w: parseEm(node.style?.marginRight) * em, h: 0, d: 0, parts: [] };
  }
  if (hasClass(node, "nulldelimiter")) {
    return { w: 0.12 * em, h: 0, d: 0, parts: [] };
  }
  if (hasClass(node, "vlist")) {
    return layoutVList(node, em, root, color, marks);
  }
  return layoutFlow(node, em, root, color, false, marks);
}

function layoutVList(
  node: KatexDom,
  em: number,
  root: number,
  color: string,
  inherited: string[] = [],
): Box {
  const kids = node.children ?? [];
  const placed: Box[] = [];
  let maxW = 0;
  for (const child of kids) {
    if (hasClass(child, "vlist-s") || hasClass(child, "pstrut")) continue;
    const pstrut = (child.children ?? []).find((c) => hasClass(c, "pstrut"));
    const top = parseEm(child.style?.top);
    const pH = parseEm(pstrut?.style?.height);
    const ml = parseEm(child.style?.marginLeft) * em;
    const mr = parseEm(child.style?.marginRight) * em;
    const inner = layoutFlow(child, em, root, color, false, inherited);
    const yB = (top + pH) * em;
    const shifted = shift(inner, ml, yB);
    shifted.w += ml + mr;
    placed.push(shifted);
    maxW = Math.max(maxW, shifted.w);
  }
  const h = (node.height ?? 0) * root;
  const d = (node.depth ?? 0) * root;
  const ruleW = Math.max(maxW, 1);
  const parts = placed.flatMap((b) => {
    const isRule = b.parts.some((p) => p.includes("__FRAC__"));
    const dx = isRule || b.w < 0.01 ? 0 : (maxW - b.w) / 2;
    const moved = dx ? shift(b, dx, 0) : b;
    return moved.parts.map((p) => p.replaceAll("__FRAC__", ruleW.toFixed(2)));
  });
  return { w: maxW, h, d, parts };
}

function layoutFlow(
  node: KatexDom,
  em: number,
  root: number,
  color: string,
  ignoreOwnWidth = false,
  inherited: string[] = [],
): Box {
  if (hasClass(node, "vlist-t") || hasClass(node, "vlist-t2")) {
    const rows = node.children ?? [];
    const first = rows[0];
    const body = first ? layoutFlow(first, em, root, color, false, inherited) : emptyBox();
    body.h = (node.height ?? 0) * root || body.h;
    body.d = (node.depth ?? 0) * root || body.d;
    return body;
  }
  if (hasClass(node, "vlist-r")) {
    const v = (node.children ?? []).find((c) => hasClass(c, "vlist"));
    if (v) return layoutVList(v, em, root, color, inherited);
  }
  if (hasClass(node, "vlist")) return layoutVList(node, em, root, color, inherited);

  const kids = node.children ?? [];
  if (!kids.length) {
    const w = (node.width ?? 0) * root || parseEm(node.style?.width) * em;
    return { w, h: (node.height ?? 0) * root, d: (node.depth ?? 0) * root, parts: [] };
  }
  let x = parseEm(node.style?.paddingLeft) * em + parseEm(node.style?.marginLeft) * em;
  let h = 0;
  let d = 0;
  const parts: string[] = [];
  for (const child of kids) {
    if (hasClass(child, "katex-strut") || hasClass(child, "pstrut") || hasClass(child, "vlist-s")) {
      continue;
    }
    const nextEm = childEm(child, em);
    const box = layoutNode(child, nextEm, root, color, inherited);
    const left = parseEm(child.style?.left) * em;
    const shifted = shift(box, x + left, 0);
    parts.push(...shifted.parts);
    x += box.w + parseEm(child.style?.marginRight) * em;
    h = Math.max(h, box.h);
    d = Math.max(d, box.d);
  }
  x += parseEm(node.style?.paddingRight) * em + parseEm(node.style?.marginRight) * em;
  if (!ignoreOwnWidth) {
    if ((node.height ?? 0) * root > h) h = (node.height ?? 0) * root;
    if ((node.depth ?? 0) * root > d) d = (node.depth ?? 0) * root;
  }
  return { w: Math.max(x, 0), h, d, parts };
}

function fallbackBox(tex: string, em: number, color: string): Box {
  const w = textWidth(tex, em, 0) + 8;
  return {
    w,
    h: em * 0.8,
    d: em * 0.2,
    parts: [
      `<text x="0" y="0" text-anchor="start" dominant-baseline="alphabetic" font-size="${em}" fill="${color}">${escapeXml(tex)}</text>`,
    ],
  };
}

export type MathGraphic = { svg: string; width: number; height: number };

export function renderKatex(
  tex: string,
  display: boolean,
  size: number,
  color = PALETTE.line,
): MathGraphic {
  const trimmed = tex.trim();
  if (!trimmed) return { svg: "", width: 0, height: 0 };
  try {
    const tree = ktx.__renderToHTMLTree(trimmed, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      output: "html",
      trust: false,
      errorColor: color,
    });
    const html = (tree.children ?? []).find((c) => hasClass(c, "katex-html")) ?? tree;
    const box = layoutNode(html, size, size, color);
    const pad = size * 0.12;
    const width = Math.max(1, box.w) + pad * 2;
    const height = Math.max(
      ((tree.height ?? 0) + (tree.depth ?? 0)) * size,
      box.h + box.d,
      size,
    ) + pad * 2;
    const baseline = pad + Math.max((tree.height ?? 0) * size, box.h);
    const shifted = shift(box, pad, baseline);
    const filled = shifted.parts.map((p) => p.replaceAll("__FRAC__", Math.max(box.w, 1).toFixed(2)));
    const svg = `<g data-tex="${escapeXml(trimmed)}" fill="${color}" stroke="none">${filled.join("")}</g>`;
    return { svg, width, height };
  } catch {
    const fb = fallbackBox(trimmed, size, color);
    return { svg: fb.parts.join(""), width: fb.w, height: fb.h + fb.d };
  }
}

export function laidBlockSize(lines: LaidLine[]): readonly [number, number] {
  const w = lines.reduce((m, l) => Math.max(m, l.w), 0);
  const h = lines.reduce((s, l) => s + l.h, 0);
  return [w, h];
}

export function layoutLabel(s: string, size: number, maxw: number): LaidLine[] {
  const runs = splitMath(s);
  if (!runs.some((r) => r.kind === "math")) {
    const out: LaidLine[] = [];
    for (const ln of s.split("\n")) {
      const wrapped = ln ? wrap(ln, maxw, size, LS) : [""];
      for (const t of wrapped) {
        const w = textWidth(t, size, LS);
        out.push({ inlines: [{ kind: "text", text: t, w, h: size * LH }], w, h: size * LH });
      }
    }
    return out.length
      ? out
      : [{ inlines: [{ kind: "text", text: "", w: 0, h: size * LH }], w: 0, h: size * LH }];
  }
  const lines: LaidLine[] = [];
  let cur: LaidInline[] = [];
  let curW = 0;
  const flush = () => {
    if (!cur.length) return;
    const h = Math.max(...cur.map((i) => i.h));
    const w = cur.reduce((a, i) => a + i.w, 0);
    lines.push({ inlines: cur, w, h });
    cur = [];
    curW = 0;
  };
  const pushText = (text: string) => {
    const w = textWidth(text, size, LS);
    const h = size * LH;
    if (curW > 0 && curW + w > maxw) flush();
    cur.push({ kind: "text", text, w, h });
    curW += w;
  };
  for (const run of runs) {
    if (run.kind === "math") {
      const g = renderKatex(run.tex, run.display, run.display ? size * 1.05 : size);
      if (curW > 0 && curW + g.width > maxw) flush();
      cur.push({
        kind: "math",
        tex: run.tex,
        display: run.display,
        w: g.width,
        h: Math.max(g.height, size * LH),
        svg: g.svg,
      });
      curW += g.width;
      continue;
    }
    const paras = run.text.split("\n");
    paras.forEach((para, pi) => {
      if (pi > 0) flush();
      if (!para) {
        if (!cur.length) pushText("");
        return;
      }
      const remain = Math.max(40, maxw - curW);
      const first = wrap(para, remain, size, LS);
      const head = first[0] ?? "";
      const rest = para.slice(head.length).replace(/^ +/, "");
      if (head) pushText(head);
      if (rest) {
        flush();
        for (const t of wrap(rest, maxw, size, LS)) pushText(t);
      }
    });
  }
  flush();
  return lines.length
    ? lines
    : [
        {
          inlines: [{ kind: "text", text: s, w: textWidth(s, size, LS), h: size * LH }],
          w: 0,
          h: size * LH,
        },
      ];
}
