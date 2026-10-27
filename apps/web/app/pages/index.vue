<script setup lang="ts">
import {
  UnsupportedError,
  isCaseMode,
  renderMermaid,
  unsupportedFigure,
  type CaseMode,
} from "bookfig";
import { SITE_EXAMPLES } from "../examples";
import { applyFitViewBox, rememberSvgSize, restoreSvgSize } from "../preview-fit";

type PreviewState =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "ready"; svg: string; warnings: string[]; scale: number; type: string }
  | { kind: "error"; message: string; svg: string };

type PreviewZoom = "fit" | "actual";

const source = ref(SITE_EXAMPLES[0]?.source ?? "");
const caseMode = ref<CaseMode>("auto");
const activeId = ref(SITE_EXAMPLES[0]?.id ?? "");
const state = ref<PreviewState>({ kind: "empty" });
const previewZoom = ref<PreviewZoom>("fit");
const narrow = ref(false);
const visualScale = ref<number | null>(null);
const previewEl = ref<HTMLElement | null>(null);
const editorFocused = ref(false);
let seq = 0;
let mediaQuery: MediaQueryList | undefined;
let previewObserver: ResizeObserver | undefined;

function setCase(name: string): void {
  if (isCaseMode(name)) caseMode.value = name;
}

function loadExample(id: string): void {
  const item = SITE_EXAMPLES.find((g) => g.id === id);
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

function formatScale(n: number): string {
  if (Math.abs(n - 1) < 0.005) return "1";
  return n.toFixed(2);
}

function measureVisualScale(): void {
  const svg = previewEl.value?.querySelector("svg");
  if (!svg) {
    visualScale.value = null;
    return;
  }
  const box = svg.viewBox.baseVal.width;
  const shown = svg.getBoundingClientRect().width;
  visualScale.value = box > 0 ? Math.min(1, shown / box) : null;
}

function applyPreviewFit(): void {
  const host = previewEl.value;
  const svg = host?.querySelector("svg");
  if (!host || !svg) {
    visualScale.value = null;
    return;
  }
  rememberSvgSize(svg);
  if (narrow.value && previewZoom.value === "fit") {
    const cs = getComputedStyle(host);
    const padX = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
    const padY = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
    const box = host.getBoundingClientRect();
    applyFitViewBox(svg, { w: Math.max(1, box.width - padX), h: Math.max(1, box.height - padY) });
  } else restoreSvgSize(svg);
  measureVisualScale();
}

function syncNarrow(): void {
  narrow.value = window.matchMedia("(max-width: 860px)").matches;
}

function setZoom(mode: PreviewZoom): void {
  previewZoom.value = mode;
}

watch([source, caseMode], () => {
  if (!import.meta.client) return;
  void renderNow();
});

watch([state, previewZoom, narrow], () => {
  if (!import.meta.client) return;
  void nextTick(() => applyPreviewFit());
});

onMounted(() => {
  syncNarrow();
  mediaQuery = window.matchMedia("(max-width: 860px)");
  mediaQuery.addEventListener("change", syncNarrow);
  previewObserver = new ResizeObserver(() => applyPreviewFit());
  if (previewEl.value) previewObserver.observe(previewEl.value);
  void renderNow();
});

onUnmounted(() => {
  mediaQuery?.removeEventListener("change", syncNarrow);
  previewObserver?.disconnect();
});

function isAppleTouch(): boolean {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

async function download(filename: string, blob: Blob): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  const apple = isAppleTouch();
  if (apple) {
    const opened = window.open(url, "_blank");
    if (!opened) window.location.assign(url);
  }
  globalThis.setTimeout(() => URL.revokeObjectURL(url), apple ? 60_000 : 2_000);
}

async function exportSvg(): Promise<void> {
  const svg = state.value.kind === "ready" || state.value.kind === "error" ? state.value.svg : "";
  if (!svg) return;
  await download("bookfig.svg", new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
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
  await download("bookfig.png", await res.blob());
}

const statusLabel = computed(() => {
  switch (state.value.kind) {
    case "empty":
      return "Empty editor · pick an example or write Mermaid";
    case "loading":
      return "Laying out…";
    case "ready": {
      const shown =
        narrow.value && previewZoom.value === "fit" && visualScale.value != null
          ? visualScale.value
          : state.value.scale;
      return `${state.value.type} · scale ${formatScale(shown)}`;
    }
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
    <header class="top" data-testid="toolbar">
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
          data-testid="export-svg"
          :disabled="state.kind === 'empty' || state.kind === 'loading'"
          @click="exportSvg"
        >
          Export SVG
        </button>
        <button
          class="btn"
          type="button"
          data-testid="export-png"
          :disabled="state.kind === 'empty' || state.kind === 'loading'"
          @click="exportPng"
        >
          Export PNG
        </button>
      </div>
    </header>
    <main class="main">
      <section class="pane editor-pane" data-testid="editor-pane">
        <div class="pane-head">
          <span>MERMAID SOURCE</span><span>{{ activeId }}</span>
        </div>
        <div class="examples">
          <button
            v-for="item in SITE_EXAMPLES"
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
          data-testid="editor"
          :class="{ 'editor-open': editorFocused }"
          spellcheck="false"
          aria-label="Mermaid source"
          placeholder="flowchart TD&#10;    A[Start] --> B[End]"
          @focus="editorFocused = true"
          @blur="editorFocused = false"
        />
      </section>
      <section class="pane" data-testid="preview-pane">
        <div class="pane-head preview-head">
          <div class="preview-head-left">
            <span>PREVIEW</span>
            <div class="zoom-bar">
              <button
                class="chip"
                type="button"
                data-testid="zoom-fit"
                :data-on="previewZoom === 'fit'"
                @click="setZoom('fit')"
              >
                Fit
              </button>
              <button
                class="chip"
                type="button"
                data-testid="zoom-actual"
                :data-on="previewZoom === 'actual'"
                @click="setZoom('actual')"
              >
                100%
              </button>
            </div>
          </div>
          <span data-testid="preview-scale">{{ statusLabel }}</span>
        </div>
        <div ref="previewEl" class="preview" data-testid="preview" :data-zoom="previewZoom">
          <div v-if="state.kind === 'empty'" class="state">
            Write a flowchart, sequenceDiagram, stateDiagram, or pie on the left. The figure updates
            live.
          </div>
          <div v-else-if="state.kind === 'loading'" class="state">
            Laying out with Graphviz WASM…
          </div>
          <div v-else-if="state.kind === 'error'" class="state error">
            {{ state.message }}
            <div class="preview-figure" v-html="state.svg" />
          </div>
          <div v-else class="preview-figure" v-html="state.svg" />
        </div>
        <div v-if="state.kind === 'ready' && state.warnings.length" class="warns">
          <div v-for="(w, i) in state.warnings" :key="i">warning: {{ w }}</div>
        </div>
      </section>
    </main>
  </div>
</template>
