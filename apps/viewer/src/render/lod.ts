export type ZoomLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type LodStyle = "dot" | "column" | "silhouette" | "sprite";

/** scale = screen pixels per tile. Z1 ~2, Z2 4, Z3 8, Z4 16, Z5 32, Z6 64 (geometric midpoints). */
export function zoomLevel(scale: number): ZoomLevel {
  if (scale < 3) return 1;
  if (scale < 6) return 2;
  if (scale < 12) return 3;
  if (scale < 24) return 4;
  if (scale < 48) return 5;
  return 6;
}

export function lodStyle(level: ZoomLevel): LodStyle {
  return level === 1 ? "dot" : level === 2 ? "column" : level === 3 ? "silhouette" : "sprite";
}
