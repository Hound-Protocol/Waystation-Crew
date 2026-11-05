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

export interface Rect { x: number; y: number; w: number; h: number }
export interface Beacon { x: number; y: number; end: 0 | 1 }

/** Floor strips right in front of and right behind the door (across its travel direction), full width. */
export function gateStrips(g: Gate): [Rect, Rect] {
  return g.h >= g.w
    ? [{ x: g.x - 1, y: g.y, w: 1, h: g.h }, { x: g.x + g.w, y: g.y, w: 1, h: g.h }]
    : [{ x: g.x, y: g.y - 1, w: g.w, h: 1 }, { x: g.x, y: g.y + g.h, w: g.w, h: 1 }];
}

/** Beacon mounts on the wall cells at both ends of the door's long axis, one per cell across it. */
export function gateBeacons(g: Gate): Beacon[] {
  const out: Beacon[] = [];
  if (g.h >= g.w) for (let i = 0; i < g.w; i++) out.push({ x: g.x + i, y: g.y - 1, end: 0 }, { x: g.x + i, y: g.y + g.h, end: 1 });
  else for (let i = 0; i < g.h; i++) out.push({ x: g.x - 1, y: g.y + i, end: 0 }, { x: g.x + g.w, y: g.y + i, end: 1 });
  return out;
}

/** 5 Hz strobe; the two strips (side 0 / 1) take turns. */
export const strobe = (time: number, side: 0 | 1): boolean => (Math.floor(time * 10) % 2 === 0) === (side === 0);
/** Warning-beacon pulse 0..1 at 3 Hz; the two ends alternate. */
export const beaconLevel = (time: number, end: 0 | 1): number => Math.max(0, Math.sin((time / 0.3333) * Math.PI * 2 + (end === 0 ? 0 : Math.PI)));

const LED_OFF = 0x4a3608, STEEL = 0x3a3f4a, STEEL_D = 0x2a2d34, DEEP = 0x14161a, EDGE = 0x07080b, HI = 0x8e9aa3, ORANGE = 0xc8601a, YEL = 0xb8941f, GO = 0x7dffb0, WAIT = 0xffb02e, RED = 0xff4040;

/** Draws the big sliding gateways. Two heavy panels meet in the middle of the long axis and slide apart toward the ends. The door follows the ship's schedule. */
export class GateLayer {
  readonly root = new Container();
  private g = new Graphics();
  private glow = new Graphics();
  private gates: Gate[] = [];
  private lastGate = -1;
  constructor() { this.glow.blendMode = "add"; this.root.addChild(this.g, this.glow); }
  reset(tiles: ArrayLike<number>, w: number, h: number) { this.gates = findGates(tiles, w, h); this.lastGate = -1; }

  update(time: number, s: { gate: number; gateMoving: boolean }) {
    // panels redraw only when the door has moved; the lights while it is moving
    if (s.gate !== this.lastGate) { this.lastGate = s.gate; this.drawDoors(s.gate); this.drawHousings(); }
    this.drawLights(time, s.gateMoving);
  }

  /** Static fittings that are always there: beacon housings on the wall cells at the door's ends and the dark LED strips either side of it. */
  private drawHousings() {
    const g = this.g;
    for (const gate of this.gates) {
      const vertical = gate.h >= gate.w;
      for (const r of gateStrips(gate)) for (let i = 0; i < (vertical ? r.h : r.w); i++) {
        const px = (r.x + (vertical ? 0 : i)) * TILE, py = (r.y + (vertical ? i : 0)) * TILE;
        if (vertical) { g.rect(px + 5, py, 6, TILE).fill(0x07080b); g.rect(px + 6, py, 4, TILE).fill(0x1b1e24); for (const y of [1, 6, 11]) g.rect(px + 7, py + y, 2, 4).fill(LED_OFF); }
        else { g.rect(px, py + 5, TILE, 6).fill(0x07080b); g.rect(px, py + 6, TILE, 4).fill(0x1b1e24); for (const x of [1, 6, 11]) g.rect(px + x, py + 7, 4, 2).fill(LED_OFF); }
      }
      for (const b of gateBeacons(gate)) {
        const x = b.x * TILE, y = b.y * TILE;
        g.rect(x + 3, y + 3, 10, 10).fill(0x07080b); g.rect(x + 4, y + 4, 8, 8).fill(0x2a2d34); g.rect(x + 4, y + 4, 8, 1).fill(0x3a3f4a);      // bolted housing
        g.circle(x + 8, y + 8, 3.2).fill(0x5a420c); g.rect(x + 7, y + 6, 1, 1).fill(0x9a7418);                                                    // dark amber dome, glint
        for (const [dx, dy] of [[4, 4], [11, 4], [4, 11], [11, 11]]) g.rect(x + dx, y + dy, 1, 1).fill(0x8e9aa3);                                   // bolts
      }
    }
  }

  private drawLights(time: number, moving: boolean) {
    const g = this.glow; g.clear();
    if (!moving) return;
    for (const gate of this.gates) {
      const vertical = gate.h >= gate.w;
      for (const [side, r] of gateStrips(gate).entries()) {
        if (!strobe(time, side as 0 | 1)) continue;                                               // the LED strip flashes as one
        for (let i = 0; i < (vertical ? r.h : r.w); i++) {
          const px = (r.x + (vertical ? 0 : i)) * TILE, py = (r.y + (vertical ? i : 0)) * TILE;
          for (const o of [1, 6, 11]) {
            if (vertical) { g.rect(px + 7, py + o, 2, 4).fill({ color: 0xfff2b0, alpha: 1 }); g.rect(px + 4, py + o - 1, 8, 6).fill({ color: 0xffb020, alpha: 0.22 }); }
            else { g.rect(px + o, py + 7, 4, 2).fill({ color: 0xfff2b0, alpha: 1 }); g.rect(px + o - 1, py + 4, 6, 8).fill({ color: 0xffb020, alpha: 0.22 }); }
          }
        }
      }
      for (const b of gateBeacons(gate)) {
        const v = beaconLevel(time, b.end), cx = b.x * TILE + 8, cy = b.y * TILE + 8;
        if (v < 0.05) continue;
        g.circle(cx, cy, 3.2).fill({ color: 0xffe060, alpha: 0.35 + 0.65 * v });                  // the lit dome
        g.circle(cx, cy, 4 + 5 * v).fill({ color: 0xffa000, alpha: 0.22 * v });                   // soft halo
      }
    }
  }

  private drawDoors(o: number) {
    const g = this.g; g.clear();
    for (const gate of this.gates) {
      const vertical = gate.h >= gate.w;
      const L = (vertical ? gate.h : gate.w) * TILE, T = (vertical ? gate.w : gate.h) * TILE, px = gate.x * TILE, py = gate.y * TILE;
      // (u, v) = (along the long axis, across it) -> pixel rectangle
      const R = (u0: number, v0: number, u1: number, v1: number, c: number, a = 1) =>
        (vertical ? g.rect(px + v0, py + u0, v1 - v0, u1 - u0) : g.rect(px + u0, py + v0, u1 - u0, v1 - v0)).fill({ color: c, alpha: a });
      const P = (u: number, v: number, c: number) => R(u, v, u + 1, v + 1, c);
      // door track: dark deck with two guide rails, visible when the slabs are apart
      R(0, 0, L, T, DEEP);
      for (const v of [4, T - 5]) { R(0, v, L, v + 1, HI, 0.55); R(0, v + 1, L, v + 2, EDGE); }
      for (let u = 4; u < L; u += 8) { P(u, 2, STEEL); P(u, T - 3, STEEL); }
      const half = L / 2, reach = Math.round(half * (1 - 0.9 * o));
      for (const side of [0, 1]) {
        const u0 = side === 0 ? 0 : L - reach, u1 = side === 0 ? reach : L;
        if (u1 - u0 < 2) continue;
        R(u0, 1, u1, T - 1, EDGE); R(u0, 2, u1, T - 2, STEEL_D);                                                       // slab body in a dark outline
        // armour plates every 16px, each bevelled (light top-left, dark bottom-right) with corner rivets
        for (let pu = Math.floor(u0 / 16) * 16; pu < u1; pu += 16) {
          const a0 = Math.max(u0, pu), a1 = Math.min(u1, pu + 16);
          if (a1 - a0 < 3) continue;
          R(a0, 2, a1 - 1, T - 2, STEEL_D); R(a0, 2, a1 - 1, 3, STEEL); R(a0, 3, a0 + 1, T - 3, STEEL); R(a1 - 1, 2, a1, T - 2, DEEP); R(a0, T - 3, a1, T - 2, DEEP);
          if (a1 - a0 >= 12) for (const [du, v] of [[3, 4], [a1 - a0 - 4, 4], [3, T - 6], [a1 - a0 - 4, T - 6]]) P(a0 + du, v, HI);
        }
        R(u0, T / 2 - 1, u1, T / 2 + 1, DEEP);                                                                          // centre piston channel
        for (let u = u0 + 5; u < u1 - 3; u += 8) P(u, T / 2, 0x6d7580);
        // leading edge: black rubber seal then a diagonal hazard band, one pixel pattern across both slabs
        const lead = side === 0 ? u1 - 7 : u0;
        R(lead, 2, lead + 7, T - 2, DEEP);
        for (let v = 2; v < T - 2; v++) for (let u = lead + 1; u < lead + 6; u++) if ((u + v) % 6 < 3) P(u, v, YEL);
        R(side === 0 ? u1 - 1 : u0, 1, side === 0 ? u1 : u0 + 1, T - 1, EDGE);
      }
      // frame: heavy jambs along both sides (steel with an orange inner accent), flush with the cell edges; end lintels sit under the wall beacons
      for (const [v0, v1, acc] of [[0, 2, 2], [T - 2, T, T - 3]] as Array<[number, number, number]>) { R(0, v0, L, v1, EDGE); R(0, v0 === 0 ? 0 : v0 + 1, L, v0 === 0 ? 1 : v1, STEEL); R(0, acc, L, acc + 1, ORANGE); }
      const lamp = o > 0.95 ? GO : o < 0.05 ? RED : WAIT;                                                              // green open, red shut, amber moving
      for (const u of [half - 9, half + 7]) for (const v of [2, T - 4]) { R(u - 1, v - 1, u + 3, v + 3, EDGE); R(u, v, u + 2, v + 2, lamp); }
    }
  }
}
