/** Shared light types. Positions and radii are in tiles. */
export type LightKind = "point" | "spot" | "area" | "sun";
export interface LightSource {
  id: number; kind: LightKind;
  x: number; y: number;                 // centre, tiles
  r: number;                            // reach, tiles
  i: number;                            // intensity 0..1+
  c: [number, number, number];          // colour 0..255
  dir?: number; cone?: number;          // spot: facing in radians, full angle in radians
  w?: number; h?: number;               // area: size in tiles
}
