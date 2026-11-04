import { createRng, type Rng } from "./rng";
import { createCharStore, hashChars, type CharStore } from "./ecs";

export interface World {
  seed: number;
  tick: number;
  rng: Rng;
  chars: CharStore;
  /** extension point: hash contributors registered by subsystems */
  hashers: Array<(h: Hasher) => void>;
}

export interface Hasher {
  num(n: number): void;
  arr(a: ArrayLike<number>, len: number): void;
}

export function createWorld(seed: number): World {
  return { seed, tick: 0, rng: createRng(seed), chars: createCharStore(), hashers: [] };
}

export function step(world: World): void {
  world.tick += 1;
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
