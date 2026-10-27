import { parse, type Font } from "opentype.js";

/** OFL Noto Sans Mono Regular (Latin subset). Family must match resvg / CSS / SVG. */
export const BUNDLED_FONT_FAMILY = "Noto Sans Mono";
export const FALLBACK_LATIN_EM = 0.6;

const FONT_URL = new URL("./fonts/NotoSansMono-Regular.ttf", import.meta.url);

let font: Font | undefined;
let bytes: Uint8Array | undefined;
let faceCss = "";
let loading: Promise<void> | undefined;

type NodeFs = { readFileSync: (path: string) => Uint8Array };
type NodeUrl = { fileURLToPath: (url: string) => string };

function nodeBuiltin<T>(name: string): T | undefined {
  const proc = globalThis as { process?: { getBuiltinModule?: (id: string) => T } };
  return proc.process?.getBuiltinModule?.(name);
}

function asArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function readFileUrlSync(url: URL): ArrayBuffer | undefined {
  if (url.protocol !== "file:") return undefined;
  const fs = nodeBuiltin<NodeFs>("fs");
  const urlMod = nodeBuiltin<NodeUrl>("url");
  if (!fs || !urlMod) return undefined;
  return asArrayBuffer(fs.readFileSync(urlMod.fileURLToPath(url.href)));
}

function toBase64(data: Uint8Array): string {
  const Buf = (globalThis as { Buffer?: { from: (d: Uint8Array) => { toString: (e: string) => string } } })
    .Buffer;
  if (Buf) return Buf.from(data).toString("base64");
  let s = "";
  for (const b of data) s += String.fromCharCode(b);
  return btoa(s);
}

function remember(buf: ArrayBuffer): Font {
  font = parse(buf);
  bytes = new Uint8Array(buf);
  const family = font.getEnglishName("fontFamily") || BUNDLED_FONT_FAMILY;
  faceCss = `@font-face{font-family:'${family}';src:url('data:font/ttf;base64,${toBase64(bytes)}') format('truetype')}`;
  return font;
}

export function ensureBookFontSync(): void {
  if (font) return;
  const buf = readFileUrlSync(FONT_URL);
  if (buf) remember(buf);
}

export async function ensureBookFont(): Promise<void> {
  if (font) return;
  ensureBookFontSync();
  if (font) return;
  if (!loading) {
    loading = (async () => {
      try {
        const res = await fetch(FONT_URL);
        if (res.ok) remember(await res.arrayBuffer());
      } catch {
        /* layout still has the 0.6em Latin fallback */
      }
    })();
  }
  await loading;
}

export function getBookFont(): Font | undefined {
  if (!font) ensureBookFontSync();
  return font;
}

export function bookFontFamily(): string {
  return getBookFont()?.getEnglishName("fontFamily") || BUNDLED_FONT_FAMILY;
}

export function bookFontFaceCss(): string {
  if (!faceCss) ensureBookFontSync();
  return faceCss;
}

export function bookFontPath(): string | undefined {
  const urlMod = nodeBuiltin<NodeUrl>("url");
  if (!urlMod || FONT_URL.protocol !== "file:") return undefined;
  return urlMod.fileURLToPath(FONT_URL.href);
}

export function bookFontFiles(): string[] {
  const path = bookFontPath();
  return path ? [path] : [];
}

export function glyphAdvanceEm(ch: string): number | undefined {
  const face = getBookFont();
  if (!face) return undefined;
  const idx = face.charToGlyphIndex(ch);
  if (!idx) return undefined;
  const adv = face.glyphs.get(idx)?.advanceWidth;
  if (adv === undefined) return undefined;
  return adv / face.unitsPerEm;
}

export function latinAdvanceEm(): number {
  return glyphAdvanceEm("A") ?? FALLBACK_LATIN_EM;
}

export function embedBookFont(svg: string): string {
  const css = bookFontFaceCss();
  if (!css || svg.includes("data:font/ttf;base64,")) return svg;
  return svg.replace("<style>", `<style>${css}`);
}

export function parseSvgFontFamily(svg: string): string {
  return /svg\{font-family:'([^']+)'\}/.exec(svg)?.[1] ?? "";
}

export function fontFromSvg(svg: string): Font | undefined {
  const b64 = /src:url\('data:font\/ttf;base64,([^']+)'\)/.exec(svg)?.[1];
  if (b64) {
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return parse(asArrayBuffer(raw));
  }
  const family = parseSvgFontFamily(svg);
  if (family === bookFontFamily() || family === BUNDLED_FONT_FAMILY) return getBookFont();
  return undefined;
}
