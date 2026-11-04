import { isWalkable, TileKind, type Point, type Tilemap } from "./tilemap";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

const buf = { n: 0, g: new Float64Array(0), stamp: new Uint32Array(0), parent: new Int32Array(0), gen: 0, heap: new Int32Array(1024), hf: new Float64Array(1024) };
const BED_COST = 3;   // walking over beds is allowed but discouraged
const TURN_COST = 0.3; // prefer long straight runs over staircases

/**
 * A* on a 4-neighbour grid over (tile, heading) states. Step cost 1, plus a small turn cost (straight
 * runs, no zigzags) and a bed surcharge. `blocked` tiles are avoided; the goal is never blocked.
 * Path excludes `from`, includes `to`. null if unreachable.
 */
export function findPath(map: Tilemap, from: Point, to: Point, blocked?: (x: number, y: number) => boolean): Point[] | null {
  if (!map.inBounds(from.x, from.y) || !map.inBounds(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  if (!isWalkable(map.get(to.x, to.y))) return null;
  const { w, h } = map;
  const N = w * h * 5; // heading 0..3, 4 = none (start)
  if (buf.n < N) { buf.n = N; buf.g = new Float64Array(N); buf.stamp = new Uint32Array(N); buf.parent = new Int32Array(N); buf.gen = 0; }
  const gen = ++buf.gen, g = buf.g, stamp = buf.stamp, parent = buf.parent;
  let hs = 0; // heap size
  const push = (s: number, f: number) => {
    if (hs >= buf.heap.length) { const nh = new Int32Array(hs * 2), nf = new Float64Array(hs * 2); nh.set(buf.heap); nf.set(buf.hf); buf.heap = nh; buf.hf = nf; }
    const hp = buf.heap, hq = buf.hf;
    let i = hs++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hq[p] <= f) break;
      hp[i] = hp[p]; hq[i] = hq[p]; i = p;
    }
    hp[i] = s; hq[i] = f;
  };
  const pop = (): number => {
    const hp = buf.heap, hq = buf.hf;
    const top = hp[0];
    hs--;
    if (hs > 0) {
      const s = hp[hs], f = hq[hs];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= hs) break;
        const r = l + 1, m = r < hs && hq[r] < hq[l] ? r : l;
        if (hq[m] >= f) break;
        hp[i] = hp[m]; hq[i] = hq[m]; i = m;
      }
      hp[i] = s; hq[i] = f;
    }
    return top;
  };
  const hh = (x: number, y: number) => { const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y); return dx + dy + (dx && dy ? TURN_COST : 0); };
  const start = (from.y * w + from.x) * 5 + 4;
  g[start] = 0; stamp[start] = gen; parent[start] = -1; push(start, hh(from.x, from.y));
  while (hs > 0) {
    const cur = pop();
    const tile = (cur / 5) | 0, dir = cur % 5;
    const cx = tile % w, cy = (tile / w) | 0;
    if (cx === to.x && cy === to.y) {
      const out: Point[] = [];
      for (let c = cur; c !== start; c = parent[c]) { const tl = (c / 5) | 0; out.push({ x: tl % w, y: (tl / w) | 0 }); }
      return out.reverse();
    }
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (!map.inBounds(nx, ny)) continue;
      const k = map.get(nx, ny);
      if (!isWalkable(k)) continue;
      const isGoal = nx === to.x && ny === to.y;
      if (!isGoal && blocked && blocked(nx, ny)) continue;
      const ni = (ny * w + nx) * 5 + d;
      const ng = g[cur] + 1 + (dir !== 4 && dir !== d ? TURN_COST : 0) + (k === TileKind.Bed && !isGoal ? BED_COST : 0);
      if (stamp[ni] === gen && g[ni] <= ng) continue;
      stamp[ni] = gen; g[ni] = ng; parent[ni] = cur; push(ni, ng + hh(nx, ny));
    }
  }
  return null;
}
