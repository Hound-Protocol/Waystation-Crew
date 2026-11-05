import { TileKind, createTilemap, type Tilemap } from "./tilemap";
import { createRng, type Rng } from "../rng";
import { MODULE_KINDS, MOUNTS, pickPreset, ringWall, stampModule, type ModuleKind, type Placed } from "./modules";
import type { Station, Room, Furniture, Deco } from "./starter";

export const STATION_W = 130, STATION_H = 130;
const CX = 65, CY = 67, PLAZA_R = 9;

interface Slot { kind: ModuleKind; angle: number; dist: number }
/** Ring of modules around the central plaza; angle in degrees (0 = east, 90 = south). */
export const STARTER_SLOTS: Slot[] = [
  { kind: "arrivals", angle: -90, dist: 47 }, { kind: "security", angle: -58, dist: 44 }, { kind: "supply", angle: -27, dist: 48 },
  { kind: "engineering", angle: 3, dist: 47 }, { kind: "galley", angle: 29, dist: 49 }, { kind: "habitation", angle: 66, dist: 49 },
  { kind: "habitation", angle: 90, dist: 49 }, { kind: "habitation", angle: 120, dist: 50 }, { kind: "habitation", angle: 152, dist: 47 },
  { kind: "medical", angle: 182, dist: 47 }, { kind: "command", angle: -150, dist: 49 }, { kind: "habitation", angle: -117, dist: 50 },
];

type P = { x: number; y: number };
const bez = (a: P, c: P, b: P, t: number): P => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });

/** Lay corridor floor along a curve with a round brush. Only void tiles are written, so module walls stay intact. */
function corridor(map: Tilemap, a: P, c: P, b: P, radius = 1.5) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - a.x, c.y - a.y);
  const n = Math.ceil(len * 2);
  for (let i = 0; i <= n; i++) {
    const p = bez(a, c, b, i / n);
    for (let y = Math.floor(p.y - radius); y <= Math.ceil(p.y + radius); y++)
      for (let x = Math.floor(p.x - radius); x <= Math.ceil(p.x + radius); x++)
        if (map.inBounds(x, y) && Math.hypot(x - p.x, y - p.y) <= radius && map.get(x, y) === TileKind.Void) map.set(x, y, TileKind.Floor);
  }
}

export function buildStarterStation(seed = 1): Station {
  const map = createTilemap(STATION_W, STATION_H);
  const rooms: Room[] = [], furniture: Furniture[] = [], deco: Deco[] = [];
  const floors = new Uint8Array(STATION_W * STATION_H);
  const rng: Rng = createRng(seed);
  const used = new Map<ModuleKind, Set<number>>();

  // plaza: an organic disc
  for (let y = CY - PLAZA_R - 2; y <= CY + PLAZA_R + 2; y++) for (let x = CX - PLAZA_R - 2; x <= CX + PLAZA_R + 2; x++) {
    const a = Math.atan2(y - CY, x - CX), r = PLAZA_R + 0.8 * Math.sin(3 * a + 0.6);
    if (Math.hypot(x - CX, y - CY) <= r) { map.set(x, y, TileKind.Floor); floors[y * STATION_W + x] = 8; }
  }

  const placed: Placed[] = [];
  for (const s of STARTER_SLOTS) {
    const rad = (s.angle * Math.PI) / 180, jitter = rng.int(-2, 2);
    const mx = Math.round(CX + Math.cos(rad) * (s.dist + jitter)), my = Math.round(CY + Math.sin(rad) * (s.dist + jitter));
    const seen = used.get(s.kind) ?? new Set<number>(); used.set(s.kind, seen);
    const preset = pickPreset(s.kind, rng, seen); seen.add(preset.variant);
    placed.push(stampModule({ map, rooms, furniture, deco, floors }, preset, mx, my, { x: CX - mx, y: CY - my }));
  }
  // spokes: from just outside each door, bending organically into the plaza edge
  placed.forEach((m, i) => {
    const start = { x: m.door.x + m.out.x, y: m.door.y + m.out.y };
    const ang = Math.atan2(start.y - CY, start.x - CX), end = { x: CX + Math.cos(ang) * (PLAZA_R - 1), y: CY + Math.sin(ang) * (PLAZA_R - 1) };
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, bend = (i % 2 ? 1 : -1) * (3 + (i % 3));
    const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    corridor(map, start, { x: mid.x - ((end.y - start.y) / len) * bend, y: mid.y + ((end.x - start.x) / len) * bend }, end);
  });
  // ring links between neighbouring modules, arcing inward
  placed.forEach((m, i) => {
    if (i % 2 === 1) return;                                // leave gaps: not every neighbour is linked
    const n = placed[(i + 1) % placed.length];
    const a = { x: m.door.x + m.out.x, y: m.door.y + m.out.y }, b = { x: n.door.x + n.out.x, y: n.door.y + n.out.y };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, k = 0.62;
    corridor(map, a, { x: CX + (mid.x - CX) * k, y: CY + (mid.y - CY) * k }, b, 1.2);
  });
  // walls around corridors and plaza
  for (let y = 0; y < STATION_H; y++) for (let x = 0; x < STATION_W; x++) ringWall(map, x, y);
  // plaza dressing: holo table, benches and planters
  const prop = (x: number, y: number, sprite: string) => { map.set(x, y, TileKind.Prop); deco.push({ x, y, sprite, layer: "prop" }); };
  prop(CX, CY, "prop:holo");
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; prop(Math.round(CX + Math.cos(a) * 5), Math.round(CY + Math.sin(a) * 5), i % 2 ? "plant:tree" : "prop:sofa"); }
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
