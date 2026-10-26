import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { applyCase } from "../src/mermaid/case-mode.ts";
import { parseFlowchartDocument } from "../src/mermaid/parse-flowchart.ts";
import { parseSequence } from "../src/mermaid/parse-sequence.ts";
import { parseStateDocument } from "../src/mermaid/parse-state.ts";
import { preprocess } from "../src/mermaid/preprocess.ts";
import { resolveKinds } from "../src/mermaid/kinds.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/mermaid");

function load(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

test("preprocess strips front matter, comments, and keeps title", () => {
  const { title, lines } = preprocess(load("01_agent_loop.mmd"));
  expect(title).toBe("机器人 Agent 控制回路");
  expect(lines[0]).toMatch(/^flowchart TD/);
  expect(lines.some((l) => l.includes("%%"))).toBe(false);
});

test("flowchart parser: nodes, edges, subgraph, classDef", () => {
  const { lines } = preprocess(load("01_agent_loop.mmd"));
  const g = parseFlowchartDocument((lines[0] ?? "").split(/\s+/)[1] ?? "TD", lines.slice(1));
  expect(g.nodes.has("P")).toBe(true);
  expect(g.nodes.get("P")?.label).toContain("VLM");
  expect(g.nodes.get("V")?.shape).toBe("subroutine");
  expect(g.nodes.get("J")?.shape).toBe("diamond");
  expect(g.nodes.get("W")?.shape).toBe("stadium");
  expect(g.subs.has("ELEV")).toBe(true);
  expect(g.nodes.get("W")?.sub).toBe("ELEV");
  expect(g.edges.some((e) => e.a === "J" && e.b === "C" && e.style === "dashed")).toBe(true);
  expect(g.edges.some((e) => e.label.includes("success"))).toBe(true);
  expect(g.classdefs.has("model")).toBe(true);
  expect(g.nodes.get("P")?.classes).toContain("model");
  expect(g.warnings).toEqual([]);
});

test("flowchart parser: & fan-out and nested subgraphs", () => {
  const { lines } = preprocess(load("03_fanout.mmd"));
  const g = parseFlowchartDocument("LR", lines.slice(1));
  expect(g.edges.filter((e) => e.a === "CP").length).toBe(4);
  expect(g.edges.filter((e) => e.b === "M").length).toBe(3);
  const { lines: l2 } = preprocess(load("02_subgraphs.mmd"));
  const g2 = parseFlowchartDocument("LR", l2.slice(1));
  expect(g2.subs.get("REC")?.parent).toBe("DATA");
  expect(g2.nodes.get("T")?.sub).toBe("REC");
  expect(g2.edges.some((e) => e.style === "thick")).toBe(true);
});

test("class / style map onto box kinds", () => {
  const { lines } = preprocess(load("04_classdef.mmd"));
  const g = parseFlowchartDocument("TB", lines.slice(1));
  resolveKinds(g);
  expect(g.nodes.get("POL")?.kind).toBe("focus");
  expect(g.nodes.get("ENC")?.kind).toBe("hatch");
  expect(g.nodes.get("SAFE")?.kind).toBe("group");
});

test("sequence parser: actors, autonumber blocks, notes", () => {
  const { lines } = preprocess(load("05_sequence.mmd"));
  const m = parseSequence(lines.slice(1));
  expect(m.auto).toBe(true);
  expect(m.parts).toEqual(["U", "A", "S", "R"]);
  expect(m.alias.get("U")?.[1]).toBe("actor");
  expect(m.events.some((e) => e[0] === "begin" && e[1] === "loop")).toBe(true);
  expect(m.events.some((e) => e[0] === "begin" && e[1] === "alt")).toBe(true);
  expect(m.events.some((e) => e[0] === "note")).toBe(true);
  expect(m.warnings).toEqual([]);
});

test("state parser: aliases, start/end, edge labels", () => {
  const { lines } = preprocess(load("07_state.mmd"));
  const g = parseStateDocument(lines.slice(1));
  expect(g.nodes.get("Waiting")?.label).toContain("等待");
  expect([...g.nodes.values()].some((n) => n.shape === "start")).toBe(true);
  expect([...g.nodes.values()].some((n) => n.shape === "end")).toBe(true);
  expect(g.edges.some((e) => e.label.includes("超时"))).toBe(true);
  expect(g.warnings).toEqual([]);
});

test("shapes and edge operators", () => {
  const { lines } = preprocess(load("09_shapes_edges.mmd"));
  const g = parseFlowchartDocument("LR", lines.slice(1));
  expect(g.nodes.get("C")?.shape).toBe("stadium");
  expect(g.nodes.get("D")?.shape).toBe("subroutine");
  expect(g.nodes.get("E")?.shape).toBe("circle");
  expect(g.nodes.get("F")?.shape).toBe("cylinder");
  expect(g.nodes.get("G")?.shape).toBe("hexagon");
  expect(g.nodes.get("H")?.shape).toBe("flag");
  expect(g.nodes.get("I")?.shape).toBe("para");
  expect(g.edges.some((e) => e.a === "A" && e.b === "J" && !e.head)).toBe(true);
  expect(g.edges.some((e) => e.a === "A" && e.b === "K" && e.tail && e.head)).toBe(true);
  expect(g.edges.some((e) => e.style === "thick")).toBe(true);
  expect(g.edges.some((e) => e.style === "dashed")).toBe(true);
});

test("auto case keeps code-like labels", () => {
  expect(applyCase("next_subtask()", "auto")).toBe("next_subtask()");
  expect(applyCase("等待 WAITING", "auto")).toBe("等待 WAITING".toUpperCase());
  expect(applyCase("keep me", "keep")).toBe("keep me");
});
