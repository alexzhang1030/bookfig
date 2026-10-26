export type BoxKind = "component" | "group" | "focus" | "dark" | "hatch" | "plain";

export type LineStyle = "solid" | "dashed" | "thick" | "invis";

export type HeadStyle = "end" | "both" | "none" | "start";

export type TextAnchor = "start" | "middle" | "end";

export type FontWeight = "normal" | "bold";

export type TagKind = "component" | "plain" | "focus";

export type TagAlign = "center" | "left";

export type ElbowVia = "h" | "v";

export type SwatchKind = "dark" | "line" | "mid" | "light" | "lighter" | "hatch" | "dots";

export type LegendKind = SwatchKind | "solid_line" | "dashed_line";

export type CaseMode = "auto" | "upper" | "keep";

export type NodeShape =
  | "rect"
  | "round"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle"
  | "dcircle"
  | "diamond"
  | "hexagon"
  | "flag"
  | "para"
  | "start"
  | "end";

export function assertNever(value: never, label: string): never {
  throw new Error(`unhandled ${label}: ${String(value)}`);
}

export function isCaseMode(value: string): value is CaseMode {
  return value === "auto" || value === "upper" || value === "keep";
}
