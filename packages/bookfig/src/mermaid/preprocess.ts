import { mapTextRuns } from "./math.ts";

export function unescapeEntities(s: string): string {
  return s
    .replace(/#(\w+);/g, (_m, name: string) => {
      if (/^\d+$/.test(name)) return String.fromCodePoint(Number(name));
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      return named[name] ?? `&${name};`;
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n: string) =>
      String.fromCodePoint(Number.parseInt(n, 16)),
    );
}

function stripMarkdown(s: string): string {
  let out = s;
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/__([^_]+)__/g, "$1");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?-]|$)/g, "$1$2");
  out = out.replace(/`([^`]+)`/g, "$1");
  out = out.replace(/^#{1,6}\s+/gm, "");
  return out;
}

export function cleanLabel(s: string): string {
  let out = s.trim();
  if (
    out.length >= 2 &&
    out[0] === out[out.length - 1] &&
    (out[0] === '"' || out[0] === "'" || out[0] === "`")
  ) {
    out = out.slice(1, -1);
  }
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = unescapeEntities(out);
  out = mapTextRuns(out, (text) => stripMarkdown(text));
  return out
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
}

export function preprocess(text: string): { title: string | undefined; lines: string[] } {
  let body = text.replace(/\r\n/g, "\n");
  let title: string | undefined;
  const fm = /^\s*---\n(.*?)\n---\n/s.exec(body);
  if (fm) {
    const t = /^title:\s*(.+)$/m.exec(fm[1] ?? "");
    if (t?.[1]) title = t[1].trim().replace(/^["']|["']$/g, "");
    body = body.slice(fm[0].length);
  }
  body = body.replace(/%%\{.*?\}%%/gs, "");
  const lines: string[] = [];
  for (const raw of body.split("\n")) {
    const ln = raw.replace(/(^|\s)%%.*$/, "").replace(/\s+$/, "");
    if (ln.trim()) lines.push(ln);
  }
  return { title, lines };
}
