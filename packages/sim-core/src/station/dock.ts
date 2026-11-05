import { TileKind } from "./tilemap";
import { rotateCW, turnsToFace } from "./blueprint";
import { stampModule } from "./modules";
import { typeOf, typeIndex } from "./kit";
import { sealHull } from "./planner";
import { HUB } from "./constants";
import type { Room, Station } from "./starter";
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
  sealHull(st);
  void TileKind;
  return arrivals;
}
