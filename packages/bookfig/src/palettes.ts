export type Palette = {
  line: string;
  dark: string;
  mid: string;
  light: string;
  lighter: string;
  bg: string;
};

/** Book-figure blueprint: one hue, six steps. */
export const PALETTE: Palette = {
  line: "#1F6FEB",
  dark: "#0B3D91",
  mid: "#9DC1F7",
  light: "#DCE9FD",
  lighter: "#EEF4FE",
  bg: "#F8FBFF",
};

export const DEFAULT_FONT_FAMILY = "Noto Sans Mono";
