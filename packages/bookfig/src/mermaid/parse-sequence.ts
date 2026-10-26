import { cleanLabel } from "./preprocess.ts";

export type SeqAlias = readonly [label: string, kind: "participant" | "actor"];

export type SeqAct = "" | "+" | "-";

export type SeqEvent =
  | readonly ["msg", string, string, string, string, SeqAct]
  | readonly ["note", string, string[], string]
  | readonly ["begin", string, string]
  | readonly ["else", string, string]
  | readonly ["end"]
  | readonly ["activate", string]
  | readonly ["deactivate", string];

export type SeqBox = { title: string; members: string[] };

const SEQ_MSG =
  /^(.+?)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-]?)\s*(.+?)\s*:\s*(.*)$/;
const BLOCKS = new Set(["loop", "alt", "opt", "par", "critical", "break", "rect"]);

export type SequenceModel = {
  parts: string[];
  alias: Map<string, SeqAlias>;
  events: SeqEvent[];
  boxes: SeqBox[];
  auto: boolean;
  warnings: string[];
};

function boxTitle(rest: string): string {
  let s = rest.trim();
  s = s.replace(/^rgba?\([^)]*\)\s*/i, "");
  s = s.replace(/^#[0-9a-fA-F]{3,8}\s*/, "");
  const tok = /^([A-Za-z]+)\s+(.*)$/.exec(s);
  if (
    tok?.[1] &&
    /^(transparent|aqua|azure|beige|bisque|brown|coral|crimson|cyan|gold|gray|grey|green|ivory|khaki|lime|linen|navy|olive|orange|pink|plum|purple|red|salmon|sienna|silver|snow|tan|teal|tomato|violet|wheat|yellow|white|black|blue|lightyellow|lightblue|lightgreen|lightgray|lightgrey)$/i.test(
      tok[1],
    )
  ) {
    s = tok[2] ?? "";
  }
  return cleanLabel(s);
}

export function parseSequence(lines: string[]): SequenceModel {
  const parts: string[] = [];
  const alias = new Map<string, SeqAlias>();
  const events: SeqEvent[] = [];
  const boxes: SeqBox[] = [];
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
  type Ctx = { kind: "block" } | { kind: "box"; box: SeqBox };
  const stack: Ctx[] = [];
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
      const top = stack[stack.length - 1];
      if (top?.kind === "box" && !top.box.members.includes(nid)) top.box.members.push(nid);
      continue;
    }
    if (low.startsWith("autonumber")) {
      auto = true;
      continue;
    }
    if (low.startsWith("activate ")) {
      events.push(["activate", addPart(s.slice(9))]);
      continue;
    }
    if (low.startsWith("deactivate ")) {
      events.push(["deactivate", addPart(s.slice(11))]);
      continue;
    }
    if (low.startsWith("box")) {
      const box: SeqBox = { title: boxTitle(s.slice(3)), members: [] };
      boxes.push(box);
      stack.push({ kind: "box", box });
      continue;
    }
    if (low === "end") {
      const top = stack[stack.length - 1];
      if (top?.kind === "box") {
        stack.pop();
        continue;
      }
      if (top?.kind === "block") stack.pop();
      events.push(["end"]);
      continue;
    }
    if (
      low.startsWith("destroy ") ||
      low.startsWith("title") ||
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
      stack.push({ kind: "block" });
      events.push(["begin", w, cleanLabel(s.slice(w.length))]);
      continue;
    }
    if (w === "else" || w === "and" || w === "option") {
      events.push(["else", w, cleanLabel(s.slice(w.length))]);
      continue;
    }
    const msg = SEQ_MSG.exec(s);
    if (msg) {
      const a = addPart(msg[1] ?? "");
      const b = addPart(msg[4] ?? "");
      const act = (msg[3] === "+" || msg[3] === "-" ? msg[3] : "") as SeqAct;
      events.push(["msg", a, b, msg[2] ?? "->", cleanLabel(msg[5] ?? ""), act]);
      continue;
    }
    warnings.push(`unparsed: ${s}`);
  }
  return { parts, alias, events, boxes, auto, warnings };
}
