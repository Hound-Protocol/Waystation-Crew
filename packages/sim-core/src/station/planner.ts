import { TileKind, type Tilemap } from "./tilemap";
import { rotateCW, turnsToFace, type Blueprint, type Dir } from "./blueprint";
import { ringWall, stampModule, type ModuleKind } from "./modules";
import { ROOM_TYPES, WINGS, nextInWing, typeIndex, typeOf } from "./kit";
import { HUB } from "./constants";
import type { Station, Room } from "./starter";
import type { Rng } from "../rng";

/** Floor-style value marking solid hull filler: wall tiles that a new room may replace. */
export const FILLER = 255;
/** Marks void cells reserved for the ship berth: never built over, never sealed into hull filler. */
export const BERTH = 254;
const FACINGS: Dir[] = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
export interface Hall { x0: number; y0: number; x1: number; y1: number }   // axis-aligned centre line; three tiles wide

const isFree = (map: Tilemap, floors: Uint8Array, x: number, y: number) => {
  const k = map.get(x, y);
  return (k === TileKind.Void && floors[y * map.w + x] !== BERTH) || (k === TileKind.Wall && floors[y * map.w + x] === FILLER);
};
const isPublic = (map: Tilemap, floors: Uint8Array, x: number, y: number) =>
  map.inBounds(x, y) && map.get(x, y) === TileKind.Floor && (floors[y * map.w + x] === 0 || floors[y * map.w + x] === 8);

/** Can this rotated blueprint be stamped at (ox, oy)? Its cells need free ground and one wall tile to anything built. */
function fits(map: Tilemap, floors: Uint8Array, bp: Blueprint, ox: number, oy: number): boolean {
  const gh = bp.grid.length, gw = bp.grid[0].length;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    if (bp.grid[y][x] === " ") continue;
    const X = ox + x, Y = oy + y;
    if (X < 2 || Y < 2 || X >= map.w - 2 || Y >= map.h - 2) return false;
    if (x === bp.door.x && y === bp.door.y) { if (map.get(X, Y) !== TileKind.Wall && !isFree(map, floors, X, Y)) return false; continue; }   // the door replaces a hall wall
    if (!isFree(map, floors, X, Y)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = map.get(X + dx, Y + dy);
      if (k !== TileKind.Void && k !== TileKind.Wall) return false;
    }
  }
  return true;
}

let OFFSETS: Array<{ x: number; y: number }> | null = null;
const offsets = () => OFFSETS ??= (() => {
  const o: Array<{ x: number; y: number }> = [];
  for (let dy = -64; dy <= 64; dy++) for (let dx = -64; dx <= 64; dx++) o.push({ x: dx, y: dy });
  return o.sort((a, b) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y));
})();

/** Open hall ends keep a clear run so the hall can always be extended; rooms may not block them. */
function endZones(st: Station): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const zones: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const h of st.halls ?? []) {
    const horiz = h.y0 === h.y1, open = (x: number, y: number) => st.map.get(x, y) !== TileKind.Floor;
    if (horiz) {
      if (open(h.x1 + 1, h.y0)) zones.push({ x0: h.x1 + 1, y0: h.y0 - 4, x1: h.x1 + 8, y1: h.y0 + 4 });
      if (open(h.x0 - 1, h.y0)) zones.push({ x0: h.x0 - 8, y0: h.y0 - 4, x1: h.x0 - 1, y1: h.y0 + 4 });
    } else {
      if (open(h.x0, h.y1 + 1)) zones.push({ x0: h.x0 - 4, y0: h.y1 + 1, x1: h.x0 + 4, y1: h.y1 + 8 });
      if (open(h.x0, h.y0 - 1)) zones.push({ x0: h.x0 - 4, y0: h.y0 - 8, x1: h.x0 + 4, y1: h.y0 - 1 });
    }
  }
  return zones;
}

/** Best frontage site for a room: its door opens straight onto a hall or the plaza. Nearest the hub and its own department wins. */
function findSite(st: Station, kind: ModuleKind, base: Blueprint, rng: Rng): { cx: number; cy: number; facing: Dir } | null {
  const map = st.map, floors = st.floors!;
  const rotated = FACINGS.map((facing) => ({ facing, bp: rotateCW(base, turnsToFace(facing)) }));
  const kin = st.rooms.filter((r) => r.kind === kind), zones = endZones(st);
  let best: { score: number; cx: number; cy: number; facing: Dir } | null = null;
  for (const o of offsets()) {
    const near = Math.hypot(o.x, o.y);
    if (best && near > best.score) break;
    for (const { facing, bp } of rotated) {
      const gh = bp.grid.length, gw = bp.grid[0].length, cx = HUB.x + o.x, cy = HUB.y + o.y, ox = Math.round(cx - gw / 2), oy = Math.round(cy - gh / 2);
      const outX = ox + bp.door.x + bp.out.x, outY = oy + bp.door.y + bp.out.y;
      if (!isPublic(map, floors, outX, outY)) continue;
      if (zones.some((z) => ox <= z.x1 && ox + gw >= z.x0 && oy <= z.y1 && oy + gh >= z.y0)) continue;
      let score = near;
      if (kin.length) score += 0.7 * Math.min(...kin.map((r) => Math.hypot(r.x + r.w / 2 - cx, r.y + r.h / 2 - cy)));
      if (best && score >= best.score) continue;
      if (!fits(map, floors, bp, ox, oy)) continue;
      best = { score: score + rng.int(0, 2), cx, cy, facing };
    }
  }
  return best;
}

export function carveHall(st: Station, h: Hall, force = false): void {
  const map = st.map, floors = st.floors!;
  for (let y = h.y0; y <= h.y1; y++) for (let x = h.x0; x <= h.x1; x++) for (let w = -1; w <= 1; w++) {
    const X = h.y0 === h.y1 ? x : x + w, Y = h.y0 === h.y1 ? y + w : y;
    if (map.inBounds(X, Y) && (isFree(map, floors, X, Y) || (force && map.get(X, Y) === TileKind.Wall))) { map.set(X, Y, TileKind.Floor); floors[Y * map.w + X] = 0; }
  }
  (st.halls ??= []).push(h);
}

/** Open a new stretch of hall: extend an end or branch off the side, wherever the strip is free. */
export function extendHall(st: Station, rng: Rng): boolean {
  const map = st.map, floors = st.floors!, halls = st.halls ?? [];
  type HallD = Hall & { dir?: number };
  const cand: HallD[] = [], capKeys = new Map<string, number>();
  const horizOf = (h: Hall) => h.y0 === h.y1;
  // the first line of a new strip may overwrite the old hall's end cap / side wall; everything beyond must be free ground
  const stripFree = (h: Hall) => {
    const horiz = horizOf(h);
    for (let y = h.y0 - (horiz ? 1 : 0); y <= h.y1 + (horiz ? 1 : 0); y++) for (let x = h.x0 - (horiz ? 0 : 1); x <= h.x1 + (horiz ? 0 : 1); x++) {
      if (!map.inBounds(x, y) || x < 3 || y < 3 || x >= map.w - 3 || y >= map.h - 3) return false;
      const along = horiz ? x : y, first = along === (horiz ? (h as Hall & { dir?: number }).dir! > 0 ? h.x0 : h.x1 : (h as Hall & { dir?: number }).dir! > 0 ? h.y0 : h.y1);
      if (!(isFree(map, floors, x, y) || (first && map.get(x, y) === TileKind.Wall))) return false;
    }
    for (let y = h.y0 - 2; y <= h.y1 + 2; y++) for (let x = h.x0 - 2; x <= h.x1 + 2; x++) {          // keep clear of other rooms' floors
      const k = map.get(x, y);
      if (k === TileKind.Floor && floors[y * map.w + x] !== 0 && floors[y * map.w + x] !== 8) return false;
    }
    return true;
  };
  const L = 14;
  for (const h of halls) {
    const horiz = horizOf(h), span = horiz ? h.x1 - h.x0 : h.y1 - h.y0;
    const ends: Array<Hall & { dir: number }> = horiz
      ? [{ x0: h.x1 + 1, y0: h.y0, x1: h.x1 + L, y1: h.y0, dir: 1 }, { x0: h.x0 - L, y0: h.y0, x1: h.x0 - 1, y1: h.y0, dir: -1 }]
      : [{ x0: h.x0, y0: h.y1 + 1, x1: h.x0, y1: h.y1 + L, dir: 1 }, { x0: h.x0, y0: h.y0 - L, x1: h.x0, y1: h.y0 - 1, dir: -1 }];
    cand.push(...ends);
    for (const e of ends) capKeys.set(`${e.x0},${e.y0},${e.x1},${e.y1}`, e.dir);
    for (let k = 0; k < 3; k++) {                                   // branches from random points along the side
      const t = rng.int(6, Math.max(6, span - 6)), side = rng.int(0, 1) ? 1 : -1, l = rng.int(10, 16);
      cand.push(horiz ? (side > 0 ? { x0: h.x0 + t, y0: h.y0 + 2, x1: h.x0 + t, y1: h.y0 + 1 + l, dir: 1 } : { x0: h.x0 + t, y0: h.y0 - 1 - l, x1: h.x0 + t, y1: h.y0 - 2, dir: -1 })
        : (side > 0 ? { x0: h.x0 + 2, y0: h.y0 + t, x1: h.x0 + 1 + l, y1: h.y0 + t, dir: 1 } : { x0: h.x0 - 1 - l, y0: h.y0 + t, x1: h.x0 - 2, y1: h.y0 + t, dir: -1 }));
    }
  }
  const ok = cand.filter((h) => h.x1 >= h.x0 && h.y1 >= h.y0 && stripFree(h)).map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 }));
  if (!ok.length) return false;
  ok.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - HUB.x, (a.y0 + a.y1) / 2 - HUB.y) - Math.hypot((b.x0 + b.x1) / 2 - HUB.x, (b.y0 + b.y1) / 2 - HUB.y));
  const pick = ok[rng.int(0, Math.min(2, ok.length - 1))], capDir = capKeys.get(`${pick.x0},${pick.y0},${pick.x1},${pick.y1}`);
  carveHall(st, pick, true);
  if (capDir !== undefined) addCrossbar(st, pick, capDir);
  sealHull(st);
  return true;
}

/** A T at the tip of a fresh extension: a cross hall, so the frontier keeps offering frontage on both sides. */
function addCrossbar(st: Station, ext: Hall, dir: number): void {
  const map = st.map, floors = st.floors!, horiz = ext.y0 === ext.y1;
  const tx = horiz ? (dir > 0 ? ext.x1 - 2 : ext.x0 + 2) : ext.x0, ty = horiz ? ext.y0 : (dir > 0 ? ext.y1 - 2 : ext.y0 + 2);
  for (const half of [12, 8, 4]) {
    const h: Hall = horiz ? { x0: tx, y0: ty - half, x1: tx, y1: ty + half } : { x0: tx - half, y0: ty, x1: tx + half, y1: ty };
    let ok = true;
    for (let y = h.y0 - (horiz ? 0 : 1); y <= h.y1 + (horiz ? 0 : 1) && ok; y++) for (let x = h.x0 - (horiz ? 1 : 0); x <= h.x1 + (horiz ? 1 : 0); x++) {
      const k = map.get(x, y);
      if (!map.inBounds(x, y) || x < 3 || y < 3 || x >= map.w - 3 || y >= map.h - 3 || !(isFree(map, floors, x, y) || (k === TileKind.Floor && floors[y * map.w + x] === 0))) { ok = false; break; }
    }
    if (ok) { carveHall(st, h); return; }
  }
}

/** Void pockets sealed off from open space become solid hull filler (replaceable by later rooms). */
export function sealHull(st: Station): void {
  const map = st.map, floors = st.floors!, W = map.w, H = map.h;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ringWall(map, x, y);
  const open = new Uint8Array(W * H), stack: number[] = [];
  const mark = (x: number, y: number) => { if (map.inBounds(x, y) && map.get(x, y) === TileKind.Void && !open[y * W + x]) { open[y * W + x] = 1; stack.push(y * W + x); } };
  for (let i = 0; i < W; i++) { mark(i, 0); mark(i, H - 1); mark(0, i); mark(W - 1, i); }
  while (stack.length) { const k = stack.pop()!, x = k % W, y = Math.floor(k / W); for (const [dx, dy] of N4) mark(x + dx, y + dy); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map.get(x, y) === TileKind.Void && floors[y * W + x] !== BERTH && !open[y * W + x]) { map.set(x, y, TileKind.Wall); floors[y * W + x] = FILLER; }
}

/** Add one room of `kind` (the next type in its wing; other wing types are tried if that one finds no site). Returns the room, or null when the station has no room left. */
export function buildRoom(st: Station, kind: ModuleKind, rng: Rng, typeId?: string): Room | null {
  const built = st.rooms.filter((r) => r.kind === kind).length;
  const wing = WINGS[kind], first = typeId ? [typeId] : wing.map((_, i) => nextInWing(kind, built + i));
  for (const id of [...new Set(first)]) {
    const type = typeOf(id), bp = type.make(rng.fork(`room${st.rooms.length}`));
    let site = findSite(st, kind, bp, rng);
    for (let i = 0; !site && i < 6; i++) { if (!extendHall(st, rng)) break; site = findSite(st, kind, bp, rng); }
    if (!site) continue;
    const target = { map: st.map, rooms: st.rooms, furniture: st.furniture, deco: st.deco!, floors: st.floors! };
    const before = st.furniture.length;
    stampModule(target, { kind, variant: typeIndex(type.id), blueprint: bp }, site.cx, site.cy, site.facing);
    for (let i = before; i < st.furniture.length; i++) st.furniture[i].id = i;
    sealHull(st);
    return st.rooms[st.rooms.length - 1];
  }
  return null;
}
void ROOM_TYPES;
