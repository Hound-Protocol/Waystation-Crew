import { TileKind, createTilemap, isWalkable, type Point, type Tilemap } from "./tilemap";

export interface Room { id: number; name: string; x: number; y: number; w: number; h: number; kind?: string; variant?: number }
export interface Furniture { id: number; kind: TileKind; x: number; y: number; roomId: number; style?: string }
/** Purely visual: floor markings (walkable), standing props (solid, TileKind.Prop in the map) and wall mounts. */
export interface Deco { x: number; y: number; sprite: string; layer: "floor" | "prop" | "wall" }
export interface Station { map: Tilemap; rooms: Room[]; furniture: Furniture[]; deco?: Deco[]; floors?: Uint8Array }

/** Where a character stands to use furniture: the bed tile itself, else a walkable neighbour. */
export function interactionPoint(map: Tilemap, f: Furniture): Point | null {
  if (isWalkable(f.kind)) return { x: f.x, y: f.y };
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    if (isWalkable(map.get(f.x + dx, f.y + dy)) && map.get(f.x + dx, f.y + dy) !== TileKind.Door)
      return { x: f.x + dx, y: f.y + dy };
  }
  return null;
}

export { buildStarterStation, STATION_W, STATION_H, HUB } from "./layout";
