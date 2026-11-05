import { FACING } from "./furnish";
import { TileKind, createTilemap, isWalkable, type Point, type Tilemap } from "./tilemap";

export interface Room { id: number; name: string; x: number; y: number; w: number; h: number; kind?: string; variant?: number; dockDone?: boolean }
export interface Furniture { id: number; kind: TileKind; x: number; y: number; roomId: number; style?: string; facing?: 0 | 1 | 2 | 3 }
/** Purely visual: floor markings (walkable), standing props (solid, TileKind.Prop in the map) and wall mounts. */
export interface Deco { x: number; y: number; sprite: string; layer: "floor" | "prop" | "wall" }
/** The cargo ship's deck as a chunk of its own, in local coordinates; `berth` is where it parks in the station map. */
export interface ShipChunk extends Station { berth: { x: number; y: number; w: number; h: number } }
export interface Station { ship?: ShipChunk; map: Tilemap; rooms: Room[]; furniture: Furniture[]; deco?: Deco[]; floors?: Uint8Array; halls?: Array<{ x0: number; y0: number; x1: number; y1: number }> }

/** Where a character stands to use furniture: the bed tile itself, else a walkable neighbour. */
export function interactionPoint(map: Tilemap, f: Furniture): Point | null {
  if (isWalkable(f.kind)) return { x: f.x, y: f.y };
  const open = (x: number, y: number) => isWalkable(map.get(x, y)) && map.get(x, y) !== TileKind.Door;
  if (f.facing !== undefined && (f.kind === TileKind.Console || f.kind === TileKind.Table)) { const [fx, fy] = FACING[f.facing]; if (open(f.x + fx, f.y + fy)) return { x: f.x + fx, y: f.y + fy }; }
  let best: Point | null = null, bestScore = -1;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const x = f.x + dx, y = f.y + dy;
    if (!open(x, y)) continue;
    const score = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ax, ay]) => open(x + ax, y + ay)).length;   // prefer open standing spots over dead-end nooks
    if (score > bestScore) { best = { x, y }; bestScore = score; }
  }
  return best;
}

export { buildStarterStation } from "./layout";
export { STATION_W, STATION_H, HUB } from "./constants";
