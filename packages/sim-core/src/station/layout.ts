import { TileKind, createTilemap } from "./tilemap";
import { createRng, type Rng } from "../rng";
import { MOUNTS, type ModuleKind } from "./modules";
import { buildRoom, carveHall, sealHull } from "./planner";
import { buildDock } from "./dock";
import { furnishRoom } from "./furnish";
import { nextBuild } from "./demand";
import { HUB, PLAZA_R, STATION_H, STATION_W } from "./constants";
import type { Station, Room, Deco } from "./starter";
import type { Tilemap } from "./tilemap";

export { STATION_W, STATION_H, HUB } from "./constants";

/** Crew the starter station is sized for. */
export const STARTER_CREW = 100;

/** Grow the station by one room if `pop` crew need it. Returns the new room, or null when nothing is needed or there is no space. */
export function growStation(st: Station, pop: number, rng: Rng): Room | null {
  const kind: ModuleKind | null = nextBuild(st, pop);
  if (!kind) return null;
  if (kind === "arrivals") { const hall = buildDock(st, rng); if (hall) { for (const r of st.rooms) if (!r.dockDone) { r.dockDone = true; furnishRoom(st, r); addWallMounts(st, r, rng); } return hall; } }
  const room = buildRoom(st, kind, rng);
  if (room) { furnishRoom(st, room); addWallMounts(st, room, rng); }
  return room;
}

/** The seed: a plaza and a cross of halls. Everything else is grown by the planner. */
export function seedStation(): Station {
  const map = createTilemap(STATION_W, STATION_H);
  const st: Station = { map, rooms: [], furniture: [], deco: [], floors: new Uint8Array(STATION_W * STATION_H), halls: [] };
  for (let y = HUB.y - 12; y <= HUB.y + 12; y++) for (let x = HUB.x - 12; x <= HUB.x + 12; x++) {
    const a = Math.atan2(y - HUB.y, x - HUB.x), r = PLAZA_R + 0.8 * Math.sin(3 * a + 0.6);
    if (Math.hypot(x - HUB.x, y - HUB.y) <= r) { map.set(x, y, TileKind.Floor); st.floors![y * STATION_W + x] = 8; }
  }
  carveHall(st, { x0: HUB.x - 40, y0: HUB.y, x1: HUB.x + 40, y1: HUB.y });
  carveHall(st, { x0: HUB.x, y0: HUB.y - 40, x1: HUB.x, y1: HUB.y + 40 });
  const R = 27;                                                       // ring road: the Box layout's inner loop
  carveHall(st, { x0: HUB.x - R, y0: HUB.y - R, x1: HUB.x + R, y1: HUB.y - R }); carveHall(st, { x0: HUB.x - R, y0: HUB.y + R, x1: HUB.x + R, y1: HUB.y + R });
  carveHall(st, { x0: HUB.x - R, y0: HUB.y - R, x1: HUB.x - R, y1: HUB.y + R }); carveHall(st, { x0: HUB.x + R, y0: HUB.y - R, x1: HUB.x + R, y1: HUB.y + R });
  const prop = (x: number, y: number, sprite: string) => { map.set(x, y, TileKind.Prop); st.deco!.push({ x, y, sprite, layer: "prop" }); };
  prop(HUB.x, HUB.y, "prop:holo");
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.6; prop(Math.round(HUB.x + Math.cos(a) * 3.5), Math.round(HUB.y + Math.sin(a) * 3.5), i % 2 ? "plant:tree" : "prop:sofa"); }
  sealHull(st);
  return st;
}

export function buildStarterStation(seed = 1): Station {
  const st = seedStation(), rng = createRng(seed);
  for (let i = 0; i < 300; i++) if (!growStation(st, STARTER_CREW, rng)) break;
  st.furniture.forEach((f, i) => { f.id = i; });
  return st;
}

/** Dress the wall faces of a new room with a seeded scatter of monitors, signs and fittings. */
export function addWallMounts(st: Station, room: Room, rng: Rng): void {
  const map: Tilemap = st.map, deco: Deco[] = st.deco!;
  for (let y = room.y - 1; y <= room.y + room.h; y++) for (let x = room.x - 1; x <= room.x + room.w; x++) {
    if (!map.inBounds(x, y + 1) || map.get(x, y) !== TileKind.Wall || map.get(x, y + 1) !== TileKind.Floor) continue;
    if (map.get(x - 1, y) !== TileKind.Wall || map.get(x + 1, y) !== TileKind.Wall || map.get(x, y - 1) === TileKind.Floor) continue;
    if ((x * 7 + y * 13 + rng.int(0, 2)) % 3 !== 0 || deco.some((d) => d.x === x && d.y === y && d.layer === "wall")) continue;
    const list = MOUNTS[(room.kind as ModuleKind) ?? "habitation"];
    deco.push({ x, y, sprite: list[rng.int(0, list.length - 1)], layer: "wall" });
  }
}
