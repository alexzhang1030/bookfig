import type { CaseMode } from "../types.ts";
import { mapTextRuns } from "./math.ts";

const CODEISH = /_|\w\.\w|\(\)|[a-z][A-Z]|::/;

function applyPlain(s: string, mode: CaseMode): string {
  if (mode === "keep") return s;
  if (mode === "upper") return s.toUpperCase();
  return CODEISH.test(s) ? s : s.toUpperCase();
}

export function applyCase(s: string, mode: CaseMode): string {
  return mapTextRuns(s, (text) => applyPlain(text, mode));
}
