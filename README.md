<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/logo-dark.svg" />
  <img src="apps/web/public/logo-light.svg" alt="bookfig" height="24" />
</picture>

# bookfig

Repository: [github.com/alexzhang1030/bookfig](https://github.com/alexzhang1030/bookfig)  
Live: [bookfig.alexzx.com](https://bookfig.alexzx.com)

Single-hue technical-book figures: a TypeScript drawing library, Mermaid (flowchart / sequence / state / pie) to SVG and PNG, and a Nuxt live preview.

Colour, primitives, and type follow the Baseten _Inference Engineering_ (2026) blueprint look: one hue in six steps, monospace Latin and CJK, dashed outer frame, corner crosses, orthogonal elbows. The only palette is blue, line `#1F6FEB`.

## Repository layout

```
apps/web/                 Nuxt 4 editor: Mermaid on the left, live preview on the right
packages/bookfig/         Pure TS library (browser + Node)
  src/fig.ts              Primitives: box / group / arrow / elbow / fan-out / chart / bars / table / code / icon
  src/mermaid/            Parser + Graphviz WASM layout + draw
  src/cli.ts              CLI: .mmd → svg/png
  fixtures/mermaid/       Acceptance diagrams (01–10 plus extra syntax tests)
  tests/                  Parser unit tests + SVG snapshots
artifacts/                Node-rendered PNG / overview sheets
```

Package manager is **pnpm 12.15.0** (current latest), using the official Vite+ monorepo `pnpm-workspace.yaml` + catalog.

## Layout engine

flowchart / state positions come from **`@hpcc-js/wasm-graphviz` (`dot` + `splines=ortho`)**.

That matches the Python prototype’s system Graphviz `dot`. The WASM build is the same engine in the browser and Node, so acceptance diagrams keep the same relative placement. ELK’s orthogonal routing and cluster margins would drift off `mermaid_sheet.png`.

## Wide left-to-right diagrams

Wide LR figures such as `02_subgraphs` used to be **scaled down to fit a 2000 px canvas**. Type dropped to ~16 px and became hard to read at a normal viewing size.

bookfig now **lets the canvas grow with the content** and keeps a scale of 1. Type stays at the book-figure size (about 24–30 px). The preview pane scrolls horizontally instead of shrinking the figure.

Why not wrap labels or flip to TD?

- `02_subgraphs` is wide because three nested subgraphs sit in a row (data → train → serve), not because a single label is long. Wrapping node text would not shorten that chain.
- Flipping to TD would rewrite the left-to-right story the diagram is making.

A wider SVG or PNG is the honest figure. Readers scroll or zoom; they should not have to squint.

## Tooling

| Use                          | Tool                                                          | Status                 |
| ---------------------------- | ------------------------------------------------------------- | ---------------------- |
| Build / test / lint / format | Vite+ 1.4.0 (`vp`, `vp test`, `vp lint`, `vp fmt`, `vp pack`) | installed              |
| Typecheck                    | `@typescript/native-preview@7.0.0-dev.20260707.2` **`tsgo`**  | installed              |
| Language                     | `typescript@7.0.2` (stable native `tsc`)                      | installed, for editors |

`@typescript/native-preview` last preview stopped on 2026-07-07; the next day TypeScript 7.0 stable folded the native compiler into `typescript` and renamed the binary `tsc`. This repo installs both: **typecheck uses `tsgo`**, not a silent swap to `tsc`.

The Nuxt dev server is `nuxt dev`, not `vp dev` (`vp dev` is the Vite app dev server).

## Run locally

Needs Node ≥ 22.18 and pnpm 12.15.0. CJK PNG depends on **Noto Sans Mono CJK SC** on the machine (Debian/Ubuntu: `fonts-noto-cjk`). Point `BOOKFIG_FONT_PATH` at a font file if needed. Math glyphs are outlined from the KaTeX TTF files with `opentype.js`; diagram labels still use the book font for Node PNG.

```bash
corepack enable
corepack prepare pnpm@12.15.0 --activate
pnpm install

pnpm exec vp lint
pnpm exec tsgo --noEmit -p packages/bookfig/tsconfig.json
pnpm exec vp test

# library CLI
pnpm exec vpx packages/bookfig/src/cli.ts fixtures/mermaid/01_agent_loop.mmd out.png --case auto --svg out.svg

# Nuxt preview (43173)
pnpm --filter web dev
```

CLI:

```
bookfig <in.mmd> <out.png|out.svg> [--svg out.svg] [--case auto|upper|keep]
```

`--case auto`: ordinary labels go uppercase; code-like labels (`next_subtask()`, snake_case, camelCase) stay as written. Math between `$…$` / `$$…$$` is never uppercased.

Unsupported diagram kinds print `unsupported: …`, exit **2**, and do not crash. If an output path is given they draw an explanation card.

## Library API

```ts
import { Fig, renderMermaid } from "bookfig";

const f = new Fig();
const a = f.box(100, 200, 320, 160, "VLM planner");
const b = f.box(600, 200, 320, 160, "VLA", { kind: "hatch" });
f.arrow(a.r, b.l);
const svg = f.svg();

const { svg: mermaidSvg } = await renderMermaid(source, { caseMode: "auto" });
```

Node PNG:

```ts
import { writePng } from "bookfig/node";
writePng("out.png", svg);
```

Primitives: `box` / `group` / `arrow` / `polyline` / `elbow` / `fanOut` / `fanIn` / `lineChart` / `barCompare` / `table` / `codeCard` / `iconDoc` / `iconPerson` / `iconRobotArm` / `bracket` / `legend` / `title` / `tag`.

## Supported Mermaid

- **flowchart / graph / flowchart-elk**
  - Directions TD / LR / RL / BT
  - Shapes `[] () ([]) {} [[ ]] (( )) [( )] {{ }} >] [/ /]`
  - Edges `--> --- -.-> ==> <--> --o --x o--o`, plus `|label|` / `-- text --`
  - Chains, `&`, nested subgraphs, `<br/>`, CJK
  - `classDef` / `class` / `style` map onto box kinds
  - `linkStyle` maps dash and width onto book-figure line styles (custom colours stay blue)
  - `click` is a safe no-op on export (no error)
  - Markdown markers in labels (`**bold**`, `*italic*`, `` `code` ``, `[text](url)`) are stripped
  - Unquoted `)` inside a label no longer truncates the node
- **sequenceDiagram**: participant / actor, autonumber, messages, note, loop / alt / opt / par, `activate` / `deactivate` (and `+` / `-` on messages), `box`
- **stateDiagram / stateDiagram-v2**: `[*]`, `state "…" as`, composite states, `<<choice>>`
- **pie**: `pie` / `pie showData` / `title`, `"label" : value` slices, drawn in the same blueprint style
- **Math**: `$...$` and `$$...$$` in node and edge labels, including Mermaid’s `$$` math. Rendered with **KaTeX** to SVG `<path>` outlines (no `foreignObject`, no `<text>` for glyphs), so the browser preview and Node PNG share the same shapes. resvg’s fontdb cannot distinguish `KaTeX_Main` Regular from Italic; outlining bypasses that. Formula colour is the blue line colour. Boxes are sized from KaTeX’s own metrics.

Known gaps:

- Other Mermaid kinds (class, er, gantt, git, mindmap, …) still error with exit 2.
- `linkStyle` colours are ignored so the figure stays monochrome blue.
- `click` does not emit real hyperlinks.
- Graphviz still influences node placement; a leftover dummy-node gap can appear near a labeled back-edge.
- Stretchy KaTeX constructs (very tall radicals, large matrices) may be slightly loose in the SVG walker.

## Text

Layout width uses a monospace rule: Latin 0.5 em, CJK 1 em, default letter-spacing 2 px. CJK font is `Fig({ fontFamily })` / `BOOKFIG_FONT_PATH`. The library still accepts Chinese in labels; the website chrome and this README are English.

## Dev scripts

| Command                                                     | What                            |
| ----------------------------------------------------------- | ------------------------------- |
| `pnpm exec vp lint`                                         | Oxlint                          |
| `pnpm exec vp fmt`                                          | Oxfmt                           |
| `pnpm exec tsgo --noEmit -p packages/bookfig/tsconfig.json` | TS7 native typecheck            |
| `pnpm exec vp test`                                         | Vitest (SVG snapshots)          |
| `pnpm artifacts`                                            | Re-render PNGs under artifacts/ |
