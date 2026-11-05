import { TileKind, createTilemap, isWalkable, type Point, type Tilemap } from "./tilemap";
import { createRng } from "../rng";
import { MODULE_W, pickPreset, stampModule, type ModuleKind } from "./modules";

export interface Room { id: number; name: string; x: number; y: number; w: number; h: number; kind?: string; variant?: number }
export interface Furniture { id: number; kind: TileKind; x: number; y: number; roomId: number }
export interface Station { map: Tilemap; rooms: Room[]; furniture: Furniture[] }

/** Where a character stands to use furniture: the bed tile itself, else a walkable neighbour. */
export function interactionPoint(map: Tilemap, f: Furniture): Point | null {
  if (isWalkable(f.kind)) return { x: f.x, y: f.y };
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    if (isWalkable(map.get(f.x + dx, f.y + dy)) && map.get(f.x + dx, f.y + dy) !== TileKind.Door)
      return { x: f.x + dx, y: f.y + dy };
  }
  return null;
}

/**
 * The starter station is composed from module presets on a 4x4 slot grid. Rows A (door south) and B (door north, flipped) open onto the north corridor,
 * rows C (door south) and D (door north, flipped) onto the south corridor, and a west corridor links both. Empty slots are reserved for modules
 * the crew builds later.
 */
export const STATION_SIZE = 64;
const PITCH_X = MODULE_W - 1;                              // neighbouring modules share their wall column
const SLOT_X = (c: number) => 3 + c * PITCH_X;
const SLOT_Y = [2, 18, 31, 47];                            // A, B, C, D (B and C share a wall row)
export const STARTER_LAYOUT: Array<Array<ModuleKind | null>> = [
  ["command", "medical", "security", "arrivals"],
  ["engineering", "supply", "galley", "habitation"],
  ["habitation", "habitation", "habitation", "habitation"],
  [null, null, null, null],
];

export function buildStarterStation(seed = 1): Station {
  const map = createTilemap(STATION_SIZE, STATION_SIZE);
  const rooms: Room[] = [];
  const furniture: Furniture[] = [];
  const rng = createRng(seed);
  const used = new Map<ModuleKind, Set<number>>();
  // corridors: north (rows 16-17), south (rows 45-46) and the west link (cols 1-2)
  for (const y0 of [16, 45]) for (let y = y0; y < y0 + 2; y++) for (let x = 1; x <= SLOT_X(3) + MODULE_W - 1; x++) map.set(x, y, TileKind.Floor);
  for (let y = 16; y <= 46; y++) for (const x of [1, 2]) map.set(x, y, TileKind.Floor);
  STARTER_LAYOUT.forEach((row, r) =>
    row.forEach((kind, c) => {
      if (!kind) return;
      const seen = used.get(kind) ?? new Set<number>(); used.set(kind, seen);
      const preset = pickPreset(kind, rng, seen); seen.add(preset.variant);
      stampModule({ map, rooms, furniture }, preset, SLOT_X(c), SLOT_Y[r], r === 1 || r === 3);
    }));
  furniture.forEach((f, i) => { f.id = i; });
  return { map, rooms, furniture };
}
