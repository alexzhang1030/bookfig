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
  parseFlowchart,
  parseFlowchartDocument,
  parseSequence,
  parseState,
  parseStateDocument,
  preprocess,
  renderMermaid,
  unsupportedFigure,
  UnsupportedError,
  type RenderOptions,
  type RenderResult,
} from "./mermaid/index.ts";
export {
  DEFAULT_FONT_FAMILY,
  PALETTES,
  isPaletteName,
  resolvePalette,
  type Palette,
  type PaletteName,
} from "./palettes.ts";
export { escapeXml, isWide, textWidth, wrap } from "./text.ts";
export {
  assertNever,
  isCaseMode,
  type BoxKind,
  type CaseMode,
  type LineStyle,
  type NodeShape,
} from "./types.ts";
