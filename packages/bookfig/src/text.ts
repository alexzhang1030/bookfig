import { ensureBookFontSync, glyphAdvanceEm, latinAdvanceEm } from "./book-font.ts";

/** East-Asian wide/fullwidth characters occupy 1em; Latin uses the bundled mono. */

const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0x303e],
  [0x3040, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

function charAdvanceEm(ch: string): number {
  return glyphAdvanceEm(ch) ?? (isWide(ch) ? 1 : latinAdvanceEm());
}

export function isWide(ch: string): boolean {
  const code = ch.codePointAt(0);
  if (code === undefined) return false;
  for (const [lo, hi] of WIDE_RANGES) {
    if (code >= lo && code <= hi) return true;
  }
  return false;
}

export function textWidth(s: string, size = 34, ls = 2): number {
  if (!s) return 0;
  ensureBookFontSync();
  let w = 0;
  let nChars = 0;
  for (const ch of s) {
    w += charAdvanceEm(ch) * size;
    nChars += 1;
  }
  return w + ls * Math.max(0, nChars - 1);
}

function tokens(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of s) {
    if (ch === " ") {
      if (buf) out.push(buf);
      buf = "";
      out.push(" ");
    } else if (isWide(ch)) {
      if (buf) out.push(buf);
      buf = "";
      out.push(ch);
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function wrap(s: string, maxW: number, size = 34, ls = 2): string[] {
  const lines: string[] = [];
  for (const para of s.split("\n")) {
    let cur = "";
    for (const t of tokens(para)) {
      const trial = cur + t;
      if (cur && textWidth(trial.replace(/ +$/, ""), size, ls) > maxW) {
        lines.push(cur.replace(/ +$/, ""));
        cur = t === " " ? "" : t;
      } else {
        cur = trial;
      }
    }
    lines.push(cur);
  }
  return lines;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
