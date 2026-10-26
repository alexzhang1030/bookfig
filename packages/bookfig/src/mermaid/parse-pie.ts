import { cleanLabel } from "./preprocess.ts";

export type PieSlice = { label: string; value: number };

export type PieModel = {
  title: string;
  showData: boolean;
  slices: PieSlice[];
  warnings: string[];
};

const SLICE = /^(?:"([^"]+)"|'([^']+)'|([^:]+))\s*:\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*$/;

export function parsePie(header: string, lines: string[]): PieModel {
  const warnings: string[] = [];
  const slices: PieSlice[] = [];
  let showData = /\bshowdata\b/i.test(header);
  let title = "";
  const headTitle = /\btitle\s+(.+)$/i.exec(header.replace(/\bshowdata\b/i, "").trim());
  if (headTitle?.[1]) title = cleanLabel(headTitle[1]);
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    const low = s.toLowerCase();
    if (low === "showdata") {
      showData = true;
      continue;
    }
    if (low.startsWith("title ")) {
      title = cleanLabel(s.slice(6));
      continue;
    }
    const m = SLICE.exec(s);
    if (m) {
      const label = cleanLabel(m[1] ?? m[2] ?? m[3] ?? "");
      const value = Number(m[4]);
      if (label && Number.isFinite(value)) slices.push({ label, value });
      else warnings.push(`unparsed: ${s}`);
      continue;
    }
    warnings.push(`unparsed: ${s}`);
  }
  return { title, showData, slices, warnings };
}
