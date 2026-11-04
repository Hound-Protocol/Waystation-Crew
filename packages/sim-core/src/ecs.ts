import type { World } from "./world";
import type { Department } from "./org/departments";
import type { Rank } from "./org/ranks";

export const NEEDS = ["hunger", "energy", "social", "hygiene", "fun"] as const;
export type NeedKey = (typeof NEEDS)[number];

export interface CharStore {
  count: number;
  cap: number;
  x: Float32Array; y: Float32Array;
  dept: Uint8Array; rank: Uint8Array; state: Uint8Array;
  hunger: Float32Array; energy: Float32Array; social: Float32Array; hygiene: Float32Array; fun: Float32Array;
  nextDecideTick: Int32Array;
  names: string[];
  name(id: number): string;
}

const F32 = ["x", "y", "hunger", "energy", "social", "hygiene", "fun"] as const;
const U8 = ["dept", "rank", "state"] as const;

export function createCharStore(cap = 256): CharStore {
  const s: any = { count: 0, cap, names: [] };
  for (const k of F32) s[k] = new Float32Array(cap);
  for (const k of U8) s[k] = new Uint8Array(cap);
  s.nextDecideTick = new Int32Array(cap);
  s.name = (id: number) => s.names[id];
  return s as CharStore;
}

function grow(s: CharStore): void {
  const cap = s.cap * 2;
  const g: any = s;
  for (const k of F32) { const n = new Float32Array(cap); n.set(g[k]); g[k] = n; }
  for (const k of U8) { const n = new Uint8Array(cap); n.set(g[k]); g[k] = n; }
  const nd = new Int32Array(cap); nd.set(s.nextDecideTick); s.nextDecideTick = nd;
  s.cap = cap;
}

export function addCharacter(
  world: World,
  init: { name: string; dept: Department; rank: Rank; x: number; y: number },
): number {
  const s = world.chars;
  if (s.count === s.cap) grow(s);
  const id = s.count++;
  s.x[id] = init.x; s.y[id] = init.y;
  s.dept[id] = init.dept; s.rank[id] = init.rank; s.state[id] = 0;
  s.hunger[id] = s.energy[id] = s.social[id] = s.hygiene[id] = s.fun[id] = 1;
  s.nextDecideTick[id] = world.tick;
  s.names[id] = init.name;
  return id;
}

export function hashChars(s: CharStore, h: { num(n: number): void; arr(a: ArrayLike<number>, n: number): void }): void {
  h.num(s.count);
  for (const k of [...F32, ...U8] as const) h.arr((s as any)[k], s.count);
}
