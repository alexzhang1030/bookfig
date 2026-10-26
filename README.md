# bookfig

仓库：[github.com/alexzhang1030/bookfig](https://github.com/alexzhang1030/bookfig)  
线上： [bookfig.alexzx.com](https://bookfig.alexzx.com)

单色技术书风格图：TypeScript 画图库 + Mermaid（flowchart / sequence / state）转 SVG/PNG，以及 Nuxt 实时预览。

配色、原语和排版规则对齐 Baseten _Inference Engineering_（2026）那套蓝图风：一种颜色六档、等宽中英文字、虚线外框、角十字、直角折线。默认蓝色，主色 `#1F6FEB`。

## 仓库结构

```
apps/web/                 Nuxt 4 编辑器：左 Mermaid，右实时预览
packages/bookfig/         纯 TS 库（浏览器 + Node）
  src/fig.ts              原语：box / group / arrow / elbow / fan-out / chart / bars / table / code / icon
  src/mermaid/            解析器 + Graphviz WASM 布局 + 绘制
  src/cli.ts              CLI：.mmd → svg/png
  fixtures/mermaid/       9 张验收图（08 是故意不支持的 pie）
  tests/                  解析单测 + 9 张 SVG 快照
artifacts/                Node 端渲出的 PNG / 总览
```

包管理器是 **pnpm 12.15.0**（当前最新），用 Vite+ 官方 monorepo 的 `pnpm-workspace.yaml` + catalog。

## 布局引擎

flowchart / state 的位置来自 **`@hpcc-js/wasm-graphviz`（dot + `splines=ortho`）**。

选它而不是 ELK 的理由：Python 原型用系统 Graphviz `dot`，这套 WASM 是同一套引擎，浏览器和 Node 都能跑，验收图的相对位置才能对上。ELK 的正交路由和簇边距不同，会直接偏离开 `mermaid_sheet.png`。

## 工具链

| 用途                        | 工具                                                            | 状态                      |
| --------------------------- | --------------------------------------------------------------- | ------------------------- |
| 构建 / 测试 / lint / format | Vite+ 1.4.0（`vp`、`vp test`、`vp lint`、`vp fmt`、`vp pack`）  | 已装                      |
| 类型检查                    | `@typescript/native-preview@7.0.0-dev.20260707.2` 的 **`tsgo`** | 已装                      |
| 语言版本                    | `typescript@7.0.2`（稳定版原生 `tsc`）                          | 已装，给编辑器和 Vite+ 用 |

`@typescript/native-preview` 最后一版预览停在 2026-07-07；次日 TypeScript 7.0 稳定版把原生编译器收进了 `typescript` 包，可执行文件改名为 `tsc`，不再提供 `tsgo`。本仓库按需求同时装了两者：**类型检查走 `tsgo`，不静默换成 `tsc`。**

Nuxt 自己的开发服务器是 `nuxt dev`，不用 `vp dev`（`vp dev` 是 Vite 应用开发服务器）。

## 本地运行

需要 Node ≥ 22.18 和 pnpm 12.15.0。中文 PNG 依赖本机字体 **Noto Sans Mono CJK SC**（Debian/Ubuntu：`fonts-noto-cjk`）。可用 `BOOKFIG_FONT_PATH` 指向字体文件。

```bash
corepack enable
corepack prepare pnpm@12.15.0 --activate
pnpm install

pnpm exec vp lint
pnpm exec tsgo --noEmit -p packages/bookfig/tsconfig.json
pnpm exec vp test

# 库 CLI
pnpm exec vpx packages/bookfig/src/cli.ts fixtures/01.mmd out.png --palette blue --case auto --svg out.svg

# Nuxt 预览（43173）
pnpm --filter web dev
```

CLI 用法：

```
bookfig <in.mmd> <out.png|out.svg> [--palette blue|green] [--svg out.svg] [--case auto|upper|keep]
```

`--case auto`：普通标签转大写，看起来像代码的（`next_subtask()`、snake_case、camelCase）保持原样。

不支持的图（例如 `pie`）打印 `unsupported: …`，退出码 **2**，不会崩；需要落盘时会画一张说明卡。

## 库 API

```ts
import { Fig, renderMermaid } from "bookfig";

const f = new Fig({ palette: "blue" });
const a = f.box(100, 200, 320, 160, "VLM 规划器");
const b = f.box(600, 200, 320, 160, "VLA", { kind: "hatch" });
f.arrow(a.r, b.l);
const svg = f.svg();

const { svg: mermaidSvg } = await renderMermaid(source, { palette: "green", caseMode: "auto" });
```

Node 端转 PNG：

```ts
import { writePng } from "bookfig/node";
writePng("out.png", svg);
```

原语：`box` / `group` / `arrow` / `polyline` / `elbow` / `fanOut` / `fanIn` / `lineChart` / `barCompare` / `table` / `codeCard` / `iconDoc` / `iconPerson` / `iconRobotArm` / `bracket` / `legend` / `title` / `tag`。

## 支持的 Mermaid

- **flowchart / graph / flowchart-elk**
  - 方向 TD / LR / RL / BT
  - 形状 `[] () ([]) {} [[ ]] (( )) [( )] {{ }} >] [/ /]`
  - 边 `--> --- -.-> ==> <-->`，以及 `|label|` / `-- text --`
  - 链式、`&`、嵌套 subgraph、`<br/>`、中文
  - class 名 focus / hatch / model / dark / group（以及 style 里的深色 fill、虚线描边）映射到 box kind
- **sequenceDiagram**：participant / actor、autonumber、消息、note、loop / alt / opt / par（画成虚线组）
- **stateDiagram / stateDiagram-v2**：`[*]`、`state "…" as`、复合状态、`<<choice>>`

已知缺口（与原型一致）：

- 很宽的 LR 图会缩放到 2000px 画布内，字会变小。改成 TD 或拆图。
- 回流边可能绕远。
- `--o` / `--x` 仍用普通箭头（`x` 在 sequence 里会画叉）。
- 不处理：`linkStyle`、`click`、markdown 字符串、sequence 的 `activate` 条和 `box`。
- 标签里未加引号的 `)` 会截断标签。
- `pie` 以及其它图种：明确报错，退出码 2。

## 文字

布局宽度按等宽公式算：拉丁 0.5em，CJK 1em，字间距默认 2px。中文字体可配 `Fig({ fontFamily })` / `BOOKFIG_FONT_PATH`。

## 开发脚本

| 命令                                                        | 作用                       |
| ----------------------------------------------------------- | -------------------------- |
| `pnpm exec vp lint`                                         | Oxlint                     |
| `pnpm exec vp fmt`                                          | Oxfmt                      |
| `pnpm exec tsgo --noEmit -p packages/bookfig/tsconfig.json` | TS7 原生类型检查           |
| `pnpm exec vp test`                                         | Vitest（含 9 张 SVG 快照） |
| `pnpm artifacts`                                            | 重渲 artifacts/ 下的 PNG   |
