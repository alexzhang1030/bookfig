import { parse, type Font } from "opentype.js";

/**
 * resvg/fontdb matches the TTF *family* (`KaTeX_Main`) and ignores `font-style`.
 * The file full name / PostScript name (`KaTeX_Main-Regular`) is not a family, so
 * `font-family: KaTeX_Main-Regular, KaTeX_Main` misses Regular and falls through
 * to `KaTeX_Main`, which always resolves to Italic. Outline the glyphs here so
 * browser SVG and Node PNG never ask the renderer to pick a face.
 */
export const KATEX_FACES = [
  "KaTeX_AMS-Regular",
  "KaTeX_Caligraphic-Bold",
  "KaTeX_Caligraphic-Regular",
  "KaTeX_Fraktur-Bold",
  "KaTeX_Fraktur-Regular",
  "KaTeX_Main-Bold",
  "KaTeX_Main-BoldItalic",
  "KaTeX_Main-Italic",
  "KaTeX_Main-Regular",
  "KaTeX_Math-BoldItalic",
  "KaTeX_Math-Italic",
  "KaTeX_SansSerif-Bold",
  "KaTeX_SansSerif-Italic",
  "KaTeX_SansSerif-Regular",
  "KaTeX_Script-Regular",
  "KaTeX_Size1-Regular",
  "KaTeX_Size2-Regular",
  "KaTeX_Size3-Regular",
  "KaTeX_Size4-Regular",
  "KaTeX_Typewriter-Regular",
] as const;

export type KatexFace = (typeof KATEX_FACES)[number];

const FACE_URLS: Record<KatexFace, URL> = {
  "KaTeX_AMS-Regular": new URL("./ttf/KaTeX_AMS-Regular.ttf", import.meta.url),
  "KaTeX_Caligraphic-Bold": new URL("./ttf/KaTeX_Caligraphic-Bold.ttf", import.meta.url),
  "KaTeX_Caligraphic-Regular": new URL("./ttf/KaTeX_Caligraphic-Regular.ttf", import.meta.url),
  "KaTeX_Fraktur-Bold": new URL("./ttf/KaTeX_Fraktur-Bold.ttf", import.meta.url),
  "KaTeX_Fraktur-Regular": new URL("./ttf/KaTeX_Fraktur-Regular.ttf", import.meta.url),
  "KaTeX_Main-Bold": new URL("./ttf/KaTeX_Main-Bold.ttf", import.meta.url),
  "KaTeX_Main-BoldItalic": new URL("./ttf/KaTeX_Main-BoldItalic.ttf", import.meta.url),
  "KaTeX_Main-Italic": new URL("./ttf/KaTeX_Main-Italic.ttf", import.meta.url),
  "KaTeX_Main-Regular": new URL("./ttf/KaTeX_Main-Regular.ttf", import.meta.url),
  "KaTeX_Math-BoldItalic": new URL("./ttf/KaTeX_Math-BoldItalic.ttf", import.meta.url),
  "KaTeX_Math-Italic": new URL("./ttf/KaTeX_Math-Italic.ttf", import.meta.url),
  "KaTeX_SansSerif-Bold": new URL("./ttf/KaTeX_SansSerif-Bold.ttf", import.meta.url),
  "KaTeX_SansSerif-Italic": new URL("./ttf/KaTeX_SansSerif-Italic.ttf", import.meta.url),
  "KaTeX_SansSerif-Regular": new URL("./ttf/KaTeX_SansSerif-Regular.ttf", import.meta.url),
  "KaTeX_Script-Regular": new URL("./ttf/KaTeX_Script-Regular.ttf", import.meta.url),
  "KaTeX_Size1-Regular": new URL("./ttf/KaTeX_Size1-Regular.ttf", import.meta.url),
  "KaTeX_Size2-Regular": new URL("./ttf/KaTeX_Size2-Regular.ttf", import.meta.url),
  "KaTeX_Size3-Regular": new URL("./ttf/KaTeX_Size3-Regular.ttf", import.meta.url),
  "KaTeX_Size4-Regular": new URL("./ttf/KaTeX_Size4-Regular.ttf", import.meta.url),
  "KaTeX_Typewriter-Regular": new URL("./ttf/KaTeX_Typewriter-Regular.ttf", import.meta.url),
};

const cache = new Map<string, Font>();
let loading: Promise<void> | undefined;

type NodeFs = { readFileSync: (path: string) => Uint8Array };
type NodePath = { dirname: (p: string) => string; join: (...p: string[]) => string };
type NodeUrl = { fileURLToPath: (url: string) => string };
type NodeModule = { createRequire: (url: string | URL) => { resolve: (id: string) => string } };

function nodeBuiltin<T>(name: string): T | undefined {
  const proc = globalThis as { process?: { getBuiltinModule?: (id: string) => T } };
  return proc.process?.getBuiltinModule?.(name);
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function readFileUrlSync(url: URL): ArrayBuffer | undefined {
  if (url.protocol !== "file:") return undefined;
  const fs = nodeBuiltin<NodeFs>("fs");
  const urlMod = nodeBuiltin<NodeUrl>("url");
  if (!fs || !urlMod) return undefined;
  return asArrayBuffer(fs.readFileSync(urlMod.fileURLToPath(url.href)));
}

function readKatexPackageFont(face: string): ArrayBuffer | undefined {
  const fs = nodeBuiltin<NodeFs>("fs");
  const path = nodeBuiltin<NodePath>("path");
  const mod = nodeBuiltin<NodeModule>("module");
  if (!fs || !path || !mod) return undefined;
  try {
    const req = mod.createRequire(import.meta.url);
    const file = path.join(
      path.dirname(req.resolve("katex/package.json")),
      "dist/fonts",
      `${face}.ttf`,
    );
    return asArrayBuffer(fs.readFileSync(file));
  } catch {
    return undefined;
  }
}

function remember(face: string, buf: ArrayBuffer): Font {
  const font = parse(buf);
  cache.set(face, font);
  return font;
}

export function ensureKatexFontsSync(): void {
  if (cache.size === KATEX_FACES.length) return;
  for (const face of KATEX_FACES) {
    if (cache.has(face)) continue;
    const buf = readFileUrlSync(FACE_URLS[face]) ?? readKatexPackageFont(face);
    if (buf) remember(face, buf);
  }
}

export async function ensureKatexFonts(): Promise<void> {
  if (cache.size === KATEX_FACES.length) return;
  ensureKatexFontsSync();
  if (cache.size === KATEX_FACES.length) return;
  if (!loading) {
    loading = Promise.all(
      KATEX_FACES.map(async (face) => {
        if (cache.has(face)) return;
        const res = await fetch(FACE_URLS[face]);
        if (!res.ok) throw new Error(`KaTeX face ${face}: HTTP ${res.status}`);
        remember(face, await res.arrayBuffer());
      }),
    ).then(() => undefined);
  }
  await loading;
}

export function getKatexFont(face: string): Font | undefined {
  const hit = cache.get(face);
  if (hit) return hit;
  ensureKatexFontsSync();
  return cache.get(face);
}

export function outlineGlyph(
  face: string,
  text: string,
  x: number,
  y: number,
  size: number,
): string {
  if (!text) return "";
  const font = getKatexFont(face) ?? getKatexFont("KaTeX_Main-Regular");
  if (!font) return "";
  return font.getPath(text, x, y, size).toPathData(2);
}

export type KatexFaceRecord = {
  file: string;
  family: string;
  style: string;
  fullName: string;
  postScriptName: string;
};

export function listKatexFaceNames(): KatexFaceRecord[] {
  ensureKatexFontsSync();
  return KATEX_FACES.map((file) => {
    const font = cache.get(file);
    if (!font) {
      return { file, family: "", style: "", fullName: "", postScriptName: "" };
    }
    return {
      file,
      family: font.getEnglishName("fontFamily"),
      style: font.getEnglishName("fontSubfamily"),
      fullName: font.getEnglishName("fullName"),
      postScriptName: font.getEnglishName("postScriptName"),
    };
  });
}
