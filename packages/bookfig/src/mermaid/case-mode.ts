import type { CaseMode } from "../types.ts";

const CODEISH = /_|\w\.\w|\(\)|[a-z][A-Z]|::/;

export function applyCase(s: string, mode: CaseMode): string {
  if (mode === "keep") return s;
  if (mode === "upper") return s.toUpperCase();
  return CODEISH.test(s) ? s : s.toUpperCase();
}
