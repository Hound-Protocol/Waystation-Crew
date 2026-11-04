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

export function stepMovement(world: World): void {
  const c = world.chars, map = world.station.map;
  for (let id = 0; id < c.count; id++) {
    const a = world.actions[id];
    if (!a || a.path.length === 0) continue;
    const goal0 = a.path[a.path.length - 1];
    if (!isWalkable(map.get(goal0.x, goal0.y))) { cancel(world, id); continue; }
    let next = a.path[0];
    if (!isWalkable(map.get(next.x, next.y))) {
      const goal = a.path[a.path.length - 1];
      const re = findPath(map, { x: Math.round(c.x[id]), y: Math.round(c.y[id]) }, goal);
      if (!re || re.length === 0) { cancel(world, id); continue; }
      a.path = re; next = re[0];
    }
    const from = { x: c.x[id], y: c.y[id] };
    c.x[id] = next.x; c.y[id] = next.y;
    a.path.shift();
    c.state[id] = CharState.Walking;
    if (world.recordEvents) world.events.push({ type: "moved", id, from, to: { x: next.x, y: next.y } });
  }
}
