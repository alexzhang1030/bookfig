export type PaletteName = "blue" | "green";

export type Palette = {
  line: string;
  dark: string;
  mid: string;
  light: string;
  lighter: string;
  bg: string;
};

export const PALETTES: Record<PaletteName, Palette> = {
  blue: {
    line: "#1F6FEB",
    dark: "#0B3D91",
    mid: "#9DC1F7",
    light: "#DCE9FD",
    lighter: "#EEF4FE",
    bg: "#F8FBFF",
  },
  green: {
    line: "#00B86B",
    dark: "#006E40",
    mid: "#99E3C4",
    light: "#DCF6EB",
    lighter: "#EFFBF5",
    bg: "#F9FFFC",
  },
};

export const DEFAULT_FONT_FAMILY = "Noto Sans Mono CJK SC";

export function isPaletteName(value: string): value is PaletteName {
  return value === "blue" || value === "green";
}

export function resolvePalette(palette: PaletteName | Palette): Palette {
  if (typeof palette === "string") {
    return PALETTES[palette];
  }
  return palette;
}
