<script setup lang="ts">
import {
  GALLERY,
  UnsupportedError,
  isCaseMode,
  renderMermaid,
  unsupportedFigure,
  type CaseMode,
} from "bookfig";

type PreviewState =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "ready"; svg: string; warnings: string[]; scale: number; type: string }
  | { kind: "error"; message: string; svg: string };

const source = ref(GALLERY[0]?.source ?? "");
const caseMode = ref<CaseMode>("auto");
const activeId = ref(GALLERY[0]?.id ?? "");
const state = ref<PreviewState>({ kind: "empty" });
let seq = 0;

function setCase(name: string): void {
  if (isCaseMode(name)) caseMode.value = name;
}

function loadExample(id: string): void {
  const item = GALLERY.find((g) => g.id === id);
  if (!item) return;
  activeId.value = id;
  source.value = item.source;
}

async function renderNow(): Promise<void> {
  const text = source.value.trim();
  if (!text) {
    state.value = { kind: "empty" };
    return;
  }
  const token = ++seq;
  state.value = { kind: "loading" };
  try {
    const r = await renderMermaid(text, { caseMode: caseMode.value });
    if (token !== seq) return;
    state.value = { kind: "ready", svg: r.svg, warnings: r.warnings, scale: r.scale, type: r.type };
  } catch (err) {
    if (token !== seq) return;
    const message =
      err instanceof UnsupportedError || err instanceof Error ? err.message : String(err);
    state.value = {
      kind: "error",
      message,
      svg: unsupportedFigure(message),
    };
  }
}

watch([source, caseMode], () => {
  if (!import.meta.client) return;
  void renderNow();
});

onMounted(() => {
  void renderNow();
});

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSvg(): void {
  const svg = state.value.kind === "ready" || state.value.kind === "error" ? state.value.svg : "";
  if (!svg) return;
  download("bookfig.svg", new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

async function exportPng(): Promise<void> {
  const svg = state.value.kind === "ready" || state.value.kind === "error" ? state.value.svg : "";
  if (!svg) return;
  const res = await fetch("/api/png", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ svg }),
  });
  if (!res.ok) {
    state.value = { kind: "error", message: `PNG export failed: ${res.status}`, svg };
    return;
  }
  download("bookfig.png", await res.blob());
}

const statusLabel = computed(() => {
  switch (state.value.kind) {
    case "empty":
      return "Empty editor · pick an example or write Mermaid";
    case "loading":
      return "Laying out…";
    case "ready":
      return `${state.value.type} · scale ${state.value.scale}`;
    case "error":
      return "Could not draw this diagram";
    default: {
      const _n: never = state.value;
      return _n;
    }
  }
});
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="brand">
        <h1>BOOKFIG</h1>
        <p>Technical-book figures · Mermaid → SVG / PNG</p>
      </div>
      <div class="controls">
        <button class="chip" :data-on="caseMode === 'auto'" type="button" @click="setCase('auto')">
          CASE AUTO
        </button>
        <button
          class="chip"
          :data-on="caseMode === 'upper'"
          type="button"
          @click="setCase('upper')"
        >
          UPPER
        </button>
        <button class="chip" :data-on="caseMode === 'keep'" type="button" @click="setCase('keep')">
          KEEP
        </button>
        <button
          class="btn primary"
          type="button"
          :disabled="state.kind === 'empty' || state.kind === 'loading'"
          @click="exportSvg"
        >
          Export SVG
        </button>
        <button
          class="btn"
          type="button"
          :disabled="state.kind === 'empty' || state.kind === 'loading'"
          @click="exportPng"
        >
          Export PNG
        </button>
      </div>
    </header>
    <main class="main">
      <section class="pane">
        <div class="pane-head">
          <span>MERMAID SOURCE</span><span>{{ activeId }}</span>
        </div>
        <div class="examples">
          <button
            v-for="item in GALLERY"
            :key="item.id"
            type="button"
            :data-on="activeId === item.id"
            :title="item.title"
            @click="loadExample(item.id)"
          >
            {{ item.id.slice(0, 2) }} {{ item.title }}
          </button>
        </div>
        <textarea
          v-model="source"
          class="editor"
          spellcheck="false"
          aria-label="Mermaid source"
          placeholder="flowchart TD&#10;    A[Start] --> B[End]"
        />
      </section>
      <section class="pane">
        <div class="pane-head">
          <span>PREVIEW</span><span>{{ statusLabel }}</span>
        </div>
        <div class="preview">
          <div v-if="state.kind === 'empty'" class="state">
            Write a flowchart, sequenceDiagram, stateDiagram, or pie on the left. The figure updates
            live.
          </div>
          <div v-else-if="state.kind === 'loading'" class="state">
            Laying out with Graphviz WASM…
          </div>
          <div v-else-if="state.kind === 'error'" class="state error">
            {{ state.message }}
            <div style="margin-top: 16px" v-html="state.svg" />
          </div>
          <div v-else v-html="state.svg" />
        </div>
        <div v-if="state.kind === 'ready' && state.warnings.length" class="warns">
          <div v-for="(w, i) in state.warnings" :key="i">warning: {{ w }}</div>
        </div>
      </section>
    </main>
  </div>
</template>
