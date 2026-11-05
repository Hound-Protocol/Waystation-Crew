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
import { createShipOps, stepShip, type ShipOps } from "./ship/ops";
import { createLightOps, stepLights, type LightOps } from "./light/ops";
import { createGrid, stepGrid, type PowerGrid } from "./power/grid";
import { stepPower } from "./power/ops";

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
  /** the cargo ship's rules: schedule slip, crew, boarding (see ship/ops.ts) */
  ship: ShipOps;
  /** Engineering's lamp survey and build orders (see light/ops.ts) */
  light: LightOps;
  /** the reactor, battery and what the station draws (see power/grid.ts) */
  power: PowerGrid;
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
    reservations: new Map(), actions: [], posts: buildJobPosts(station), postHolder: new Map(), stats: { decisions: 0 }, stationRev: 0, ship: createShipOps(station), light: createLightOps(station), power: createGrid(), recordEvents: false, events: [], hashers: [],
  };
}

export function step(world: World): void {
  world.tick += 1;
  stepShip(world);
  stepLights(world);
  stepGrid(world);
  stepPower(world);
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
  num(world.ship.slip); num(world.ship.crew.length); num(world.ship.holding ? 1 : 0);
  num(world.light.built); num(world.light.orders.length);
  num(["offline", "starting", "running", "scram"].indexOf(world.power.reactor.status)); num(world.power.reactor.output); num(world.power.battery); num(world.power.fuelStore);
  for (const f of world.hashers) f(hasher);
  return h >>> 0;
}
