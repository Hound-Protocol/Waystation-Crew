import { isWalkable, type Point, type Tilemap } from "./tilemap";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** A* on a 4-neighbour grid. Path excludes `from`, includes `to`. null if unreachable. */
export function findPath(map: Tilemap, from: Point, to: Point): Point[] | null {
  if (!map.inBounds(from.x, from.y) || !map.inBounds(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  if (!isWalkable(map.get(to.x, to.y))) return null;
  const { w, h } = map;
  const g = new Int32Array(w * h).fill(-1);
  const parent = new Int32Array(w * h).fill(-1);
  const heap: number[] = []; // entries: f * 65536 + idx is unsafe for big maps; use parallel arrays
  const hf: number[] = [];
  const push = (idx: number, f: number) => {
    heap.push(idx); hf.push(f);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= hf[i]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const li = heap.length - 1;
    heap[0] = heap[li]; hf[0] = hf[li]; heap.pop(); hf.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < heap.length && hf[l] < hf[m]) m = l;
      if (r < heap.length && hf[r] < hf[m]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m;
    }
    return top;
  };
  const hh = (x: number, y: number) => Math.abs(x - to.x) + Math.abs(y - to.y);
  const start = from.y * w + from.x, goal = to.y * w + to.x;
  g[start] = 0; push(start, hh(from.x, from.y));
  while (heap.length) {
    const cur = pop();
    if (cur === goal) {
      const out: Point[] = [];
      for (let c = goal; c !== start; c = parent[c]) out.push({ x: c % w, y: (c / w) | 0 });
      return out.reverse();
    }
    const cx = cur % w, cy = (cur / w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!map.inBounds(nx, ny) || !isWalkable(map.get(nx, ny))) continue;
      const ni = ny * w + nx, ng = g[cur] + 1;
      if (g[ni] !== -1 && g[ni] <= ng) continue;
      g[ni] = ng; parent[ni] = cur; push(ni, ng + hh(nx, ny));
    }
  }
  return null;
}
