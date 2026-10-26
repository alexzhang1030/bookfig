import { Graphviz } from "@hpcc-js/wasm-graphviz";

export type GvObject = {
  name: string;
  pos?: string;
  bb?: string;
};

export type GvEdge = {
  tail: number;
  head: number;
  pos?: string;
};

export type GvLayout = {
  bb: string;
  objects: GvObject[];
  edges: GvEdge[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function parseObject(v: unknown): GvObject | undefined {
  if (!isRecord(v)) return undefined;
  const name = asString(v.name);
  if (name === undefined) return undefined;
  return { name, pos: asString(v.pos), bb: asString(v.bb) };
}

function parseEdge(v: unknown): GvEdge | undefined {
  if (!isRecord(v)) return undefined;
  const tail = asNumber(v.tail);
  const head = asNumber(v.head);
  if (tail === undefined || head === undefined) return undefined;
  return { tail, head, pos: asString(v.pos) };
}

export function parseGvLayout(data: unknown): GvLayout {
  if (!isRecord(data)) throw new Error("graphviz json: expected object");
  const bb = asString(data.bb);
  if (!bb) throw new Error("graphviz json: missing bb");
  const objects: GvObject[] = [];
  if (Array.isArray(data.objects)) {
    for (const o of data.objects) {
      const parsed = parseObject(o);
      if (parsed) objects.push(parsed);
    }
  }
  const edges: GvEdge[] = [];
  if (Array.isArray(data.edges)) {
    for (const e of data.edges) {
      const parsed = parseEdge(e);
      if (parsed) edges.push(parsed);
    }
  }
  return { bb, objects, edges };
}

let loaded: Graphviz | undefined;

export async function layoutDot(dot: string): Promise<GvLayout> {
  loaded ??= await Graphviz.load();
  const raw = loaded.layout(dot, "json", "dot");
  return parseGvLayout(JSON.parse(raw) as unknown);
}
