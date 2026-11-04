import type { World } from "../world";
import { findPath } from "../station/nav";
import { interactionPoint } from "../station/starter";
import { isWalkable, type Point } from "../station/tilemap";
import { AFFORDANCES, ActionKind, stateForAction, type Action } from "./affordances";

const SAMPLE = 8;

export interface Scored { action: Action; score: number; why: string }

function pos(world: World, id: number): Point {
  return { x: Math.round(world.chars.x[id]), y: Math.round(world.chars.y[id]) };
}

/** All scored candidates, best first. Pure except for seeded rng draws. */
export function scoreOptions(world: World, id: number): Scored[] {
  const c = world.chars, map = world.station.map, rng = world.rng;
  const from = pos(world, id);
  const out: Scored[] = [];
  for (const aff of AFFORDANCES) {
    const need = c[aff.satisfies][id];
    const urgency = (1 - need) * (1 - need) * aff.weight;
    if (urgency < 0.02) continue;
    const pool = world.furnitureByKind.get(aff.furnitureKind);
    if (!pool || pool.length === 0) continue;
    let bestIdx = -1, bestDist = Infinity;
    for (let s = 0; s < Math.min(SAMPLE, pool.length); s++) {
      const fid = pool[rng.int(0, pool.length - 1)];
      if (world.reservations.has(fid)) continue;
      const f = world.station.furniture[fid];
      const d = Math.abs(f.x - from.x) + Math.abs(f.y - from.y);
      if (d < bestDist) { bestDist = d; bestIdx = fid; }
    }
    if (bestIdx < 0) continue;
    const f = world.station.furniture[bestIdx];
    const ip = interactionPoint(map, f);
    if (!ip) continue;
    const path = findPath(map, from, ip);
    if (!path) continue;
    const score = urgency - 0.0015 * path.length + rng.next() * 0.02;
    out.push({
      action: { kind: aff.kind, furnitureId: bestIdx, path, ticksLeft: aff.durationTicks },
      score,
      why: `${aff.satisfies}=${need.toFixed(2)} urgency ${urgency.toFixed(2)}, ${path.length} tiles away`,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function decide(world: World, id: number): Action {
  const opts = scoreOptions(world, id);
  if (opts.length) return opts[0].action;
  const map = world.station.map, from = pos(world, id), rng = world.rng;
  for (let tries = 0; tries < 5; tries++) {
    const to = { x: from.x + rng.int(-8, 8), y: from.y + rng.int(-8, 8) };
    if (!map.inBounds(to.x, to.y) || !isWalkable(map.get(to.x, to.y))) continue;
    const path = findPath(map, from, to);
    if (path && path.length) return { kind: ActionKind.Wander, furnitureId: -1, path, ticksLeft: 0 };
  }
  return { kind: ActionKind.Idle, furnitureId: -1, path: [], ticksLeft: rng.int(5, 15) };
}

export function stepAI(world: World): void {
  const c = world.chars;
  let n = 0;
  for (let id = 0; id < c.count; id++) {
    if (world.actions[id] || c.nextDecideTick[id] > world.tick) continue;
    const a = decide(world, id);
    world.actions[id] = a;
    if (a.furnitureId >= 0) world.reservations.set(a.furnitureId, id);
    c.state[id] = stateForAction(a.kind, a.path.length === 0);
    c.nextDecideTick[id] = world.tick + world.rng.int(5, 30);
    n++;
  }
  world.stats.decisions = n;
}

/** Performs the action at its destination; completes and releases reservations. */
export function stepActions(world: World): void {
  const c = world.chars;
  for (let id = 0; id < c.count; id++) {
    const a = world.actions[id];
    if (!a || a.path.length > 0) continue;
    c.state[id] = stateForAction(a.kind, true);
    const aff = AFFORDANCES.find((x) => x.kind === a.kind);
    if (aff) {
      const arr = c[aff.satisfies];
      arr[id] = Math.min(1, arr[id] + aff.amountPerTick);
      a.ticksLeft--;
      if (a.ticksLeft > 0 && arr[id] < 0.98) continue;
    } else if (a.kind === ActionKind.Idle && --a.ticksLeft > 0) continue;
    if (a.furnitureId >= 0 && world.reservations.get(a.furnitureId) === id) world.reservations.delete(a.furnitureId);
    world.actions[id] = null;
    c.state[id] = 0;
  }
}
