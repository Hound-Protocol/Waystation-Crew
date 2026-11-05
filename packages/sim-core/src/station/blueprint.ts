import { TileKind } from "./tilemap";

/** Organic module blueprints: a floor shape (any outline) plus furniture glyphs. Walls are generated around the floor. */
export type Dir = { x: number; y: number };
export interface Blueprint { grid: string[]; door: { x: number; y: number }; out: Dir }   // out: direction pointing out of the door

export interface GlyphDef { tile: TileKind; sprite?: string; layer?: "floor" | "prop" | "wall" }

/** Glyph vocabulary. Interactive glyphs get `${prefix}:${module kind}` sprites unless pinned. */
export const GLYPHS: Record<string, GlyphDef & { prefix?: string }> = {
  C: { tile: TileKind.Console, prefix: "console" }, n: { tile: TileKind.Console, sprite: "console:nav" }, m: { tile: TileKind.Console, sprite: "console:med" },
  s: { tile: TileKind.Console, sprite: "console:sec" }, e: { tile: TileKind.Console, sprite: "console:eng" }, k: { tile: TileKind.Console, sprite: "console:kiosk" },
  B: { tile: TileKind.Bed, prefix: "bed" }, b: { tile: TileKind.Bed, sprite: "bed:bunk" }, z: { tile: TileKind.Bed, sprite: "bed:pod" },
  T: { tile: TileKind.Table, prefix: "table" }, t: { tile: TileKind.Table, sprite: "table:round" },
  P: { tile: TileKind.Plant, sprite: "plant:fern" }, Y: { tile: TileKind.Plant, sprite: "plant:tree" }, H: { tile: TileKind.Plant, sprite: "plant:hydro" },
  L: { tile: TileKind.Prop, sprite: "prop:locker" }, X: { tile: TileKind.Prop, sprite: "prop:crate" }, S: { tile: TileKind.Prop, sprite: "prop:shelf" },
  R: { tile: TileKind.Prop, sprite: "prop:rack" }, G: { tile: TileKind.Prop, sprite: "prop:generator" }, V: { tile: TileKind.Prop, sprite: "prop:vending" },
  F: { tile: TileKind.Prop, sprite: "prop:fridge" }, K: { tile: TileKind.Prop, sprite: "prop:counter" }, Z: { tile: TileKind.Prop, sprite: "prop:cryo" },
  W: { tile: TileKind.Prop, sprite: "prop:workbench" }, Q: { tile: TileKind.Prop, sprite: "prop:sofa" }, E: { tile: TileKind.Prop, sprite: "prop:reactor" },
  M: { tile: TileKind.Prop, sprite: "prop:scanner" }, N: { tile: TileKind.Prop, sprite: "prop:bin" }, O: { tile: TileKind.Prop, sprite: "prop:holo" },
  U: { tile: TileKind.Prop, sprite: "prop:battery" }, I: { tile: TileKind.Prop, sprite: "prop:pipes" }, J: { tile: TileKind.Prop, sprite: "prop:bars" },
  D: { tile: TileKind.Prop, sprite: "prop:dish" }, "%": { tile: TileKind.Prop, sprite: "prop:cooler" }, "&": { tile: TileKind.Prop, sprite: "prop:stove" },
  // department equipment
  i: { tile: TileKind.Prop, sprite: "prop:iv" }, u: { tile: TileKind.Prop, sprite: "prop:surgery" }, d: { tile: TileKind.Prop, sprite: "prop:defib" },
  a: { tile: TileKind.Prop, sprite: "prop:medcab" }, x: { tile: TileKind.Prop, sprite: "prop:xray" }, w: { tile: TileKind.Prop, sprite: "prop:weapons" },
  q: { tile: TileKind.Prop, sprite: "prop:evidence" }, f: { tile: TileKind.Prop, sprite: "prop:toolrack" }, g: { tile: TileKind.Prop, sprite: "prop:forklift" },
  p: { tile: TileKind.Prop, sprite: "prop:printer" }, l: { tile: TileKind.Prop, sprite: "prop:lathe" }, v: { tile: TileKind.Prop, sprite: "prop:valve" },
  y: { tile: TileKind.Prop, sprite: "prop:suitrack" }, j: { tile: TileKind.Prop, sprite: "prop:scales" }, "$": { tile: TileKind.Prop, sprite: "prop:coolant" },
  "#": { tile: TileKind.Wall },
  // ship deck
  "~": { tile: TileKind.Prop, sprite: "prop:jumpseat" },
  ",": { tile: TileKind.Floor, sprite: "floor:ramp", layer: "floor" }, ";": { tile: TileKind.Floor, sprite: "floor:slot", layer: "floor" },
  "@": { tile: TileKind.Prop, sprite: "prop:instruments" },
  // cargo slots (S = ";", M = "<" ">", L = "1 2 / 3 4") and hull windows (wall ring cells; the sprite is blitted over the wall)
  "<": { tile: TileKind.Floor, sprite: "floor:slot-ml", layer: "floor" }, ">": { tile: TileKind.Floor, sprite: "floor:slot-mr", layer: "floor" },
  "1": { tile: TileKind.Floor, sprite: "floor:slot-tl", layer: "floor" }, "2": { tile: TileKind.Floor, sprite: "floor:slot-tr", layer: "floor" },
  "3": { tile: TileKind.Floor, sprite: "floor:slot-bl", layer: "floor" }, "4": { tile: TileKind.Floor, sprite: "floor:slot-br", layer: "floor" },
  "[": { tile: TileKind.Wall, sprite: "wall:canopy", layer: "wall" }, "]": { tile: TileKind.Wall, sprite: "wall:viewport", layer: "wall" },
  "(": { tile: TileKind.Wall, sprite: "wall:porthole", layer: "wall" }, ")": { tile: TileKind.Wall, sprite: "wall:shutter", layer: "wall" },
  o: { tile: TileKind.Floor, sprite: "floor:stool", layer: "floor" }, r: { tile: TileKind.Floor, sprite: "floor:rug", layer: "floor" },
  h: { tile: TileKind.Floor, sprite: "floor:hazard", layer: "floor" }, "=": { tile: TileKind.Floor, sprite: "floor:lane", layer: "floor" },
  "^": { tile: TileKind.Floor, sprite: "floor:arrow", layer: "floor" }, "+": { tile: TileKind.Floor, sprite: "floor:medcross", layer: "floor" },
  "*": { tile: TileKind.Floor, sprite: "floor:pad", layer: "floor" }, ":": { tile: TileKind.Floor, sprite: "floor:grate", layer: "floor" },
};

// ---- shapes (floor masks) ----
type Mask = (x: number, y: number, w: number, h: number) => boolean;
const ell: Mask = (x, y, w, h) => { const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2); return dx * dx + dy * dy <= 1; };

export class Canvas {
  readonly g: string[][];
  private reserved = new Set<string>();
  constructor(public w: number, public h: number, mask: Mask) {
    this.g = Array.from({ length: h + 2 }, (_, y) => Array.from({ length: w + 2 }, (_, x) => (x >= 1 && y >= 1 && x <= w && y <= h && mask(x - 1, y - 1, w, h) ? "." : " ")));
    // keep the approach to the door (bottom centre) clear
    const X = this.doorCol(), yb = this.bottom(X);
    for (let y = yb - 2; y <= yb; y++) this.reserved.add(`${X},${y}`);
  }
  /** Grid column of the door (grid coordinates include the 1-cell margin). */
  private doorCol() { return Math.floor(this.w / 2) + 1; }
  private bottom(cx: number) { for (let y = this.h; y >= 1; y--) if (this.g[y][cx] === ".") return y; throw new Error("shape has no floor at the door column"); }
  isFloor(x: number, y: number) { return this.g[y + 1]?.[x + 1] === "."; }
  /** Place a glyph on a floor cell, replacing earlier items (ignored outside the shape and on the door approach). */
  put(x: number, y: number, c: string): this {
    const X = x + 1, Y = y + 1;
    const cur = this.g[Y]?.[X];
    if (cur !== undefined && cur !== " " && cur !== "A" && cur !== "d" && !this.reserved.has(`${X},${Y}`)) this.g[Y][X] = c;   // later placements win
    return this;
  }
  pts(c: string, ...p: Array<[number, number]>): this { for (const [x, y] of p) this.put(x, y, c); return this; }
  hline(x0: number, x1: number, y: number, c: string, step = 1): this { for (let x = x0; x <= x1; x += step) this.put(x, y, c); return this; }
  vline(x: number, y0: number, y1: number, c: string, step = 1): this { for (let y = y0; y <= y1; y += step) this.put(x, y, c); return this; }
  fill(x0: number, y0: number, x1: number, y1: number, c: string, sx = 1, sy = 1): this { for (let y = y0; y <= y1; y += sy) for (let x = x0; x <= x1; x += sx) this.put(x, y, c); return this; }
  /** Mirror-place across the vertical centre line. */
  sym(c: string, ...p: Array<[number, number]>): this { for (const [x, y] of p) { this.put(x, y, c); this.put(this.w - 1 - x, y, c); } return this; }
  /** True when every neighbour (8-way) is plain floor or outside the shape, so an item here cannot box anything in. */
  private isolated(x: number, y: number) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx || dy) { const c = this.g[y + 1 + dy]?.[x + 1 + dx]; if (c !== undefined && c !== "." && c !== " ") return false; } }
    return true;
  }
  /** Line the north edge of the room with equipment, cycling through `glyphs`, every `step` cells. Keeps cells next to the edge passable. */
  edge(glyphs: string, step = 3): this {
    let n = 0;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      if (this.isFloor(x, y) && !this.isFloor(x, y - 1) && this.isFloor(x - 1, y) && this.isFloor(x + 1, y) && this.isFloor(x, y + 1) && (x * 2 + y) % step === 0 && this.isolated(x, y)) this.put(x, y, glyphs[n++ % glyphs.length]);
    return this;
  }
  /** Airlock cells just outside the top edge for columns in [x0, x1]. */
  airlocks(x0: number, x1: number): this {
    for (let x = x0; x <= x1; x++) for (let y = 1; y <= this.h; y++) if (this.g[y][x + 1] === ".") { this.g[y - 1][x + 1] = "A"; break; }
    return this;
  }
  done(): Blueprint {
    const X = this.doorCol(), yb = this.bottom(X);
    this.g[yb + 1][X] = "d";                                   // door marker in the wall ring
    return { grid: this.g.map((r) => r.join("")), door: { x: X, y: yb + 1 }, out: { x: 0, y: 1 } };
  }
}

/** Rooms are boxy, like a real station's: rectangles with chamfered corners, notches and wings (the Box/Icebox look). */
const chamfer = (w: number, h: number, c0: number) => {
  const c = Math.min(c0, Math.max(0, Math.floor((Math.min(w, h) - 3) / 2)));     // never leave 1-wide stubs on small rooms
  return (x: number, y: number) => !(x + y < c || w - 1 - x + y < c || x + h - 1 - y < c || w - 1 - x + h - 1 - y < c);
};
export const Shapes = {
  octagon: (w: number, h: number, c: number) => new Canvas(w, h, chamfer(w, h, Math.min(c, 3))),
  ellipse: (w: number, h: number) => new Canvas(w, h, chamfer(w, h, 2)),
  cross: (w: number, h: number, aw: number, ah: number) => new Canvas(w, h, (x, y) => Math.abs(x + 0.5 - w / 2) < aw / 2 || Math.abs(y + 0.5 - h / 2) < ah / 2),
  lshape: (w: number, h: number, cw: number, ch: number) => new Canvas(w, h, (x, y) => !(x >= w - cw && y < ch)),
  hexa: (w: number, h: number) => new Canvas(w, h, chamfer(w, h, 3)),
  crescent: (w: number, h: number) => new Canvas(w, h, (x, y) => chamfer(w, h, 2)(x, y) && !(Math.abs(x + 0.5 - w / 2) < w / 6 && y < 2)),
  blob: (w: number, h: number, ph: number) => new Canvas(w, h, (x, y) => chamfer(w, h, 2)(x, y) && !(ph > 1 ? x >= w - 4 && y < 3 : x < 3 && y < 3)),
  tee: (w: number, h: number, sw: number, sh: number) => new Canvas(w, h, (x, y) => y < sh || Math.abs(x + 0.5 - w / 2) < sw / 2),
};

// ---- transforms ----
export function rotateCW(bp: Blueprint, times: number): Blueprint {
  let { grid, door, out } = bp;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) {
    const h = grid.length, w = grid[0].length;
    grid = Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => grid[h - 1 - x][y]).join(""));
    door = { x: h - 1 - door.y, y: door.x };
    out = { x: -out.y || 0, y: out.x || 0 };
  }
  return { grid, door, out };
}

/** Quarter turns clockwise so that a south-facing door ends up facing `dir`. */
export function turnsToFace(dir: Dir): number {
  if (Math.abs(dir.x) > Math.abs(dir.y)) return dir.x < 0 ? 1 : 3;
  return dir.y > 0 ? 0 : 2;
}
