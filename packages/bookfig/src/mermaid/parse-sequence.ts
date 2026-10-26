import { cleanLabel } from "./preprocess.ts";

export type SeqAlias = readonly [label: string, kind: "participant" | "actor"];

export type SeqEvent =
  | readonly ["msg", string, string, string, string]
  | readonly ["note", string, string[], string]
  | readonly ["begin", string, string]
  | readonly ["else", string, string]
  | readonly ["end"];

const SEQ_MSG =
  /^(.+?)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-]?)\s*(.+?)\s*:\s*(.*)$/;
const BLOCKS = new Set(["loop", "alt", "opt", "par", "critical", "break", "rect"]);

export type SequenceModel = {
  parts: string[];
  alias: Map<string, SeqAlias>;
  events: SeqEvent[];
  auto: boolean;
  warnings: string[];
};

export function parseSequence(lines: string[]): SequenceModel {
  const parts: string[] = [];
  const alias = new Map<string, SeqAlias>();
  const events: SeqEvent[] = [];
  const warnings: string[] = [];
  const addPart = (name: string): string => {
    const n = name.trim();
    if (!alias.has(n)) {
      alias.set(n, [n, "participant"]);
      parts.push(n);
    }
    return n;
  };
  let auto = false;
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    const low = s.toLowerCase();
    const part = /^(?:create\s+)?(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i.exec(s);
    if (part) {
      const nid = (part[2] ?? "").trim();
      if (!alias.has(nid)) parts.push(nid);
      const kind = part[1]?.toLowerCase() === "actor" ? "actor" : "participant";
      alias.set(nid, [cleanLabel(part[3] ?? nid), kind]);
      continue;
    }
    if (low.startsWith("autonumber")) {
      auto = true;
      continue;
    }
    if (
      low.startsWith("activate ") ||
      low.startsWith("deactivate ") ||
      low.startsWith("destroy ") ||
      low.startsWith("title") ||
      low.startsWith("box ") ||
      low.startsWith("links ") ||
      low.startsWith("link ")
    ) {
      continue;
    }
    const note = /^note\s+(left of|right of|over)\s+([^:]+):\s*(.*)$/i.exec(s);
    if (note) {
      const who = (note[2] ?? "").split(",").map((x) => addPart(x));
      events.push(["note", (note[1] ?? "over").toLowerCase(), who, cleanLabel(note[3] ?? "")]);
      continue;
    }
    const w = low.split(/\s+/)[0] ?? "";
    if (BLOCKS.has(w)) {
      events.push(["begin", w, cleanLabel(s.slice(w.length))]);
      continue;
    }
    if (w === "else" || w === "and" || w === "option") {
      events.push(["else", w, cleanLabel(s.slice(w.length))]);
      continue;
    }
    if (low === "end") {
      events.push(["end"]);
      continue;
    }
    const msg = SEQ_MSG.exec(s);
    if (msg) {
      const a = addPart(msg[1] ?? "");
      const b = addPart(msg[4] ?? "");
      events.push(["msg", a, b, msg[2] ?? "->", cleanLabel(msg[5] ?? "")]);
      continue;
    }
    warnings.push(`unparsed: ${s}`);
  }
  return { parts, alias, events, auto, warnings };
}
