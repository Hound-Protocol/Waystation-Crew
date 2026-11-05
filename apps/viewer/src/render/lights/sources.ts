import { TileKind } from "@wc/sim-core";
import type { BakeInput } from "../tiles";
import { glowOf } from "../sprites/library";
import type { LightKind, LightSource } from "./types";

export type { LightKind, LightSource };

const PX = 16;
const WARM: [number, number, number] = [255, 190, 120];
const CEILING: [number, number, number] = [255, 170, 90];
/** Tiles of floor one ceiling light covers. */
const FLOOR_PER_LIGHT = 36;
/** Matches the sim's LAMP_REACH so viewer lighting agrees with what Engineering computes. */
const LAMP_REACH = 5;

/** Slot in the id space; one tile can hold one light per category. */
const enum Cat { Prop, Furniture, Wall, Corridor, Ceiling, COUNT }

/** Light a sprite emits, in tiles. */
function emit(name: string): { r: number; i: number; c: [number, number, number] } | null {
  if (name === "wall:light") return { r: LAMP_REACH, i: 0.9, c: WARM };
  const g = glowOf(name);
  return g ? { r: g.r / PX, i: g.i, c: g.c } : null;
}

const DEFAULT_STYLE: Record<number, string> = { [TileKind.Bed]: "bed:habitation", [TileKind.Console]: "console:habitation", [TileKind.Table]: "table:basic", [TileKind.Plant]: "plant:fern" };

/** Every light the station casts: positions and radii in tiles, ids stable from position + kind. Pure; same input gives deep-equal output. */
export function deriveLights(inp: BakeInput): LightSource[] {
  const { w, h, tiles } = inp;
  const out: LightSource[] = [];
  const used = new Set<number>();
  const push = (cat: Cat, tx: number, ty: number, l: Omit<LightSource, "id">) => {
    let id = (ty * w + tx) * Cat.COUNT + cat;
    while (used.has(id)) id += w * h * Cat.COUNT;   // same slot twice: bump past the whole tile space
    used.add(id);
    out.push({ id, ...l });
  };
  const glow = (cat: Cat, name: string, tx: number, ty: number, ly: number) => {
    const g = emit(name);
    if (g) push(cat, tx, ty, { kind: "point", x: tx + 0.5, y: ly + 0.5, r: g.r, i: g.i, c: g.c });
  };
  // sort by position so results never depend on input order
  const byPos = <T extends { x: number; y: number }>(a: T[]) => [...a].sort((p, q) => p.y - q.y || p.x - q.x);
  for (const d of byPos(inp.deco ?? [])) {
    if (d.layer === "prop") glow(Cat.Prop, d.sprite, d.x, d.y, d.y);
    else if (d.layer === "wall" && d.sprite !== "wall:canopy") glow(Cat.Wall, d.sprite, d.x, d.y, d.y + 1);   // lit one tile in front of the wall
  }
  for (const f of byPos(inp.furniture ?? [])) glow(Cat.Furniture, f.style ?? DEFAULT_STYLE[f.kind] ?? "", f.x, f.y, f.y);

  for (const r of [...inp.rooms].sort((p, q) => p.id - q.id)) {
    let floor = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const k = tiles[y * w + x];
      if (k !== TileKind.Wall && k !== TileKind.Door && k !== TileKind.Void) floor++;
    }
    const n = Math.max(1, Math.ceil(floor / FLOOR_PER_LIGHT));
    const cols = Math.min(n, Math.max(1, Math.round(Math.sqrt((n * r.w) / r.h))));
    const rows = Math.ceil(n / cols);
    const cw = r.w / cols, ch = r.h / rows;
    for (let i = 0; i < n; i++) {
      const cx = r.x + (i % cols + 0.5) * cw, cy = r.y + (Math.floor(i / cols) + 0.5) * ch;
      push(Cat.Ceiling, Math.min(w - 1, Math.floor(cx)), Math.min(h - 1, Math.floor(cy)), { kind: "point", x: cx, y: cy, r: Math.max(cw, ch) * 0.7 + 1, i: 0.5, c: CEILING });
    }
  }

  // corridor and plaza lamps on a sparse grid
  if (inp.floors) for (let y = 3; y < h; y += 9) for (let x = 3; x < w; x += 9) {
    const st = inp.floors[y * w + x];
    if (tiles[y * w + x] === TileKind.Floor && (st === 0 || st === 8)) push(Cat.Corridor, x, y, { kind: "point", x: x + 0.5, y: y + 0.5, r: 80 / PX, i: 0.6, c: WARM });
  }
  return out.sort((a, b) => a.id - b.id);
}
