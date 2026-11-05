import type { World } from "../world";
import { findPath } from "../station/nav";
import { isWalkable } from "../station/tilemap";
import { CharState } from "./affordances";

function cancel(world: World, id: number): void {
  const a = world.actions[id];
  if (a && a.furnitureId >= 0 && world.reservations.get(a.furnitureId) === id) world.reservations.delete(a.furnitureId);
  world.actions[id] = null;
  world.chars.state[id] = CharState.Idle;
}

/** Tiles walked per tick (1.2: characters are 20% faster than one tile per sim second). */
export const WALK_SPEED = 1.2;
const MAX_WAIT = 4; // ticks to wait behind a standing character before pushing through

export function stepMovement(world: World): void {
  const c = world.chars, map = world.station.map;
  // tiles occupied by characters who are standing still this tick (not mid-walk)
  const still = new Uint16Array(map.w * map.h);
  for (let id = 0; id < c.count; id++) {
    const a = world.actions[id];
    if (!a || a.path.length === 0) still[c.y[id] * map.w + c.x[id]]++;
  }
  const isStill = (x: number, y: number) => still[y * map.w + x] > 0;
  for (let id = 0; id < c.count; id++) {
    if (!world.actions[id] || world.actions[id]!.path.length === 0) { c.walkAcc[id] = 0; continue; }
    const budget = c.walkAcc[id] + WALK_SPEED, steps = Math.floor(budget);
    c.walkAcc[id] = budget - steps;
    for (let s = 0; s < steps; s++) {
      const a = world.actions[id];
      if (!a || a.path.length === 0) { c.walkAcc[id] = 0; break; }
      const goal0 = a.path[a.path.length - 1];
      if (!isWalkable(map.get(goal0.x, goal0.y))) { cancel(world, id); break; }
      let next = a.path[0];
      if (!isWalkable(map.get(next.x, next.y))) {
        const goal = a.path[a.path.length - 1];
        const re = findPath(map, { x: Math.round(c.x[id]), y: Math.round(c.y[id]) }, goal);
        if (!re || re.length === 0) { cancel(world, id); break; }
        a.path = re; next = re[0];
      }
      const from = { x: c.x[id], y: c.y[id] };
      if (isStill(next.x, next.y) && !(next.x === from.x && next.y === from.y)) {
        const goal = a.path[a.path.length - 1];
        const alt = findPath(map, { x: Math.round(from.x), y: Math.round(from.y) }, goal, isStill);
        if (alt && alt.length && !isStill(alt[0].x, alt[0].y)) { a.path = alt; next = alt[0]; a.waited = 0; }
        else if ((a.waited = (a.waited ?? 0) + 1) <= MAX_WAIT) { c.walkAcc[id] = 0; break; } // wait politely, then push through
      }
      c.x[id] = next.x; c.y[id] = next.y;
      a.path.shift();
      c.state[id] = CharState.Walking;
      if (world.recordEvents) world.events.push({ type: "moved", id, from, to: { x: next.x, y: next.y } });
    }
  }
}
