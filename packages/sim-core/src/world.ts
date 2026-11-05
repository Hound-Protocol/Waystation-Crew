import { createRng, type Rng } from "./rng";
import { buildStarterStation, type Station } from "./station/starter";
import type { Point } from "./station/tilemap";
import type { Action } from "./ai/affordances";
import { decayNeeds } from "./ai/needs";
import { buildJobPosts, type JobPost } from "./org/jobs";
import { stepMovement } from "./ai/move";
import { stepAI, stepActions } from "./ai/decide";
import { growIfNeeded, GROWTH_INTERVAL } from "./station/growth";
import { createCharStore, hashChars, type CharStore } from "./ecs";

export type WorldEvent = { type: "moved"; id: number; from: Point; to: Point } | { type: "state"; id: number; state: number };

export interface World {
  seed: number;
  tick: number;
  rng: Rng;
  chars: CharStore;
  station: Station;
  furnitureByKind: Map<number, number[]>;
  reservations: Map<number, number>; // furnitureId -> charId
  actions: Array<Action | null>;
  posts: JobPost[];
  postHolder: Map<number, number>; // postId -> charId
  stats: { decisions: number };
  /** bumps whenever the station grows; viewers re-sync the map when it changes */
  stationRev: number;
  recordEvents: boolean;
  events: WorldEvent[];
  /** extension point: hash contributors registered by subsystems */
  hashers: Array<(h: Hasher) => void>;
}

export interface Hasher {
  num(n: number): void;
  arr(a: ArrayLike<number>, len: number): void;
}

export function createWorld(seed: number, station: Station = buildStarterStation()): World {
  const furnitureByKind = new Map<number, number[]>();
  for (const f of station.furniture) {
    if (!furnitureByKind.has(f.kind)) furnitureByKind.set(f.kind, []);
    furnitureByKind.get(f.kind)!.push(f.id);
  }
  return {
    seed, tick: 0, rng: createRng(seed), chars: createCharStore(), station, furnitureByKind,
    reservations: new Map(), actions: [], posts: buildJobPosts(station), postHolder: new Map(), stats: { decisions: 0 }, stationRev: 0, recordEvents: false, events: [], hashers: [],
  };
}

export function step(world: World): void {
  world.tick += 1;
  decayNeeds(world);
  stepAI(world);
  stepMovement(world);
  stepActions(world);
  if (world.tick % GROWTH_INTERVAL === 0) growIfNeeded(world);
}

export function stepMany(world: World, n: number): void {
  for (let i = 0; i < n; i++) step(world);
}

export function hashWorld(world: World): number {
  let h = 0x811c9dc5;
  const num = (n: number) => {
    const v = Math.round(n * 1000) | 0;
    for (let b = 0; b < 4; b++) h = Math.imul(h ^ ((v >>> (b * 8)) & 255), 16777619) >>> 0;
  };
  const hasher: Hasher = { num, arr: (a, len) => { for (let i = 0; i < len; i++) num(a[i]); } };
  num(world.seed); num(world.tick); num(world.rng.state());
  hashChars(world.chars, hasher);
  for (const f of world.hashers) f(hasher);
  return h >>> 0;
}
