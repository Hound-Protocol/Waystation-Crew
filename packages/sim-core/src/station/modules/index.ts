import { TileKind } from "../tilemap";
import type { Room, Furniture } from "../starter";
import { PRESETS, type ModuleKind } from "./presets";

export type { ModuleKind } from "./presets";
export const MODULE_W = 15, MODULE_H = 14;               // footprint including the perimeter wall
export const MODULE_KINDS = Object.keys(PRESETS) as ModuleKind[];

/** Room name per kind; org/jobs.ts maps room names to departments. */
export const ROOM_NAME: Record<ModuleKind, string> = {
  arrivals: "Arrivals", command: "Bridge", medical: "Medbay", security: "Security",
  engineering: "Engineering", supply: "Cargo", galley: "Galley", habitation: "Habitation",
};

export interface ModulePreset { kind: ModuleKind; variant: number; rows: string[] }

export function presetsOf(kind: ModuleKind): ModulePreset[] {
  return PRESETS[kind].map((rows, variant) => ({ kind, variant, rows }));
}

/** Random preset of a kind. Prefers variants not in `used`, so repeated builds look different. */
export function pickPreset(kind: ModuleKind, rng: { int(min: number, max: number): number }, used: Iterable<number> = []): ModulePreset {
  const all = presetsOf(kind), taken = new Set(used);
  const fresh = all.filter((p) => !taken.has(p.variant));
  const pool = fresh.length ? fresh : all;
  return pool[rng.int(0, pool.length - 1)];
}

export interface ModuleTarget { map: { set(x: number, y: number, k: TileKind): void }; rooms: Room[]; furniture: Furniture[] }

const GLYPH: Record<string, TileKind> = { ".": TileKind.Floor, "#": TileKind.Wall, C: TileKind.Console, B: TileKind.Bed, T: TileKind.Table, P: TileKind.Plant };

/** Stamp a preset at (x, y). The door is centred on the south wall, or on the north wall when `flip` mirrors it vertically. */
export function stampModule(t: ModuleTarget, p: ModulePreset, x: number, y: number, flip = false): Room {
  const room: Room = { id: t.rooms.length, name: ROOM_NAME[p.kind], x, y, w: MODULE_W, h: MODULE_H, kind: p.kind, variant: p.variant };
  t.rooms.push(room);
  for (let yy = 0; yy < MODULE_H; yy++)
    for (let xx = 0; xx < MODULE_W; xx++) {
      const edge = xx === 0 || yy === 0 || xx === MODULE_W - 1 || yy === MODULE_H - 1;
      if (edge) { t.map.set(x + xx, y + yy, TileKind.Wall); continue; }
      const row = p.rows[flip ? MODULE_H - 2 - yy : yy - 1];
      const k = GLYPH[row[xx - 1]] ?? TileKind.Floor;
      t.map.set(x + xx, y + yy, k);
      if (k !== TileKind.Floor && k !== TileKind.Wall) t.furniture.push({ id: -1, kind: k, x: x + xx, y: y + yy, roomId: room.id });
    }
  t.map.set(x + (MODULE_W >> 1), flip ? y : y + MODULE_H - 1, TileKind.Door);
  if (p.kind === "arrivals") for (let xx = 3; xx <= MODULE_W - 4; xx++) t.map.set(x + xx, flip ? y + MODULE_H - 1 : y, TileKind.Airlock);
  return room;
}
