import { TileKind, type Tilemap } from "../tilemap";
import { GLYPHS, rotateCW, turnsToFace, type Blueprint, type Dir } from "../blueprint";
import type { Room, Furniture, Deco } from "../starter";
import { PRESETS, type ModuleKind } from "./presets";

export type { ModuleKind } from "./presets";
export const MODULE_KINDS = Object.keys(PRESETS) as ModuleKind[];
export const PRESETS_PER_KIND = 5;

/** Room name per kind; org/jobs.ts maps room names to departments. */
export const ROOM_NAME: Record<ModuleKind, string> = {
  arrivals: "Arrivals", command: "Bridge", medical: "Medbay", security: "Security",
  engineering: "Engineering", supply: "Cargo", galley: "Galley", habitation: "Habitation",
};
/** Floor style per module kind (see viewer floors): 0 plating, 1 clinical, 2 command carpet, 3 grating, 4 security, 5 galley, 6 cargo, 7 arrivals, 8 plaza, 9 quarters. */
export const FLOOR_STYLE: Record<ModuleKind, number> = { arrivals: 7, command: 2, medical: 1, security: 4, engineering: 3, supply: 6, galley: 5, habitation: 9 };
/** Wall-mounted decoration per module kind, picked per wall tile. */
export const MOUNTS: Record<ModuleKind | "corridor", string[]> = {
  arrivals: ["wall:screen-board", "wall:sign-arrivals", "wall:clock", "wall:poster", "wall:light"],
  command: ["wall:screen-map", "wall:screen-graph", "wall:screen-alert", "wall:flag", "wall:light"],
  medical: ["wall:screen-vitals", "wall:medkit", "wall:chart", "wall:sign-med", "wall:light"],
  security: ["wall:screen-cams", "wall:poster-wanted", "wall:sign-sec", "wall:screen-alert", "wall:light"],
  engineering: ["wall:screen-power", "wall:pipes", "wall:vent", "wall:sign-hazard", "wall:fuse", "wall:light"],
  supply: ["wall:screen-manifest", "wall:sign-cargo", "wall:vent", "wall:notice", "wall:light"],
  galley: ["wall:menu", "wall:clock", "wall:screen-news", "wall:poster", "wall:light"],
  habitation: ["wall:poster", "wall:screen-news", "wall:vent", "wall:notice", "wall:light"],
  corridor: ["wall:light", "wall:vent", "wall:sign-arrow", "wall:extinguisher", "wall:panel", "wall:light"],
};

export interface ModulePreset { kind: ModuleKind; variant: number; blueprint: Blueprint }

export function presetsOf(kind: ModuleKind): ModulePreset[] {
  return PRESETS[kind].map((make, variant) => ({ kind, variant, blueprint: make() }));
}

/** Random preset of a kind. Prefers variants not in `used`, so repeated builds look different. */
export function pickPreset(kind: ModuleKind, rng: { int(min: number, max: number): number }, used: Iterable<number> = []): ModulePreset {
  const all = presetsOf(kind), taken = new Set(used);
  const fresh = all.filter((p) => !taken.has(p.variant));
  const pool = fresh.length ? fresh : all;
  return pool[rng.int(0, pool.length - 1)];
}

export interface ModuleTarget { map: Tilemap; rooms: Room[]; furniture: Furniture[]; deco: Deco[]; floors: Uint8Array }

export interface Placed { room: Room; door: { x: number; y: number }; out: Dir }

/** Stamp a preset so its door faces `facing`, with the bounding box centred on (cx, cy). Walls are generated around the floor. */
export function stampModule(t: ModuleTarget, p: ModulePreset, cx: number, cy: number, facing: Dir = { x: 0, y: 1 }): Placed {
  const bp = rotateCW(p.blueprint, turnsToFace(facing));
  const gh = bp.grid.length, gw = bp.grid[0].length, ox = Math.round(cx - gw / 2), oy = Math.round(cy - gh / 2);
  const room: Room = { id: t.rooms.length, name: ROOM_NAME[p.kind], x: ox, y: oy, w: gw, h: gh, kind: p.kind, variant: p.variant };
  t.rooms.push(room);
  const set = (x: number, y: number, k: TileKind) => { if (t.map.inBounds(x, y)) t.map.set(x, y, k); };
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const ch = bp.grid[y][x], X = ox + x, Y = oy + y;
      if (ch === " ") continue;
      if (ch === "d") { set(X, Y, TileKind.Door); continue; }
      if (ch === "A") { set(X, Y, TileKind.Airlock); continue; }
      if (ch === ".") { set(X, Y, TileKind.Floor); t.floors[Y * t.map.w + X] = FLOOR_STYLE[p.kind]; continue; }
      const def = GLYPHS[ch];
      if (!def) throw new Error(`unknown glyph ${ch}`);
      t.floors[Y * t.map.w + X] = FLOOR_STYLE[p.kind];
      if (def.tile === TileKind.Wall) { set(X, Y, TileKind.Wall); continue; }
      set(X, Y, def.tile);
      const sprite = def.sprite ?? `${def.prefix}:${p.kind}`;
      if (def.tile === TileKind.Floor) t.deco.push({ x: X, y: Y, sprite, layer: "floor" });
      else if (def.tile === TileKind.Prop) t.deco.push({ x: X, y: Y, sprite, layer: "prop" });
      else t.furniture.push({ id: -1, kind: def.tile, x: X, y: Y, roomId: room.id, style: sprite });
    }
  // wall ring around everything stamped by this module
  for (let y = -1; y <= gh; y++) for (let x = -1; x <= gw; x++) ringWall(t.map, ox + x, oy + y);
  return { room, door: { x: ox + bp.door.x, y: oy + bp.door.y }, out: bp.out };
}

/** Void tile touching (8-neighbourhood) any floor or furniture tile becomes a wall. Doors and airlocks open onto space/corridors. */
export function ringWall(map: Tilemap, x: number, y: number): void {
  if (!map.inBounds(x, y) || map.get(x, y) !== TileKind.Void) return;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const k = map.get(x + dx, y + dy);
    if (k === TileKind.Floor || k === TileKind.Bed || k === TileKind.Console || k === TileKind.Table || k === TileKind.Plant || k === TileKind.Prop) { map.set(x, y, TileKind.Wall); return; }
  }
}
