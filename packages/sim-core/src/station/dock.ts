import { TileKind, createTilemap } from "./tilemap";
import { rotateCW, turnsToFace } from "./blueprint";
import { stampModule } from "./modules";
import { typeOf, typeIndex } from "./kit";
import { sealHull, BERTH } from "./planner";
import { HUB } from "./constants";
import type { Room, Station, ShipChunk } from "./starter";
import type { Rng } from "../rng";

const EAST = { x: 1, y: 0 };

/**
 * The dock. The Arrivals hall closes the west arm of the station (the side facing the home planet), its door toward the plaza
 * and its airlocks toward space. The cargo ship parks nose-out beyond it, its rear-ramp airlocks touching the hall's airlocks;
 * its deck is a chunk of its own (`st.ship`) and the berth in the station map stays empty space.
 * Returns the Arrivals room.
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
  // Ship: its own chunk, parked in the berth whose east edge touches the Arrivals airlock column
  const sType = typeOf("ship_deck"), sBp = sType.make(rng.fork("dock:ship_deck")), sRot = rotateCW(sBp, turns);
  const gw = sRot.grid[0].length, gh = sRot.grid.length;
  const berth = { x: arr.x0 - gw, y: HUB.y - sRot.door.y, w: gw, h: gh };
  const chunk: ShipChunk = { map: createTilemap(gw, gh), rooms: [], furniture: [], deco: [], floors: new Uint8Array(gw * gh), berth };
  stampModule({ map: chunk.map, rooms: chunk.rooms, furniture: chunk.furniture, deco: chunk.deco!, floors: chunk.floors! }, { kind: sType.kind, variant: typeIndex(sType.id), blueprint: sBp }, gw / 2, gh / 2, EAST);
  for (let i = 0; i < chunk.furniture.length; i++) chunk.furniture[i].id = i;
  // seats on the far hull face back the other way (sprites are not rotated with the blueprint)
  const mid = gh / 2;
  for (const d of chunk.deco!) if (d.sprite === "prop:jumpseat" && d.y > mid) d.sprite = "prop:jumpseat-n";
  st.ship = chunk;
  // The berth is empty space (reserved): clear the Arrivals hull ring off it
  for (let y = berth.y; y < berth.y + gh; y++) for (let x = berth.x; x < berth.x + gw; x++) { st.map.set(x, y, TileKind.Void); st.floors![y * st.map.w + x] = BERTH; }
  st.deco = st.deco!.filter((d) => d.x < berth.x || d.x >= berth.x + gw || d.y < berth.y || d.y >= berth.y + gh);
  // One gateway: only the Arrivals airlock cells facing the ship's stern gate stay; any other airlock cell becomes plain wall
  const gate = new Set<number>();
  for (let y = 0; y < gh; y++) if (chunk.map.get(gw - 1, y) === TileKind.Airlock) gate.add(berth.y + y);
  for (let y = arrivals.y; y < arrivals.y + arrivals.h; y++) for (let x = arrivals.x; x < arrivals.x + arrivals.w; x++) if (st.map.get(x, y) === TileKind.Airlock && !(x === arrivals.x && gate.has(y))) st.map.set(x, y, TileKind.Wall);
  sealHull(st);
  void TileKind;
  return arrivals;
}
