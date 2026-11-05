import { Container, Graphics } from "pixi.js";
import { TileKind } from "@wc/sim-core";
import { TILE } from "./tiles";
import type { ShipState } from "./shipstate";

export interface Seat { x: number; y: number; dir: 1 | -1 }                        // dir: +1 faces south (backrest on the north edge), -1 faces north
/** A big external engine, 5x2 tiles, exhaust to the east. (x, y): top-left tile. strut: +1 when the hull / next engine lies at +y. run: free void tiles east of the bell. */
export interface Thruster { x: number; y: number; w: number; h: number; strut: 1 | -1; run: number }
interface DecoLike { x: number; y: number; sprite: string }
interface RoomLike { name: string; x: number; y: number; w: number; h: number }

export const ENGINE_W = 5, ENGINE_H = 2;

/** The animated parts of the docked ship: shoulder-bar seats (found in the baked deco) and four external engines stacked in pairs beside the stern, in open space. */
export interface Canopy { x: number; y: number; w: number; h: number }
export interface ShipFixtures { seats: Seat[]; thrusters: Thruster[]; canopy: Canopy[] }

/** Runs of adjacent `wall:canopy` cells, each as one rectangle (the window is drawn as a single continuous pane). */
function canopyRuns(deco: DecoLike[]): Canopy[] {
  const cells = new Set(deco.filter((d) => d.sprite === "wall:canopy").map((d) => `${d.x},${d.y}`)), seen = new Set<string>(), out: Canopy[] = [];
  for (const k of cells) {
    if (seen.has(k)) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const q = [k]; seen.add(k);
    while (q.length) {
      const [cx, cy] = q.pop()!.split(",").map(Number);
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = `${cx + dx},${cy + dy}`; if (cells.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}

export function shipFixtures(deco: DecoLike[], tileAt: (x: number, y: number) => TileKind, rooms: RoomLike[]): ShipFixtures {
  const seats: Seat[] = [], thrusters: Thruster[] = [];
  for (const d of deco) {
    if (d.sprite === "prop:jumpseat") seats.push({ x: d.x, y: d.y, dir: 1 });
    else if (d.sprite === "prop:jumpseat-n") seats.push({ x: d.x, y: d.y, dir: -1 });
  }
  const ship = rooms.find((r) => r.name === "Cargo Ship");
  if (ship) {
    const clear = (x: number, y: number) => { for (let j = 0; j < ENGINE_H; j++) for (let i = 0; i < ENGINE_W; i++) if (tileAt(x + i, y + j) !== TileKind.Void) return false; return true; };
    const rows: Array<[number, 1 | -1]> = [[ship.y - 3, 1], [ship.y - 6, 1], [ship.y + ship.h + 1, -1], [ship.y + ship.h + 4, -1]];
    for (const [y, strut] of rows) {
      let x = ship.x + ship.w - 6;
      while (x > ship.x && !clear(x, y)) x--;
      let run = 0; while (run < 4 && tileAt(x + ENGINE_W + run, y + 1) === TileKind.Void) run++;
      thrusters.push({ x, y, w: ENGINE_W, h: ENGINE_H, strut, run });
    }
  }
  return { seats, thrusters, canopy: canopyRuns(deco) };
}

const BAR = 0xe0741c, ARM = 0x8e9aa3, DARK = 0x14161a, GO = 0x7dffb0, WAIT = 0xffb02e;

/** Animated parts of the docked ship: shoulder bars over the seats, nozzle heat and main-thruster plumes. Redraws only while something changes. */
export class ShipLayer {
  readonly root = new Container();
  private canopy = new Container();
  private bars = new Graphics();
  private seats: Seat[] = [];
  private jets: Array<{ box: Container; g: Graphics; t: Thruster }> = [];
  private lastBars = -1;
  constructor() { this.root.addChild(this.canopy, this.bars); }

  reset(fx: ShipFixtures) {
    this.seats = fx.seats; this.lastBars = -1;
    this.canopy.removeChildren().forEach((c) => c.destroy());
    for (const c of fx.canopy) { const g = new Graphics(); drawCanopy(g, c); this.canopy.addChild(g); }
    for (const j of this.jets) j.box.destroy({ children: true });
    this.jets = fx.thrusters.map((t) => {
      const box = new Container(), body = new Graphics(), g = new Graphics();
      drawEngine(body, t.strut); g.blendMode = "add";
      box.position.set(t.x * TILE, t.y * TILE); box.addChild(body, g);
      this.root.addChild(box);
      return { box, g, t };
    });
  }

  update(s: ShipState, time: number) {
    if (s.bars !== this.lastBars) { this.lastBars = s.bars; this.drawBars(s.bars); }
    for (const [i, j] of this.jets.entries()) this.drawJet(j.g, j.t, s, time + i * 0.37);
  }

  private drawBars(k: number) {
    const g = this.bars; g.clear();
    if (k === 0) return;                                                         // raised bars stay folded into the backrests (baked in the seat sprite)
    for (const st of this.seats) {
      const ox = st.x * TILE, oy = st.y * TILE;
      const back = st.dir > 0 ? 3 : 12, front = st.dir > 0 ? 10 : 5, y = back + (front - back) * k;
      const y0 = Math.min(back, y), y1 = Math.max(back, y);
      g.rect(ox + 4, oy + y0, 1, y1 - y0 + 1).fill(ARM); g.rect(ox + 11, oy + y0, 1, y1 - y0 + 1).fill(ARM);      // arms swing out from the backrest
      g.rect(ox + 4, oy + Math.round(y) - 1, 8, 3).fill(DARK); g.rect(ox + 5, oy + Math.round(y), 6, 1).fill(BAR);  // the bar itself
      g.rect(ox + 7, oy + Math.round(back + (y - back) * 0.5), 2, 1).fill(k >= 0.999 ? GO : WAIT);                  // status lamp: amber moving, green locked
    }
  }

  private drawJet(g: Graphics, t: Thruster, s: ShipState, time: number) {
    g.clear();
    if (s.glow <= 0.01 && s.thrust <= 0.01) return;
    const cy = ENGINE_H * TILE / 2, mx = ENGINE_W * TILE;
    if (s.glow > 0.01) {                                                                                            // heat glowing in the bell
      for (let x = mx - 14; x < mx; x++) { const hh = throatHalf(x) , a = (0.18 + 0.5 * ((x - (mx - 14)) / 14)) * s.glow; g.rect(x, cy - hh, 1, hh * 2).fill({ color: 0xff7a1a, alpha: a }); }
    }
    if (s.thrust <= 0.01) return;
    const flick = 0.92 + 0.08 * Math.sin(time * 38) * Math.sin(time * 23 + 1);
    const len = (6 + s.thrust * (t.run * TILE + 10)) * flick, k = Math.min(1, s.thrust * 1.5);
    for (const [w, a, c] of [[9, 0.35, 0xff4a10], [6, 0.55, 0xffa020], [3, 0.9, 0xfff2b0]] as Array<[number, number, number]>)
      g.poly([mx - 4, cy - w, mx + len * 0.8, cy - w * 0.3, mx + len, cy, mx + len * 0.8, cy + w * 0.3, mx - 4, cy + w]).fill({ color: c, alpha: a * k });
  }
}

/** Half-height of the bell throat at pixel column x (engine-local). */
const throatHalf = (x: number) => Math.max(2, Math.round(5 + (x - 56) * 0.24));

/** Pixel-art engine, 80x32, nozzle to the east. strut: which side the mounting pylon is on (+1 = bottom). Drawn once. */
function drawEngine(g: Graphics, strut: 1 | -1) {
  const STEEL = 0x3a3f4a, STEEL_D = 0x2a2d34, DEEP = 0x14161a, EDGE = 0x07080b, HI = 0x8e9aa3, OR = 0xc8601a, OR_H = 0xe0741c, VOID = 0x0b0d10;
  const R = (x0: number, y0: number, x1: number, y1: number, c: number) => g.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1).fill(c);
  // pylon to the hull / neighbouring engine: one tile tall, off the body on the strut side
  const py0 = strut > 0 ? 29 : -16, py1 = strut > 0 ? 47 : 2;
  R(30, py0, 46, py1, EDGE); R(31, py0, 45, py1, STEEL_D); R(33, py0, 33, py1, STEEL); for (let y = py0 + 3; y < py1; y += 5) R(31, y, 45, y, DEEP); R(36, py0, 40, py1, STEEL);
  // fuel tank (rear)
  R(0, 8, 23, 23, EDGE); R(1, 9, 22, 22, STEEL_D); R(1, 9, 22, 10, STEEL); R(1, 22, 22, 22, DEEP); R(7, 9, 9, 22, OR); R(8, 9, 8, 22, OR_H); R(14, 9, 14, 22, DEEP); R(0, 11, 0, 20, HI);
  // main housing
  R(22, 4, 56, 27, EDGE); R(23, 5, 55, 26, STEEL); R(23, 5, 55, 6, HI); R(23, 26, 55, 26, DEEP); R(23, 7, 55, 7, STEEL_D);
  for (const x of [28, 34, 40, 46]) { R(x, 11, x + 3, 20, DEEP); for (let y = 12; y < 20; y += 2) R(x, y, x + 3, y, VOID); }              // vent grilles
  R(24, 5, 25, 26, OR); R(53, 5, 54, 26, OR); R(24, 5, 24, 26, OR_H);
  R(22, 2, 62, 3, EDGE); R(23, 2, 61, 2, HI);                                                                                   // fuel line along the top
  // bell
  for (let x = 56; x < 80; x++) {
    const hh = Math.round(8 + (x - 56) * 0.28), th = throatHalf(x);
    R(x, 16 - hh - 1, x, 16 + hh, EDGE); R(x, 16 - hh, x, 16 + hh - 1, STEEL_D); R(x, 16 - hh, x, 16 - hh + 1, STEEL);
    if (x >= 58) R(x, 16 - th, x, 16 + th - 1, VOID);
  }
  for (const x of [61, 67, 73]) { R(x, 16 - Math.round(8 + (x - 56) * 0.28), x, 16 + Math.round(8 + (x - 56) * 0.28) - 1, DEEP); }  // reinforcing rings
  R(78, 16 - 10, 79, 16 + 9, OR); R(79, 16 - 10, 79, 16 + 9, OR_H);                                                              // glowing-hot rim
}

/**
 * The nose canopy as one continuous, mostly transparent pane: a thin frame, two soft glare bands and a few instrument-reflection ticks.
 * Everything else lets the stars through. Works for a run along either axis.
 */
function drawCanopy(g: Graphics, c: Canopy) {
  const vertical = c.h >= c.w, L = (vertical ? c.h : c.w) * TILE, T = (vertical ? c.w : c.h) * TILE;
  const R = (u0: number, v0: number, u1: number, v1: number, col: number, a: number) =>
    (vertical ? g.rect(c.x * TILE + v0, c.y * TILE + u0, v1 - v0, u1 - u0) : g.rect(c.x * TILE + u0, c.y * TILE + v0, u1 - u0, v1 - v0)).fill({ color: col, alpha: a });
  R(0, 0, L, T, 0x6cc6e6, 0.05);                                                      // faint glass tint
  for (const [u, w, a] of [[L * 0.18, 5, 0.12], [L * 0.30, 2, 0.16], [L * 0.62, 7, 0.10]] as Array<[number, number, number]>)   // diagonal glare bands, one stroke each
    for (let v = 0; v < T; v++) R(Math.round(u + v * 0.9), v, Math.round(u + v * 0.9) + w, v + 1, 0xcfefff, a);
  R(0, 0, L, 1, 0x8e9aa3, 0.8); R(0, T - 1, L, T, 0x8e9aa3, 0.8);                      // thin frame rails along the long edges
  R(0, 0, 2, T, 0x3a3f4a, 0.95); R(L - 2, 0, L, T, 0x3a3f4a, 0.95);                    // end posts
  for (const u of [L * 0.33, L * 0.66]) R(Math.round(u), 0, Math.round(u) + 1, T, 0x3a3f4a, 0.55);   // slim mullions
  for (const [u, v] of [[L * 0.2, T * 0.7], [L * 0.45, T * 0.3], [L * 0.8, T * 0.6]]) { R(Math.round(u), Math.round(v), Math.round(u) + 3, Math.round(v) + 1, 0x4de1ff, 0.55); R(Math.round(u) + 4, Math.round(v), Math.round(u) + 5, Math.round(v) + 1, 0xffb02e, 0.5); }   // HUD reflections
}
