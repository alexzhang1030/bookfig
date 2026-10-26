export { GALLERY, type GalleryItem } from "./gallery.ts";
export { Box, dist, fmt, type Point } from "./geom.ts";
export {
  Fig,
  type BarCompareOptions,
  type BoxOptions,
  type ChartSeries,
  type FigOptions,
  type LineChartOptions,
  type TableOptions,
} from "./fig.ts";
export {
  applyCase,
  hasMath,
  layoutLabel,
  parseFlowchart,
  parseFlowchartDocument,
  parsePie,
  parseSequence,
  parseState,
  parseStateDocument,
  preprocess,
  renderKatex,
  renderMermaid,
  splitMath,
  unsupportedFigure,
  UnsupportedError,
  type RenderOptions,
  type RenderResult,
} from "./mermaid/index.ts";
export { DEFAULT_FONT_FAMILY, PALETTE, type Palette } from "./palettes.ts";
export { escapeXml, isWide, textWidth, wrap } from "./text.ts";
export {
  assertNever,
  isCaseMode,
  type BoxKind,
  type CaseMode,
  type HeadMark,
  type LineStyle,
  type NodeShape,
} from "./types.ts";
