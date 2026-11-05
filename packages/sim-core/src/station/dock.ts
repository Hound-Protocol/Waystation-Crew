import { TileKind } from "./tilemap";
import { rotateCW, turnsToFace } from "./blueprint";
import { stampModule } from "./modules";
import { typeOf, typeIndex } from "./kit";
import { sealHull } from "./planner";
import { HUB } from "./constants";
import { createTilemap } from "./tilemap";
import type { Room, Station, ShipChunk } from "./starter";
import type { Rng } from "../rng";

const EAST = { x: 1, y: 0 };

/**
 * The dock. The Arrivals hall closes the west arm of the station (the side facing the home planet), its door toward the plaza
 * and its airlocks toward space. The cargo ship parks nose-out beyond it, its rear-ramp airlocks touching the hall's airlocks.
 * Returns the Arrivals room; the ship is the room added after it.
 */
export function buildDock(st: Station, rng: Rng): Room | null {
  const west = (st.halls ?? []).filter((h) => h.y0 === h.y1 && h.y0 === HUB.y).reduce((m, h) => Math.min(m, h.x0), Infinity);
  if (!isFinite(west)) return null;
  const turns = turnsToFace(EAST);
  const target = { map: st.map, rooms: st.rooms, furniture: st.furniture, deco: st.deco!, floors: st.floors! };
  type Rot = ReturnType<typeof rotateCW>;
  const stamp = (id: string, ox: (rot: Rot, gw: number, gh: number) => number, oy: (rot: Rot, gw: number, gh: number) => number) => {
    const type = typeOf(id), bp = type.make(rng.fork(`dock:${id}`)), rot = rotateCW(bp, turns);
    const gw = rot.grid[0].length, gh = rot.grid.length;
    const x0 = ox(rot, gw, gh), y0 = oy(rot, gw, gh), before = st.furniture.length;
    stampModule(target, { kind: type.kind, variant: typeIndex(type.id), blueprint: bp }, x0 + gw / 2, y0 + gh / 2, EAST);
    for (let i = before; i < st.furniture.length; i++) st.furniture[i].id = i;
    return { x0, gw };
  };
  // Arrivals: its door cell sits on the hall's end cap, so the hall floor continues straight into it
  const arr = stamp("arrivals_hall", (rot) => west - 1 - rot.door.x, (rot) => HUB.y - rot.door.y);
  const arrivals = st.rooms[st.rooms.length - 1];
  // Ship: stern airlocks one column west of the Arrivals airlocks (the airlock edge is the hall's west column)
  stamp("ship_deck", (_rot, gw) => arr.x0 - gw, (rot) => HUB.y - rot.door.y);
  // seats on the far hull face back the other way (sprites are not rotated with the blueprint)
  const ship = st.rooms[st.rooms.length - 1], mid = ship.y + ship.h / 2;
  for (const d of st.deco!) if (d.sprite === "prop:jumpseat" && d.y > mid) d.sprite = "prop:jumpseat-n";
  // One gateway: Arrivals' airlock cells that don't face the ship's stern gate become plain wall, leaving a 2-wide run exactly as tall as the ramp
  const gate = new Set<string>();
  for (let y = ship.y; y < ship.y + ship.h; y++) for (let x = ship.x; x < ship.x + ship.w; x++) if (st.map.get(x, y) === TileKind.Airlock && st.map.get(x + 1, y) === TileKind.Airlock) gate.add(`${x + 1},${y}`);
  for (let y = arrivals.y; y < arrivals.y + arrivals.h; y++) for (let x = arrivals.x; x < arrivals.x + arrivals.w; x++) if (st.map.get(x, y) === TileKind.Airlock && !gate.has(`${x},${y}`) && (st.map.get(x - 1, y) !== TileKind.Airlock)) st.map.set(x, y, TileKind.Wall);
  sealHull(st);
  void TileKind;
  return arrivals;
}

/**
 * The ship's deck as a chunk of its own: an exact copy of the "Cargo Ship" region of the station map, in local coordinates.
 * The sim keeps the interior in the station's sim-space (crew walk it through the gate while docked); the body that flies is drawn by the viewer from this copy.
 */
export function extractShip(st: Station): ShipChunk | undefined {
  const room = st.rooms.find((r) => r.name === "Cargo Ship");
  if (!room) return undefined;
  const { x: bx, y: by, w, h } = room, map = createTilemap(w, h), floors = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { map.set(x, y, st.map.get(bx + x, by + y)); floors[y * w + x] = st.floors![(by + y) * st.map.w + bx + x]; }
  const inside = (d: { x: number; y: number }) => d.x >= bx && d.x < bx + w && d.y >= by && d.y < by + h;
  const furniture = st.furniture.filter(inside).map((f, i) => ({ ...f, id: i, roomId: 0, x: f.x - bx, y: f.y - by }));
  const deco = st.deco!.filter(inside).map((d) => ({ ...d, x: d.x - bx, y: d.y - by }));
  return { map, rooms: [{ ...room, id: 0, x: 0, y: 0 }], furniture, deco, floors, berth: { x: bx, y: by, w, h } };
}
