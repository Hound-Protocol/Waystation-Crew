import { Container, Graphics } from "pixi.js";
import { TileKind } from "@wc/sim-core";
import { TILE } from "./tiles";

export interface Gate { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

/** Each connected run of airlock cells is one big gateway (its bounding rectangle), not a row of tiny doors. */
export function findGates(tiles: ArrayLike<number>, w: number, h: number): Gate[] {
  const seen = new Uint8Array(w * h), out: Gate[] = [];
  for (let i = 0; i < w * h; i++) {
    if (tiles[i] !== TileKind.Airlock || seen[i]) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0; const q = [i]; seen[i] = 1;
    while (q.length) {
      const c = q.pop()!, cx = c % w, cy = (c / w) | 0;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, n = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && tiles[n] === TileKind.Airlock && !seen[n]) { seen[n] = 1; q.push(n); }
      }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}

/** 1 when anyone stands within two tiles of the gate rectangle (tile coordinates, cell centres), else 0. */
export function gateOpenTarget(g: Gate, movers: Pt[]): 0 | 1 {
  for (const m of movers) {
    const cx = m.x + 0.5, cy = m.y + 0.5;
    const dx = Math.max(g.x - cx, 0, cx - (g.x + g.w)), dy = Math.max(g.y - cy, 0, cy - (g.y + g.h));
    if (dx * dx + dy * dy < 4) return 1;
  }
  return 0;
}

/** Eased open amount (0..1) per gate: opens fast, closes slower. No rendering. */
export class GateModel {
  open: number[];
  constructor(public gates: Gate[]) { this.open = gates.map(() => 0); }
  update(dt: number, movers: Pt[]) {
    for (let i = 0; i < this.gates.length; i++) {
      const target = gateOpenTarget(this.gates[i], movers), rate = target > this.open[i] ? 9 : 3;
      this.open[i] += (target - this.open[i]) * (1 - Math.exp(-dt * rate));
      if (this.open[i] < 0.002) this.open[i] = 0; else if (this.open[i] > 0.998) this.open[i] = 1;
    }
  }
}

const STEEL = 0x3a3f4a, STEEL_D = 0x2a2d34, DEEP = 0x14161a, EDGE = 0x07080b, HI = 0x8e9aa3, ORANGE = 0xc8601a, YEL = 0xb8941f, GO = 0x7dffb0, WAIT = 0xffb02e;

/** Draws the big sliding gateways. Two heavy panels meet in the middle of the long axis and slide apart toward the ends. */
export class GateLayer {
  readonly root = new Container();
  private g = new Graphics();
  private model = new GateModel([]);
  private last: number[] = [];
  constructor() { this.root.addChild(this.g); }
  reset(tiles: ArrayLike<number>, w: number, h: number) { this.model = new GateModel(findGates(tiles, w, h)); this.last = []; }
  update(dt: number, movers: Pt[]) {
    this.model.update(dt, movers);
    if (this.model.open.length === this.last.length && this.model.open.every((v, i) => v === this.last[i])) return;
    this.last = this.model.open.slice(); this.draw();
  }

  private draw() {
    const g = this.g; g.clear();
    for (const [i, gate] of this.model.gates.entries()) {
      const o = this.model.open[i], vertical = gate.h >= gate.w;
      const L = (vertical ? gate.h : gate.w) * TILE, T = (vertical ? gate.w : gate.h) * TILE, px = gate.x * TILE, py = gate.y * TILE;
      // (u, v) = (along the long axis, across it) -> pixel rectangle
      const R = (u0: number, v0: number, u1: number, v1: number, c: number, a = 1) =>
        (vertical ? g.rect(px + v0, py + u0, v1 - v0, u1 - u0) : g.rect(px + u0, py + v0, u1 - u0, v1 - v0)).fill({ color: c, alpha: a });
      const half = L / 2, reach = half * (1 - 0.9 * o);
      for (const side of [0, 1]) {
        const u0 = side === 0 ? 0 : L - reach, u1 = side === 0 ? reach : L;
        R(u0, 0, u1, T, EDGE); R(u0 + 1, 1, u1 - 1, T - 1, STEEL_D); R(u0 + 1, 1, u1 - 1, 3, STEEL);                   // slab with a lit top edge
        for (let u = Math.ceil(u0 / 8) * 8 + 4; u < u1 - 2; u += 8) R(Math.max(u0 + 1, u), 4, Math.min(u1 - 1, u + 1), T - 4, DEEP);   // panel grooves
        for (let v = 4; v < T - 4; v += 10) R(u0 + 1, v, u1 - 1, v + 1, HI, 0.35);                                      // cross ribs
        const lead = side === 0 ? u1 - 5 : u0;                                                                         // hazard-striped leading edge
        for (let v = 0; v < T; v += 4) R(lead, v, lead + 5, Math.min(T, v + 2), YEL);
        R(side === 0 ? u0 : u1 - 1, 0, side === 0 ? u0 + 1 : u1, T, ORANGE);                                           // outer frame end
      }
      for (const v of [0, T - 1]) R(0, v, L, v + 1, ORANGE);                                                           // frame along the sides
      const lamp = o > 0.95 ? GO : WAIT;
      for (const u of [half - 7, half + 5]) { R(u, 3, u + 2, 5, lamp); R(u, T - 5, u + 2, T - 3, lamp); }               // status lamps by the seam
    }
  }
}
