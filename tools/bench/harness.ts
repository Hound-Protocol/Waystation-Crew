import { createWorld, addCharacter, step, createTilemap, TileKind, Department, Rank, type Station, type World } from "@wc/sim-core";

/** Open-floor station of size n x n with scattered furniture, for load testing. */
export function bigStation(n: number): Station {
  const map = createTilemap(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) map.set(x, y, TileKind.Floor);
  const furniture: Station["furniture"] = [];
  const kinds = [TileKind.Table, TileKind.Bed, TileKind.Plant, TileKind.Console];
  for (let y = 2; y < n - 2; y += 3) for (let x = 2; x < n - 2; x += 3) {
    const kind = kinds[(x * 7 + y * 13) % kinds.length];
    map.set(x, y, kind);
    furniture.push({ id: furniture.length, kind, x, y, roomId: 0 });
  }
  return { map, rooms: [], furniture };
}

export function makeWorld(count: number, n = 200, seed = 1): World {
  const w = createWorld(seed, bigStation(n));
  for (let i = 0; i < count; i++) {
    const id = addCharacter(w, { name: `B${i}`, dept: (i % 6) as Department, rank: Rank.Trainee, x: 1 + ((i * 7) % (n - 2)), y: 1 + ((i * 13) % (n - 2)) });
    const r = w.rng;
    w.chars.hunger[id] = 0.05 + r.next() * 0.95; w.chars.energy[id] = 0.05 + r.next() * 0.95; w.chars.fun[id] = 0.05 + r.next() * 0.95;
    // keep characters off furniture tiles
    while (!isFree(w, w.chars.x[id], w.chars.y[id])) { w.chars.x[id] = (w.chars.x[id] + 1) % n; }
  }
  return w;
}
const isFree = (w: World, x: number, y: number) => w.station.map.get(x, y) === TileKind.Floor;

export function runTicks(w: World, ticks: number): number[] {
  const ms: number[] = [];
  for (let t = 0; t < ticks; t++) { const s = performance.now(); step(w); ms.push(performance.now() - s); }
  return ms;
}
export const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
