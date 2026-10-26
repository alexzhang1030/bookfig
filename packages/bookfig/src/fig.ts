import { Box, fmt, type Point } from "./geom.ts";
import { DEFAULT_FONT_FAMILY, PALETTE, type Palette } from "./palettes.ts";
import { escapeXml, textWidth, wrap } from "./text.ts";
import {
  assertNever,
  type BoxKind,
  type ElbowVia,
  type HeadStyle,
  type LegendKind,
  type SwatchKind,
  type TagAlign,
  type TagKind,
  type TextAnchor,
} from "./types.ts";

export type FigOptions = {
  width?: number;
  size?: number;
  ls?: number;
  lw?: number;
  pad?: number;
  fontFamily?: string;
};

export type BoxOptions = {
  kind?: BoxKind;
  size?: number;
  sub?: string;
  upper?: boolean;
  fill?: string;
  tag?: string;
  tagAlign?: TagAlign;
};

export type ChartSeries = {
  xs: number[];
  ys: number[];
  style?: "solid" | "dashed";
  area?: "dots" | "fill";
  step?: boolean;
};

export type LineChartOptions = {
  series: ChartSeries[];
  xlim: readonly [number, number];
  ylim: readonly [number, number];
  xticks?: number[];
  yticks?: number[];
  xlabel?: string;
  ylabel?: string;
  title?: string;
  tickFmt?: (n: number) => string;
  size?: number;
  legend?: ReadonlyArray<readonly [string, "solid" | "dashed"]>;
};

export type BarCompareOptions = {
  rows: ReadonlyArray<readonly [string, number[]]>;
  series: string[];
  title?: string;
  vmax?: number;
  unit?: string;
  size?: number;
  barH?: number;
  labelW?: number;
  fills?: SwatchKind[];
  showValues?: boolean;
  cells?: boolean;
  legend?: boolean;
};

export type TableOptions = {
  header: string[];
  rows: string[][];
  colW?: number[];
  size?: number;
  focusCol?: number;
  align?: TextAnchor[];
  pad?: number;
  title?: string;
  upperBody?: boolean;
};

const CODE_KEYWORDS = new Set([
  "def",
  "class",
  "return",
  "import",
  "from",
  "for",
  "in",
  "if",
  "else",
  "elif",
  "while",
  "with",
  "as",
  "async",
  "await",
  "lambda",
  "None",
  "True",
  "False",
  "yield",
  "try",
  "except",
]);

let figSeq = 0;

export class Fig {
  static readonly INSET = 22;

  W: number;
  readonly c: Palette;
  size: number;
  ls: number;
  readonly lw: number;
  readonly pad: number;
  readonly fontFamily: string;
  readonly warnings: string[] = [];
  maxY = 0;
  private readonly els: string[] = [];
  private readonly uid: string;

  constructor(opts: FigOptions = {}) {
    this.W = opts.width ?? 2000;
    this.c = PALETTE;
    this.size = opts.size ?? 34;
    this.ls = opts.ls ?? 2;
    this.lw = opts.lw ?? 3;
    this.pad = opts.pad ?? 70;
    this.fontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
    figSeq += 1;
    this.uid = `f${figSeq}`;
  }

  private add(s: string, bottom?: number): void {
    this.els.push(s);
    if (bottom !== undefined) this.maxY = Math.max(this.maxY, bottom);
  }

  private warn(msg: string): void {
    this.warnings.push(msg);
  }

  raw(svg: string, bottom?: number): void {
    this.add(svg, bottom);
  }

  text(
    x: number,
    y: number,
    s: string,
    size?: number,
    anchor: TextAnchor = "middle",
    color?: string,
    weight = "normal",
    upper = true,
    ls?: number,
    vcenter = true,
  ): number {
    const fs = size ?? this.size;
    const spacing = ls ?? this.ls;
    const drawn = upper ? s.toUpperCase() : s;
    const base = vcenter ? y + fs * 0.38 : y;
    const col = color ?? this.c.line;
    this.add(
      `<text x="${fmt(x)}" y="${fmt(base)}" text-anchor="${anchor}" font-size="${fs}" ` +
        `letter-spacing="${spacing}" font-weight="${weight}" fill="${col}">${escapeXml(drawn)}</text>`,
      base + fs * 0.15,
    );
    return textWidth(drawn, fs, spacing);
  }

  label(
    cx: number,
    cy: number,
    s: string,
    maxW: number,
    size?: number,
    color?: string,
    upper = true,
    lh = 1.3,
    weight = "normal",
    anchor: TextAnchor = "middle",
    maxH?: number,
  ): number {
    const fs = size ?? this.size;
    const drawn = upper ? s.toUpperCase() : s;
    const lines = wrap(drawn, maxW, fs, this.ls);
    for (const ln of lines) {
      const w = textWidth(ln, fs, this.ls);
      if (w > maxW + 1)
        this.warn(`text too wide: ${JSON.stringify(ln)} (${w.toFixed(0)} > ${maxW.toFixed(0)})`);
    }
    const h = lines.length * fs * lh;
    if (maxH !== undefined && h - fs * (lh - 1) > maxH) {
      this.warn(`text too tall: ${JSON.stringify(s)} (${h.toFixed(0)} > ${maxH.toFixed(0)})`);
    }
    const y0 = cy - ((lines.length - 1) * fs * lh) / 2;
    for (let i = 0; i < lines.length; i++) {
      this.text(cx, y0 + i * fs * lh, lines[i] ?? "", fs, anchor, color, weight, false);
    }
    return h;
  }

  line(pts: Point[], dashed = false, color?: string, width?: number, dash = "12 10"): void {
    if (pts.length === 0) return;
    const col = color ?? this.c.line;
    const w = width ?? this.lw;
    const d = "M" + pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" L");
    const da = dashed ? ` stroke-dasharray="${dash}"` : "";
    this.add(
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${da} stroke-linejoin="miter"/>`,
      Math.max(...pts.map((p) => p[1])),
    );
  }

  head(tip: Point, frm: Point, size = 18, color?: string): void {
    const ang = Math.atan2(tip[1] - frm[1], tip[0] - frm[0]);
    const pts: Point[] = [
      [tip[0] - size * Math.cos(ang - 0.6), tip[1] - size * Math.sin(ang - 0.6)],
      tip,
      [tip[0] - size * Math.cos(ang + 0.6), tip[1] - size * Math.sin(ang + 0.6)],
    ];
    this.line(pts, false, color);
  }

  circleHead(tip: Point, frm: Point, size = 18, color?: string): void {
    const ang = Math.atan2(tip[1] - frm[1], tip[0] - frm[0]);
    const r = Math.max(5, size * 0.42);
    const cx = tip[0] - r * Math.cos(ang);
    const cy = tip[1] - r * Math.sin(ang);
    const col = color ?? this.c.line;
    this.add(
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${this.c.bg}" stroke="${col}" stroke-width="${this.lw}"/>`,
      cy + r,
    );
  }

  crossHead(tip: Point, frm: Point, size = 18, color?: string): void {
    const ang = Math.atan2(tip[1] - frm[1], tip[0] - frm[0]);
    const s = Math.max(8, size * 0.55);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const cx = tip[0] - s * 0.2 * ux;
    const cy = tip[1] - s * 0.2 * uy;
    this.line(
      [
        [cx - s * Math.cos(ang + Math.PI / 4), cy - s * Math.sin(ang + Math.PI / 4)],
        [cx + s * Math.cos(ang + Math.PI / 4), cy + s * Math.sin(ang + Math.PI / 4)],
      ],
      false,
      color,
    );
    this.line(
      [
        [cx - s * Math.cos(ang - Math.PI / 4), cy - s * Math.sin(ang - Math.PI / 4)],
        [cx + s * Math.cos(ang - Math.PI / 4), cy + s * Math.sin(ang - Math.PI / 4)],
      ],
      false,
      color,
    );
  }

  arrow(
    p1: Point,
    p2: Point,
    style: "solid" | "dashed" = "solid",
    label?: string,
    labelSide: "above" | "below" = "above",
    heads: HeadStyle = "end",
    size = 26,
  ): void {
    this.polyline([p1, p2], style, heads);
    if (label) {
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      const off = labelSide === "above" ? -30 : 30;
      this.text(mx, my + off, label, size);
    }
  }

  polyline(pts: Point[], style: "solid" | "dashed" = "solid", heads: HeadStyle = "end"): void {
    this.line(pts, style === "dashed");
    if (pts.length < 2) return;
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const first = pts[0];
    const next = pts[1];
    if ((heads === "end" || heads === "both") && last && prev) this.head(last, prev);
    if ((heads === "start" || heads === "both") && first && next) this.head(first, next);
  }

  elbow(
    p1: Point,
    p2: Point,
    style: "solid" | "dashed" = "solid",
    via: ElbowVia = "h",
    mid?: number,
    heads: HeadStyle = "end",
  ): void {
    let pts: Point[];
    if (via === "h") {
      const m = mid ?? (p1[0] + p2[0]) / 2;
      pts = [p1, [m, p1[1]], [m, p2[1]], p2];
    } else if (via === "v") {
      const m = mid ?? (p1[1] + p2[1]) / 2;
      pts = [p1, [p1[0], m], [p2[0], m], p2];
    } else {
      assertNever(via, "elbow via");
    }
    pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1]?.[0] || p[1] !== pts[i - 1]?.[1]);
    this.polyline(pts, style, heads);
  }

  fanOut(
    src: Box,
    dsts: Box[],
    styles?: Array<"solid" | "dashed">,
    mid?: number,
    spread = 0,
    gap = 0,
  ): void {
    const n = dsts.length;
    const st = styles ?? Array.from({ length: n }, () => "solid" as const);
    const x0 = src.right + gap;
    const m = mid ?? (x0 + Math.min(...dsts.map((d) => d.x))) / 2;
    for (let i = 0; i < n; i++) {
      const d = dsts[i];
      const style = st[i] ?? "solid";
      if (!d) continue;
      let y0: number;
      let mm: number;
      if (spread) {
        y0 = src.cy + (i - (n - 1) / 2) * spread;
        mm = m + (i - (n - 1) / 2) * spread;
      } else {
        y0 = src.cy;
        mm = m;
      }
      this.elbow([x0, y0], [d.x - gap, d.cy], style, "h", mm);
    }
  }

  fanIn(srcs: Box[], dst: Box, styles?: Array<"solid" | "dashed">, mid?: number, gap = 0): void {
    const st = styles ?? Array.from({ length: srcs.length }, () => "solid" as const);
    const m = mid ?? (Math.max(...srcs.map((s) => s.right)) + dst.x) / 2;
    srcs.forEach((s, i) => {
      this.elbow([s.right + gap, s.cy], [dst.x - gap, dst.cy], st[i] ?? "solid", "h", m);
    });
  }

  box(x: number, y: number, w: number, h: number, label?: string, opts: BoxOptions = {}): Box {
    const kind = opts.kind ?? "component";
    const size = opts.size ?? this.size;
    const upper = opts.upper ?? true;
    const tagAlign = opts.tagAlign ?? "center";
    const c = this.c;
    const lw = this.lw;
    let txt = c.line;
    const fill = opts.fill;
    switch (kind) {
      case "component":
        this.add(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill ?? c.light}" stroke="${c.line}" stroke-width="${lw}"/>`,
        );
        break;
      case "plain":
        this.add(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill ?? c.bg}" stroke="${c.line}" stroke-width="${lw}"/>`,
        );
        break;
      case "group":
        this.add(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill ?? c.lighter}" stroke="${c.line}" stroke-width="${lw}" stroke-dasharray="10 8"/>`,
        );
        break;
      case "focus":
        this.add(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill ?? c.line}" stroke="${c.line}" stroke-width="${lw}"/>`,
        );
        txt = c.bg;
        break;
      case "dark":
        this.add(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.dark}" stroke="${c.dark}" stroke-width="${lw}"/>`,
        );
        txt = c.bg;
        break;
      case "hatch":
        this.add(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#hatch-${this.uid})" stroke="${c.line}" stroke-width="${lw}"/>`,
        );
        break;
      default:
        assertNever(kind, "box kind");
    }
    this.maxY = Math.max(this.maxY, y + h);
    if (opts.tag) {
      const ts = Math.trunc(size * 0.8);
      const tx =
        tagAlign === "center"
          ? x + w / 2
          : x + 30 + (textWidth(opts.tag.toUpperCase(), ts, this.ls) + 36) / 2;
      this.tag(tx, y, opts.tag, ts);
    }
    if (label) {
      const pad = 26;
      let maxw: number;
      if (kind === "hatch") {
        const s = upper ? label.toUpperCase() : label;
        const lines = wrap(s, w - 88, size, this.ls);
        const tw = Math.max(...lines.map((l) => textWidth(l, size, this.ls)));
        const ph = lines.length * size * 1.3 + 24 + (opts.sub ? size * 0.75 * 1.3 : 0);
        const pw = Math.min(w - 40, tw + 44);
        this.add(
          `<rect x="${fmt(x + (w - pw) / 2)}" y="${fmt(y + (h - ph) / 2)}" width="${fmt(pw)}" height="${fmt(ph)}" fill="${c.bg}" stroke="${c.line}" stroke-width="${lw}"/>`,
        );
        maxw = pw - 16;
      } else {
        maxw = w - 2 * pad;
      }
      if (opts.sub) {
        const ssize = Math.trunc(size * 0.75);
        const lhMain =
          wrap(upper ? label.toUpperCase() : label, maxw, size, this.ls).length * size * 1.3;
        const lhSub = wrap(opts.sub, maxw, ssize, this.ls).length * ssize * 1.3;
        const tot = lhMain + lhSub;
        const top = y + h / 2 - tot / 2;
        this.label(
          x + w / 2,
          top + lhMain / 2,
          label,
          maxw,
          size,
          txt,
          upper,
          1.3,
          "normal",
          "middle",
          h,
        );
        this.label(x + w / 2, top + lhMain + lhSub / 2, opts.sub, maxw, ssize, txt, upper);
      } else {
        this.label(
          x + w / 2,
          y + h / 2,
          label,
          maxw,
          size,
          txt,
          upper,
          1.3,
          "normal",
          "middle",
          h - 16,
        );
      }
    }
    return new Box(x, y, w, h);
  }

  group(
    x: number,
    y: number,
    w: number,
    h: number,
    title?: string,
    align: TagAlign = "left",
    fill = true,
  ): Box {
    return this.box(x, y, w, h, undefined, {
      kind: "group",
      fill: fill ? undefined : "none",
      tag: title,
      tagAlign: align,
    });
  }

  tag(
    cx: number,
    cy: number,
    s: string,
    size?: number,
    kind: TagKind = "component",
    upper = true,
    padX = 18,
  ): Box {
    const fs = size ?? Math.trunc(this.size * 0.8);
    const s2 = upper ? s.toUpperCase() : s;
    const w = textWidth(s2, fs, this.ls) + 2 * padX;
    const h = fs * 1.6;
    let fill: string;
    switch (kind) {
      case "component":
        fill = this.c.light;
        break;
      case "plain":
        fill = this.c.bg;
        break;
      case "focus":
        fill = this.c.line;
        break;
      default:
        assertNever(kind, "tag kind");
    }
    this.add(
      `<rect x="${fmt(cx - w / 2)}" y="${fmt(cy - h / 2)}" width="${fmt(w)}" height="${fmt(h)}" fill="${fill}" stroke="${this.c.line}" stroke-width="${this.lw}"/>`,
      cy + h / 2,
    );
    this.text(cx, cy, s2, fs, "middle", kind === "focus" ? this.c.bg : undefined, "normal", false);
    return new Box(cx - w / 2, cy - h / 2, w, h);
  }

  title(s: string, y = 110, size = 40): Box {
    return this.tag(this.W / 2, y, s, size, "component", true, 28);
  }

  legend(
    x: number,
    y: number,
    items: ReadonlyArray<readonly [string, LegendKind]>,
    size = 28,
    swatch = 34,
    gap = 22,
    cols = 1,
    colW = 360,
    frame = true,
  ): Box {
    const rows = Math.ceil(items.length / cols);
    const rh = swatch + gap;
    const W = cols * colW + 30;
    const H = rows * rh + gap;
    if (frame) {
      this.add(
        `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${this.c.bg}" stroke="${this.c.line}" stroke-width="2" stroke-dasharray="6 6"/>`,
      );
    }
    items.forEach(([lab, kind], i) => {
      const cx = x + 22 + (i % cols) * colW;
      const cy = y + gap + Math.floor(i / cols) * rh;
      let tx: number;
      if (kind.endsWith("_line")) {
        this.line(
          [
            [cx, cy + swatch / 2],
            [cx + swatch * 1.6, cy + swatch / 2],
          ],
          kind.startsWith("dashed"),
        );
        tx = cx + swatch * 1.6 + 16;
      } else {
        this.swatch(cx, cy, swatch, swatch, kind as SwatchKind);
        tx = cx + swatch + 16;
      }
      this.text(tx, cy + swatch / 2, lab, size, "start");
    });
    this.maxY = Math.max(this.maxY, y + H);
    return new Box(x, y, W, H);
  }

  private swatch(x: number, y: number, w: number, h: number, kind: SwatchKind): void {
    const c = this.c;
    let fill: string;
    switch (kind) {
      case "dark":
        fill = c.dark;
        break;
      case "line":
        fill = c.line;
        break;
      case "mid":
        fill = c.mid;
        break;
      case "light":
        fill = c.light;
        break;
      case "lighter":
        fill = c.lighter;
        break;
      case "hatch":
        fill = `url(#hatch-${this.uid})`;
        break;
      case "dots":
        fill = `url(#dots-${this.uid})`;
        break;
      default:
        assertNever(kind, "swatch kind");
    }
    this.add(
      `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${fill}" stroke="${c.line}" stroke-width="2"/>`,
      y + h,
    );
  }

  iconDoc(x: number, y: number, s = 90): Box {
    const c = this.c.line;
    const w = s * 0.78;
    const f = s * 0.25;
    this.add(
      `<path d="M${x},${y} h${w - f} l${f},${f} v${s - f} h${-w} Z M${x + w - f},${y} v${f} h${f}" fill="${this.c.light}" stroke="${c}" stroke-width="${this.lw}" stroke-linejoin="miter"/>`,
      y + s,
    );
    for (let i = 0; i < 3; i++) {
      const yy = y + s * (0.45 + i * 0.16);
      this.add(
        `<path d="M${x + w * 0.2},${fmt(yy)} h${fmt(w * 0.6)}" stroke="${c}" stroke-width="${this.lw}"/>`,
      );
    }
    return new Box(x, y, w, s);
  }

  iconPerson(x: number, y: number, s = 90): Box {
    const c = this.c.line;
    this.add(
      `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${this.c.light}" stroke="${c}" stroke-width="${this.lw}"/>` +
        `<circle cx="${x + s / 2}" cy="${y + s * 0.38}" r="${s * 0.16}" fill="none" stroke="${c}" stroke-width="${this.lw}"/>` +
        `<path d="M${x + s * 0.2},${y + s * 0.85} q${s * 0.3},${-s * 0.36} ${s * 0.6},0" fill="none" stroke="${c}" stroke-width="${this.lw}"/>`,
      y + s,
    );
    return new Box(x, y, s, s);
  }

  iconRobotArm(x: number, y: number, s = 90): Box {
    const c = this.c.line;
    const L = this.lw;
    this.add(
      `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${this.c.light}" stroke="${c}" stroke-width="${L}"/>` +
        `<path d="M${x + s * 0.2},${y + s * 0.85} h${s * 0.3} M${x + s * 0.35},${y + s * 0.85} L${x + s * 0.35},${y + s * 0.5} L${x + s * 0.7},${y + s * 0.3} M${x + s * 0.62},${y + s * 0.2} L${x + s * 0.78},${y + s * 0.2} M${x + s * 0.7},${y + s * 0.3} v${-s * 0.1}" fill="none" stroke="${c}" stroke-width="${L}"/>` +
        `<circle cx="${x + s * 0.35}" cy="${y + s * 0.5}" r="${s * 0.05}" fill="${c}"/>`,
      y + s,
    );
    return new Box(x, y, s, s);
  }

  iconWave(x: number, cy: number, w = 140, h = 80, n = 14): Box {
    for (let i = 0; i < n; i++) {
      const amp =
        (h / 2) * Math.abs(Math.sin(i * 0.9)) * (0.35 + 0.65 * Math.sin((Math.PI * i) / (n - 1)));
      const xx = x + (i * w) / (n - 1);
      this.add(
        `<path d="M${fmt(xx)},${fmt(cy - amp - 3)} V${fmt(cy + amp + 3)}" stroke="${this.c.line}" stroke-width="${this.lw}"/>`,
        cy + h / 2,
      );
    }
    return new Box(x, cy - h / 2, w, h);
  }

  bracket(x: number, y: number, h: number, side: "left" | "right" = "left", depth = 24): void {
    const d = side === "left" ? depth : -depth;
    this.line([
      [x + d, y],
      [x, y],
      [x, y + h],
      [x + d, y + h],
    ]);
  }

  private dotted(pts: Point[], width = 3): void {
    const d = "M" + pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" L");
    this.add(
      `<path d="${d}" fill="none" stroke="${this.c.line}" stroke-width="${width}" stroke-dasharray="0.1 10" stroke-linecap="round"/>`,
    );
  }

  lineChart(x: number, y: number, w: number, h: number, opts: LineChartOptions): Box {
    const c = this.c;
    const size = opts.size ?? 28;
    const tickFmt = opts.tickFmt ?? ((n: number) => String(n));
    let top = y;
    if (opts.title) {
      this.tag(x + w / 2, y + 30, opts.title, size + 4);
      top = y + 90;
    }
    const left = x + (opts.ylabel ? 110 : 70) + 40;
    const bottom = y + h - (opts.xlabel ? 110 : 60);
    const right = x + w - 30;
    const px = (v: number) =>
      left + ((v - opts.xlim[0]) / (opts.xlim[1] - opts.xlim[0])) * (right - left);
    const py = (v: number) =>
      bottom - ((v - opts.ylim[0]) / (opts.ylim[1] - opts.ylim[0])) * (bottom - top);
    for (const t of opts.yticks ?? []) {
      this.dotted(
        [
          [left, py(t)],
          [right, py(t)],
        ],
        2,
      );
      this.text(left - 18, py(t), tickFmt(t), size, "end", undefined, "normal", false);
    }
    for (const t of opts.xticks ?? []) {
      this.dotted(
        [
          [px(t), top],
          [px(t), bottom],
        ],
        2,
      );
      this.text(px(t), bottom + 34, tickFmt(t), size, "middle", undefined, "normal", false);
    }
    this.dotted(
      [
        [left, top],
        [left, bottom],
        [right, bottom],
      ],
      3,
    );
    for (const s of opts.series) {
      let pts: Point[] = s.xs.map((xv, i) => [px(xv), py(s.ys[i] ?? 0)]);
      if (s.step) {
        const st: Point[] = [];
        for (const p of pts) {
          if (st.length) st.push([p[0], st[st.length - 1]?.[1] ?? p[1]]);
          st.push(p);
        }
        pts = st;
      }
      if (s.area && pts[0] && pts[pts.length - 1]) {
        const fill = s.area === "dots" ? `url(#dots-${this.uid})` : c.light;
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (first && last) {
          const d =
            `M${fmt(first[0])},${bottom} L` +
            pts.map(([a, b]) => `${fmt(a)},${fmt(b)}`).join(" L") +
            ` L${fmt(last[0])},${bottom} Z`;
          this.add(`<path d="${d}" fill="${fill}" stroke="none"/>`);
        }
      }
      this.line(pts, s.style === "dashed", undefined, undefined, "10 8");
    }
    if (opts.xlabel) this.text((left + right) / 2, bottom + 90, opts.xlabel, size);
    if (opts.ylabel) {
      const cx = x + 40;
      const cy = (top + bottom) / 2;
      this.add(`<g transform="rotate(-90 ${cx} ${cy})">`);
      this.text(cx, cy, opts.ylabel, size);
      this.add("</g>");
    }
    if (opts.legend) {
      let lx =
        right -
        20 -
        opts.legend.reduce(
          (acc, [lab]) => acc + textWidth(lab.toUpperCase(), size, this.ls) + 110,
          0,
        );
      for (const [lab, kind] of opts.legend) {
        this.line(
          [
            [lx, top + 30],
            [lx + 56, top + 30],
          ],
          kind === "dashed",
        );
        lx += 72 + this.text(lx + 72, top + 30, lab, size, "start") + 38;
      }
    }
    this.maxY = Math.max(this.maxY, y + h);
    return new Box(left, top, right - left, bottom - top);
  }

  barCompare(x: number, y: number, w: number, opts: BarCompareOptions): Box {
    const c = this.c;
    const size = opts.size ?? 30;
    const barH = opts.barH ?? 34;
    const labelW = opts.labelW ?? 300;
    const fills = opts.fills ?? (["dark", "line", "mid", "light", "hatch"] satisfies SwatchKind[]);
    const showValues = opts.showValues ?? true;
    const cells = opts.cells ?? false;
    const legend = opts.legend ?? true;
    let top = y;
    if (opts.title) {
      this.add(
        `<rect x="${x}" y="${y}" width="${w}" height="80" fill="${c.light}" stroke="${c.line}" stroke-width="${this.lw}"/>`,
      );
      this.text(x + w / 2, y + 40, opts.title, size + 6);
      top = y + 80;
    }
    let legW = 0;
    if (legend) {
      legW =
        Math.max(...opts.series.map((s) => textWidth(s.toUpperCase(), size - 2, this.ls))) + 110;
    }
    const plotW = w - labelW - legW - (legend ? 50 : 0);
    const n = opts.series.length;
    const rowH = cells ? barH + 24 : n * (barH + 10) + 40;
    const H = opts.rows.length * rowH + 20;
    const frameW = w - legW - (legend ? 30 : 0);
    this.add(
      `<rect x="${x}" y="${top}" width="${frameW}" height="${H}" fill="${c.lighter}" stroke="${c.line}" stroke-width="${this.lw}"/>`,
    );
    const bx0 = x + labelW;
    this.line(
      [
        [bx0, top],
        [bx0, top + H],
      ],
      false,
      undefined,
      2,
    );
    const vmax =
      opts.vmax ??
      Math.max(
        ...opts.rows.map(([, v]) => (cells ? v.reduce((a, b) => a + b, 0) : Math.max(...v))),
      );
    const avail = plotW - (showValues && !cells ? 160 : 40);
    opts.rows.forEach(([lab, vals], i) => {
      const ry = top + 10 + i * rowH;
      if (i) {
        this.line(
          [
            [x, ry],
            [x + frameW, ry],
          ],
          false,
          undefined,
          1.5,
        );
      }
      this.text(x + labelW / 2, ry + rowH / 2, lab, size);
      if (cells) {
        const cw = avail / vmax;
        let cx = bx0 + 24;
        vals.forEach((v, k) => {
          const fill = fills[k] ?? "line";
          for (let t = 0; t < Math.trunc(v); t++) {
            this.swatch(cx + 3, ry + 12, cw - 6, barH, fill);
            cx += cw;
          }
        });
      } else {
        vals.forEach((v, k) => {
          const by = ry + 20 + k * (barH + 10);
          const bw = Math.max(2, (avail * v) / vmax);
          this.swatch(bx0 + 24, by, bw, barH, fills[k] ?? "line");
          if (showValues) {
            this.text(
              bx0 + 24 + bw + 14,
              by + barH / 2,
              `${v}${opts.unit ?? ""}`,
              size - 4,
              "start",
              undefined,
              "normal",
              false,
            );
          }
        });
      }
    });
    if (legend) {
      this.legend(
        x + w - legW,
        top,
        opts.series.map((s, k) => [s, fills[k] ?? "line"]),
        size - 2,
        34,
        22,
        1,
        legW - 30,
      );
    }
    this.maxY = Math.max(this.maxY, top + H);
    return new Box(x, y, w, top + H - y);
  }

  table(x: number, y: number, w: number, opts: TableOptions): Box {
    const c = this.c;
    const size = opts.size ?? 30;
    const pad = opts.pad ?? 18;
    const ncol = opts.header.length;
    let colW = opts.colW ?? Array.from({ length: ncol }, () => w / ncol);
    const sum = colW.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - w) > 1) colW = colW.map((cw) => (cw * w) / sum);
    const xs = [x];
    for (const cw of colW) xs.push((xs[xs.length - 1] ?? x) + cw);
    const align = opts.align ?? Array.from({ length: ncol }, () => "middle" as const);
    let top = y;
    if (opts.title) {
      this.tag(x + w / 2, y + 30, opts.title, size + 4);
      top = y + 80;
    }
    const lh = size * 1.3;
    const rowLines = (cells: string[], up: boolean): string[][] =>
      cells.map((s, k) =>
        wrap(up ? String(s).toUpperCase() : String(s), (colW[k] ?? 0) - 2 * pad, size, this.ls),
      );
    const allrows: Array<readonly [string[], boolean]> = [
      [opts.header, true],
      ...opts.rows.map((r) => [r, opts.upperBody ?? false] as const),
    ];
    const heights = allrows.map(
      ([r, up]) => Math.max(...rowLines(r, up).map((l) => l.length)) * lh + 2 * pad,
    );
    const H = heights.reduce((a, b) => a + b, 0);
    if (opts.focusCol !== undefined) {
      this.add(
        `<rect x="${xs[opts.focusCol]}" y="${top}" width="${colW[opts.focusCol]}" height="${H}" fill="${c.lighter}"/>`,
      );
    }
    this.add(`<rect x="${x}" y="${top}" width="${w}" height="${heights[0]}" fill="${c.light}"/>`);
    let yy = top;
    allrows.forEach(([cells, up], ri) => {
      const rh = heights[ri] ?? 0;
      rowLines(cells, up).forEach((lines, k) => {
        const a = align[k] ?? "middle";
        const xk = xs[k] ?? x;
        const xk1 = xs[k + 1] ?? x + w;
        const tx = a === "start" ? xk + pad : a === "end" ? xk1 - pad : (xk + xk1) / 2;
        const y0 = yy + rh / 2 - ((lines.length - 1) * lh) / 2;
        const wt = opts.focusCol === k && ri > 0 ? "bold" : "normal";
        const col = ri === 0 || opts.focusCol === k ? c.dark : c.line;
        lines.forEach((ln, j) => {
          this.text(tx, y0 + j * lh, ln, size, a, col, wt, false);
        });
      });
      yy += rh;
      if (ri < allrows.length - 1) {
        this.line(
          [
            [x, yy],
            [x + w, yy],
          ],
          false,
          undefined,
          ri === 0 ? 3 : 1.5,
        );
      }
    });
    for (let k = 1; k < ncol; k++) {
      const xk = xs[k];
      if (xk === undefined) continue;
      this.line(
        [
          [xk, top],
          [xk, top + H],
        ],
        false,
        undefined,
        1.5,
      );
    }
    this.add(
      `<rect x="${x}" y="${top}" width="${w}" height="${H}" fill="none" stroke="${c.line}" stroke-width="${this.lw}"/>`,
      top + H,
    );
    return new Box(x, y, w, top + H - y);
  }

  codeCard(
    x: number,
    y: number,
    w: number,
    code: string,
    size = 30,
    pad = 40,
    title?: string,
    lh = 1.45,
  ): Box {
    const c = this.c;
    const lines = code.replace(/^\n/, "").replace(/\n$/, "").split("\n");
    let top = y;
    if (title) {
      this.tag(
        x + 30 + (textWidth(title.toUpperCase(), size - 4, this.ls) + 36) / 2,
        y + 26,
        title,
        size - 4,
      );
      top = y + 26;
    }
    const H = lines.length * size * lh + 2 * pad;
    this.add(
      `<rect x="${x}" y="${top}" width="${w}" height="${H}" fill="${c.lighter}" stroke="${c.line}" stroke-width="1.5"/>`,
      top + H,
    );
    if (title) {
      this.tag(
        x + 30 + (textWidth(title.toUpperCase(), size - 4, this.ls) + 36) / 2,
        top,
        title,
        size - 4,
      );
    }
    const tok = /(#.*$|"[^"]*"|'[^']*'|\b\d+(?:\.\d+)?\b|\b\w+\b|\s+|.)/g;
    lines.forEach((ln, i) => {
      const by = top + pad + size * 0.9 + i * size * lh;
      let cx = x + pad;
      for (const m of ln.matchAll(tok)) {
        const t = m[0] ?? "";
        if (!t.trim()) {
          cx += textWidth(t, size, 0);
          continue;
        }
        let col = c.dark;
        let wt = "normal";
        if (t.startsWith("#")) col = c.line;
        else if (t[0] === '"' || t[0] === "'" || (t[0] !== undefined && t[0] >= "0" && t[0] <= "9"))
          col = c.line;
        else if (CODE_KEYWORDS.has(t)) wt = "bold";
        this.add(
          `<text x="${fmt(cx)}" y="${fmt(by)}" font-size="${size}" letter-spacing="0" font-weight="${wt}" fill="${col}">${escapeXml(t)}</text>`,
        );
        cx += textWidth(t, size, 0);
      }
      if (cx > x + w - 10) this.warn(`code line overflows card: ${JSON.stringify(ln)}`);
    });
    return new Box(x, y, w, top + H - y);
  }

  get hatchUrl(): string {
    return `url(#hatch-${this.uid})`;
  }

  get dotsUrl(): string {
    return `url(#dots-${this.uid})`;
  }

  svg(height?: number): string {
    const c = this.c;
    const H = Math.trunc(height ?? Math.ceil(this.maxY + this.pad));
    const W = this.W;
    const i = Fig.INSET;
    const hid = `hatch-${this.uid}`;
    const did = `dots-${this.uid}`;
    const defs =
      `<defs>` +
      `<pattern id="${hid}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<rect width="16" height="16" fill="${c.lighter}"/>` +
      `<line x1="0" y1="0" x2="0" y2="16" stroke="${c.line}" stroke-width="3"/>` +
      `</pattern>` +
      `<pattern id="${did}" width="14" height="14" patternUnits="userSpaceOnUse">` +
      `<rect width="14" height="14" fill="${c.lighter}"/>` +
      `<circle cx="7" cy="7" r="2.4" fill="${c.line}"/>` +
      `</pattern></defs>`;
    const style = `<style>text{font-family:'${this.fontFamily}'}</style>`;
    const crosses = [i, W - i]
      .flatMap((px) =>
        [i, H - i].map((py) => `<path d="M${px - i},${py}h${2 * i}M${px},${py - i}v${2 * i}"/>`),
      )
      .join("");
    const frame =
      `<rect x="0" y="0" width="${W}" height="${H}" fill="${c.bg}"/>` +
      `<rect x="${i}" y="${i}" width="${W - 2 * i}" height="${H - 2 * i}" fill="none" stroke="${c.line}" stroke-width="3" stroke-dasharray="8 8"/>` +
      `<g stroke="${c.line}" stroke-width="3">${crosses}</g>`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      defs +
      style +
      frame +
      "\n" +
      this.els.join("\n") +
      "</svg>"
    );
  }
}
