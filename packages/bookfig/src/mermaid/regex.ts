export function matchAt(
  source: string,
  flags: string,
  s: string,
  pos: number,
): RegExpExecArray | null {
  const re = new RegExp(source, flags.includes("y") ? flags : `${flags}y`);
  re.lastIndex = pos;
  const m = re.exec(s);
  if (!m || m.index !== pos) return null;
  return m;
}

/** Like Python `str.split(None, maxsplit)`: keep the remainder intact. */
export function splitMax(s: string, maxsplit: number): string[] {
  const parts: string[] = [];
  let rest = s.replace(/^\s+/, "");
  for (let i = 0; i < maxsplit; i++) {
    const m = /^(\S+)\s+/.exec(rest);
    if (!m) break;
    parts.push(m[1] ?? "");
    rest = rest.slice(m[0].length);
  }
  if (rest) parts.push(rest.replace(/\s+$/, ""));
  return parts;
}

export const ID_SRC = String.raw`[\w\u4e00-\u9fff]+`;
