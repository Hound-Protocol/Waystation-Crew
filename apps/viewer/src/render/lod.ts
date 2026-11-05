/** Zoom levels, 1 = closest. Scale = screen pixels per tile.
 *  1 detail (tools in hand) · 2 overview (rooms, tools) · 3 big scope (simplified sprites, no tools)
 *  4 half the station or more (dots) · 5 planets in scope · 6 the whole solar system. */
export type ZoomLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type LodStyle = "dot" | "column" | "silhouette" | "sprite";

export const ZOOM_EDGES = [48, 28, 16, 5, 0.6] as const; // lower bounds of levels 1..5

export function zoomLevel(scale: number): ZoomLevel {
  for (let i = 0; i < ZOOM_EDGES.length; i++) if (scale >= ZOOM_EDGES[i]) return (i + 1) as ZoomLevel;
  return 6;
}

/** Characters: full sprites at 1-2, simplified silhouettes at 3, department-coloured dots from 4 outward. */
export function lodStyle(level: ZoomLevel): LodStyle {
  return level <= 2 ? "sprite" : level === 3 ? "silhouette" : "dot";
}

/** Level 1 shows what characters hold; from level 3 outward held items are hidden. */
export const showsTools = (level: ZoomLevel) => level <= 2;
