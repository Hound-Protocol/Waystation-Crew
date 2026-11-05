import { deliverFuel } from "../power/grid";
import type { World } from "../world";
import type { Station } from "../station/starter";
import type { Action } from "../ai/affordances";
import { ActionKind, CharState } from "../ai/affordances";
import { interactionPoint } from "../station/starter";
import { findPath } from "../station/nav";
import { Department } from "../org/departments";
import { shiftOf } from "../org/jobs";
import { shipPose, type ShipPose } from "./pose";
import { shipPhase } from "./timeline";
import { flightSeats } from "./crew";

/**
 * The ship's rules in the sim. The ship's interior is a fixed space inside the station map (crew walk it through the stern gate while it is docked);
 * the flying body is the viewer's. The ship only leaves with its pilot and co-pilot seated: until they are, the whole schedule slips (`slip` ticks late).
 * Once the gate starts closing everyone aboard is its crew, locked in until the ship docks again.
 */
export interface Region { x: number; y: number; w: number; h: number }
export interface ShipOps { region: Region | null; /** ticks the schedule is late */ slip: number; /** waiting at the door for pilots */ holding: boolean; /** ids riding this trip */ crew: number[] }

export function createShipOps(station: Station): ShipOps {
  const r = station.rooms.find((q) => q.name === "Cargo Ship");
  return { region: r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null, slip: 0, holding: false, crew: [] };
}

/** The ship's own clock: the sim clock minus the time it has spent waiting for pilots. */
export const shipNow = (w: World) => w.tick - w.ship.slip;
export const shipPoseNow = (w: World): ShipPose => shipPose(shipNow(w));

export function inShip(w: World, x: number, y: number): boolean {
  const r = w.ship.region;
  return !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Docked at the station with the gate fully open: the only time anyone may cross between the station and the ship. */
export function shipBoardable(w: World): boolean {
  const p = shipPoseNow(w);
  return p.at === "station" && p.phase === "docked" && p.stationGate.v === 1;
}

/** Tiles this character may not step onto: across the ship's hull line, unless the ship is boardable and they are Flight crew (anyone may leave). */
export function blockedFor(w: World, id: number, from: { x: number; y: number }): (x: number, y: number) => boolean {
  if (!w.ship.region) return () => false;
  const fromIn = inShip(w, from.x, from.y), ok = shipBoardable(w) && (fromIn || w.chars.dept[id] === Department.Flight);
  return (x, y) => inShip(w, x, y) !== fromIn && !ok;
}

function seated(w: World, furnId: number): boolean {
  const id = w.reservations.get(furnId);
  if (id === undefined || w.chars.dept[id] !== Department.Flight || w.chars.state[id] !== CharState.Working) return false;
  const ip = interactionPoint(w.station.map, w.station.furniture[furnId]);
  return !!ip && w.chars.x[id] === ip.x && w.chars.y[id] === ip.y;
}

/** Per tick: hold the schedule at the door until the pilot and co-pilot are seated; lock the crew in at departure; release them at docking. */
export function stepShip(w: World): void {
  const sh = w.ship;
  if (!sh.region) return;
  const p = shipPhase(shipNow(w));
  sh.holding = false;
  if (p.at === "station" && p.phase === "docked") {
    sh.crew = [];
    if (p.t === 0) deliverFuel(w);                                  // the arrival tick, once per cycle
    if (p.t === p.dur - 1) {
      const seats = flightSeats(w.station);
      if (!seats || !seated(w, seats.pilot) || !seated(w, seats.copilot)) { sh.slip++; sh.holding = true; }
    }
  } else if (p.at === "station" && p.phase === "gate-closing" && p.t === 0) {
    sh.crew = [];
    for (let id = 0; id < w.chars.count; id++) if (inShip(w, w.chars.x[id], w.chars.y[id])) sh.crew.push(id);
  }
}

/** What a locked-in crew member does: sit at their own console if it is their shift and nobody else holds it, or just stay put. */
export function crewAction(w: World, id: number): Action | null {
  if (!w.ship.crew.includes(id)) return null;
  const j = w.chars.job[id], post = j >= 0 ? w.posts[j] : null;
  const held = post ? w.reservations.get(post.workstationFurnitureId) : undefined;
  if (post && post.dept === Department.Flight && post.shift === shiftOf(w.tick) && (held === undefined || held === id)) {   // only the one on shift, and only a free console
    const f = w.station.furniture[post.workstationFurnitureId], ip = interactionPoint(w.station.map, f);
    const path = ip ? findPath(w.station.map, { x: Math.round(w.chars.x[id]), y: Math.round(w.chars.y[id]) }, ip) : null;
    if (path) return { kind: ActionKind.Work, furnitureId: f.id, path, ticksLeft: 60 };
  }
  return { kind: ActionKind.Idle, furnitureId: -1, path: [], ticksLeft: 60 };
}
