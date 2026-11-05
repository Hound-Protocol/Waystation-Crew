import { TileKind, createTilemap, type Tilemap } from "./tilemap";
import { createRng, type Rng } from "../rng";
import { MOUNTS, pickPreset, ringWall, stampModule, type ModuleKind } from "./modules";
import { rotateCW, turnsToFace, type Blueprint, type Dir } from "./blueprint";
import type { Station, Room, Furniture, Deco } from "./starter";

export const STATION_W = 160, STATION_H = 160;
const CX = 80, CY = 80, PLAZA_R = 9;
/** Centre of the plaza hub; the walkable open floor everything hangs off. */
export const HUB = { x: CX, y: CY };
/** Longest connecting corridor, in tiles. Modules are slapped together; links stay short. */
const MAX_LINK = 30, LINK_WEIGHT = 2.4;     // modules dock on the spokes; every link tile costs, so short links win

/** Build order: arrivals first, then the departments, then the habitation blocks. Every kind gets 5 stored presets (modules/presets.ts). */
export const STARTER_ORDER: ModuleKind[] = [
  "arrivals", "command", "security", "engineering", "supply", "galley", "medical",
  "habitation", "habitation", "habitation", "habitation", "habitation",
];

const FACINGS: Dir[] = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
const N4: Dir[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
type P = { x: number; y: number };

/** Walkable circulation: plaza (floor style 8) or corridor (style 0). */
const isPublic = (map: Tilemap, floors: Uint8Array, x: number, y: number) =>
  map.inBounds(x, y) && map.get(x, y) === TileKind.Floor && (floors[y * map.w + x] === 0 || floors[y * map.w + x] === 8);

/** Dry run: can this rotated blueprint be stamped at (ox, oy)? Cells must be on void and keep one wall tile from anything built. */
function fits(map: Tilemap, bp: Blueprint, ox: number, oy: number): boolean {
  const gh = bp.grid.length, gw = bp.grid[0].length;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    if (bp.grid[y][x] === " ") continue;
    const X = ox + x, Y = oy + y;
    if (X < 2 || Y < 2 || X >= map.w - 2 || Y >= map.h - 2 || map.get(X, Y) !== TileKind.Void) return false;
    const isDoor = x === bp.door.x && y === bp.door.y;
    if (isDoor) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = map.get(X + dx, Y + dy);
      if (k !== TileKind.Void && k !== TileKind.Wall) return false;      // would touch another room's floor with no wall between
    }
  }
  return true;
}

/** Steps through void to reach circulation, for every void tile (-1 = unreachable). Multi-source BFS from the tiles beside the plaza and corridors. */
function linkField(map: Tilemap, floors: Uint8Array, maxLen: number): Int16Array {
  const dist = new Int16Array(map.w * map.h).fill(-1);
  let frontier: number[] = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    if (map.get(x, y) !== TileKind.Void) continue;
    if (N4.some((n) => isPublic(map, floors, x + n.x, y + n.y))) { dist[y * map.w + x] = 0; frontier.push(y * map.w + x); }
  }
  for (let d = 1; d <= maxLen && frontier.length; d++) {
    const next: number[] = [];
    for (const k of frontier) {
      const x = k % map.w, y = Math.floor(k / map.w);
      for (const n of N4) {
        const X = x + n.x, Y = y + n.y;
        if (!map.inBounds(X, Y) || map.get(X, Y) !== TileKind.Void || dist[Y * map.w + X] !== -1) continue;
        dist[Y * map.w + X] = d; next.push(Y * map.w + X);
      }
    }
    frontier = next;
  }
  return dist;
}

/** Follow the field downhill from `from` to circulation. Empty when `from` already is circulation. */
function linkPath(map: Tilemap, floors: Uint8Array, dist: Int16Array, from: P): P[] | null {
  if (isPublic(map, floors, from.x, from.y)) return [];
  let d = dist[from.y * map.w + from.x];
  if (d < 0) return null;
  const path: P[] = [{ ...from }];
  let cur = from;
  while (d > 0) {
    const n = N4.map((m) => ({ x: cur.x + m.x, y: cur.y + m.y })).find((q) => map.inBounds(q.x, q.y) && dist[q.y * map.w + q.x] === d - 1);
    if (!n) return null;
    path.push(n); cur = n; d--;
  }
  return path;
}

function carve(map: Tilemap, floors: Uint8Array, path: P[], wide: boolean) {
  for (const p of path) {
    map.set(p.x, p.y, TileKind.Floor); floors[p.y * map.w + p.x] = 0;
    if (!wide) continue;
    for (const n of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {                      // widen to two tiles where there is room
      const x = p.x + n.x, y = p.y + n.y;
      if (map.inBounds(x, y) && map.get(x, y) === TileKind.Void && !N4.some((m) => { const k = map.get(x + m.x, y + m.y); return k !== TileKind.Void && k !== TileKind.Wall && k !== TileKind.Floor; })) { map.set(x, y, TileKind.Floor); floors[y * map.w + x] = 0; }
    }
  }
}

export function buildStarterStation(seed = 1): Station {
  const map = createTilemap(STATION_W, STATION_H);
  const rooms: Room[] = [], furniture: Furniture[] = [], deco: Deco[] = [];
  const floors = new Uint8Array(STATION_W * STATION_H);
  const rng: Rng = createRng(seed);
  const used = new Map<ModuleKind, Set<number>>();

  // plaza: a small organic hub
  for (let y = CY - 10; y <= CY + 10; y++) for (let x = CX - 10; x <= CX + 10; x++) {
    const a = Math.atan2(y - CY, x - CX), r = PLAZA_R + 0.8 * Math.sin(3 * a + 0.6);
    if (Math.hypot(x - CX, y - CY) <= r) { map.set(x, y, TileKind.Floor); floors[y * STATION_W + x] = 8; }
  }

  // spokes: short corridor spines radiating from the plaza, with a side branch; modules get slapped on along them
  const spokes = 7, start = rng.int(0, 359);
  for (let i = 0; i < spokes; i++) {
    const a = ((start + (i * 360) / spokes + rng.int(-14, 14)) * Math.PI) / 180, len = rng.int(13, 19), dx = Math.cos(a), dy = Math.sin(a);
    const line: P[] = [];
    for (let t = PLAZA_R - 2; t <= PLAZA_R + len; t++) line.push({ x: Math.round(CX + dx * t), y: Math.round(CY + dy * t) });
    const bt = PLAZA_R + Math.round(len * 0.6), bs = i % 2 ? 1 : -1, bl = rng.int(5, 8);
    for (let t = 1; t <= bl; t++) line.push({ x: Math.round(CX + dx * bt - dy * bs * t), y: Math.round(CY + dy * bt + dx * bs * t) });
    carve(map, floors, line, true);
  }

  // candidate offsets, nearest to the hub first
  const offsets: P[] = [];
  for (let dy = -50; dy <= 50; dy++) for (let dx = -50; dx <= 50; dx++) offsets.push({ x: dx, y: dy });
  offsets.sort((a, b) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y));

  const target = { map, rooms, furniture, deco, floors };
  for (const kind of STARTER_ORDER) {
    const seen = used.get(kind) ?? new Set<number>(); used.set(kind, seen);
    const preset = pickPreset(kind, rng, seen); seen.add(preset.variant);
    const dist = linkField(map, floors, MAX_LINK);
    const rotated = FACINGS.map((facing) => ({ facing, bp: rotateCW(preset.blueprint, turnsToFace(facing)) }));
    let best: { score: number; cx: number; cy: number; facing: Dir; path: P[] } | null = null;
    for (const o of offsets) {
      const near = Math.hypot(o.x, o.y);
      if (best && near > best.score) break;                          // nothing farther out can beat the best score so far
      for (const { facing, bp } of rotated) {
        const gh = bp.grid.length, gw = bp.grid[0].length, cx = CX + o.x, cy = CY + o.y, ox = Math.round(cx - gw / 2), oy = Math.round(cy - gh / 2);
        const out = { x: ox + bp.door.x + bp.out.x, y: oy + bp.door.y + bp.out.y };
        if (!map.inBounds(out.x, out.y)) continue;
        const pub = isPublic(map, floors, out.x, out.y), d = pub ? 0 : dist[out.y * map.w + out.x] + 1;
        if (!pub && d <= 0) continue;
        const score = near + d * LINK_WEIGHT + o.x * 0.0001;
        if (best && score >= best.score) continue;
        if (!fits(map, bp, ox, oy)) continue;
        const path = linkPath(map, floors, dist, out);
        if (!path || path.some((p) => p.x >= ox && p.x < ox + gw && p.y >= oy && p.y < oy + gh && bp.grid[p.y - oy][p.x - ox] !== " ")) continue;
        best = { score: score + rng.int(0, 3), cx, cy, facing, path };
      }
    }
    if (!best) throw new Error(`no room to place ${kind}`);
    stampModule(target, preset, best.cx, best.cy, best.facing);
    carve(map, floors, best.path, true);
  }
  // walls around corridors and plaza
  for (let y = 0; y < STATION_H; y++) for (let x = 0; x < STATION_W; x++) ringWall(map, x, y);
  // plaza dressing: holo table, benches and planters
  const prop = (x: number, y: number, sprite: string) => { map.set(x, y, TileKind.Prop); deco.push({ x, y, sprite, layer: "prop" }); };
  prop(CX, CY, "prop:holo");
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.6; prop(Math.round(CX + Math.cos(a) * 3.5), Math.round(CY + Math.sin(a) * 3.5), i % 2 ? "plant:tree" : "prop:sofa"); }
  furnitureIds(furniture);
  wallMounts(map, rooms, deco, rng);
  return { map, rooms, furniture, deco, floors };
}

function furnitureIds(f: Furniture[]) { f.forEach((x, i) => { x.id = i; }); }

/** Dress wall faces: a seeded scatter of monitors, signs and fittings along flat front-facing wall runs. */
function wallMounts(map: Tilemap, rooms: Room[], deco: Deco[], rng: Rng) {
  const roomAt = (x: number, y: number) => rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  for (let y = 0; y < map.h - 1; y++) for (let x = 1; x < map.w - 1; x++) {
    if (map.get(x, y) !== TileKind.Wall || map.get(x, y + 1) !== TileKind.Floor) continue;    // front face: floor to the south
    if (map.get(x - 1, y) !== TileKind.Wall || map.get(x + 1, y) !== TileKind.Wall || map.get(x, y - 1) === TileKind.Floor) continue;
    if ((x * 7 + y * 13 + rng.int(0, 2)) % 3 !== 0) continue;
    const r = roomAt(x, y), list = MOUNTS[(r?.kind as ModuleKind) ?? "corridor"] ?? MOUNTS.corridor;
    deco.push({ x, y, sprite: list[rng.int(0, list.length - 1)], layer: "wall" });
  }
}
