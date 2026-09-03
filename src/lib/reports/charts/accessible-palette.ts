/** Wong color-blind-safe palette for charts (dashboards + PDF). */
export const WONG_PALETTE = [
  "#000000",
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
] as const;

export function paletteColor(index: number): string {
  return WONG_PALETTE[index % WONG_PALETTE.length]!;
}
