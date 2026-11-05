import { Container, Graphics } from "pixi.js";
import { TileKind } from "@wc/sim-core";
import { TILE } from "./tiles";
import type { ShipState } from "./shipstate";

export interface Seat { x: number; y: number; dir: 1 | -1 }                        // dir: +1 faces south (backrest on the north edge), -1 faces north
export interface Thruster { x: number; y: number; dx: number; dy: number; run: number }   // (dx, dy): exhaust direction; run: free void tiles beyond the nozzle mouth
interface DecoLike { x: number; y: number; sprite: string }

/** Find the animated fixtures of the docked ship in the baked station: shoulder-bar seats and main thrusters with their free exhaust run. */
export function shipFixtures(deco: DecoLike[], tileAt: (x: number, y: number) => TileKind): { seats: Seat[]; thrusters: Thruster[] } {
  const seats: Seat[] = [], thrusters: Thruster[] = [];
  for (const d of deco) {
    if (d.sprite === "prop:jumpseat") seats.push({ x: d.x, y: d.y, dir: 1 });
    else if (d.sprite === "prop:jumpseat-n") seats.push({ x: d.x, y: d.y, dir: -1 });
    else if (d.sprite === "prop:thruster") {
      // the nozzle mouth is the wall cell behind the thruster; the docked ship's stern faces east, so look east first
      let found: { mouth: DecoLike; dx: number; dy: number } | null = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const mouth = deco.find((m) => m.sprite === "wall:nozzle" && m.x === d.x + dx && m.y === d.y + dy); if (mouth) { found = { mouth, dx, dy }; break; } }
      if (!found) continue;
      const { mouth, dx, dy } = found;
      let i = 1; while (i < 3 && tileAt(mouth.x + dx * i, mouth.y + dy * i) === TileKind.Wall) i++;      // the exhaust leaves through the hull ring
      let run = 0; while (run < 5 && tileAt(mouth.x + dx * (i + run), mouth.y + dy * (i + run)) === TileKind.Void) run++;
      thrusters.push({ x: mouth.x, y: mouth.y, dx, dy, run: run + i - 1 });
    }
  }
  return { seats, thrusters };
}

const BAR = 0xe0741c, ARM = 0x8e9aa3, DARK = 0x14161a, GO = 0x7dffb0, WAIT = 0xffb02e;

/** Animated parts of the docked ship: shoulder bars over the seats, nozzle heat and main-thruster plumes. Redraws only while something changes. */
export class ShipLayer {
  readonly root = new Container();
  private bars = new Graphics();
  private seats: Seat[] = [];
  private jets: Array<{ box: Container; g: Graphics; t: Thruster }> = [];
  private lastBars = -1;
  constructor() { this.root.addChild(this.bars); }

  reset(fx: { seats: Seat[]; thrusters: Thruster[] }) {
    this.seats = fx.seats; this.lastBars = -1;
    for (const j of this.jets) j.box.destroy({ children: true });
    this.jets = fx.thrusters.map((t) => {
      const box = new Container(), g = new Graphics();
      g.blendMode = "add"; box.addChild(g);
      box.position.set((t.x + 0.5) * TILE, (t.y + 0.5) * TILE); box.rotation = Math.atan2(t.dy, t.dx);
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
    if (s.glow > 0.01) g.circle(0, 0, 5 + 2 * s.glow).fill({ color: 0xff7a1a, alpha: 0.25 * s.glow });             // nozzle heat
    if (s.thrust <= 0.01) return;
    const flick = 0.92 + 0.08 * Math.sin(time * 38) * Math.sin(time * 23 + 1);
    const len = (4 + s.thrust * (t.run * TILE + 6)) * flick;                                                       // plume reaches the end of the free run
    for (const [w, a, c] of [[5, 0.35, 0xff4a10], [3.2, 0.55, 0xffa020], [1.6, 0.9, 0xfff2b0]] as Array<[number, number, number]>)
      g.poly([0, -w, len * (w / 5 > 0.5 ? 0.85 : 1), -w * 0.25, len, 0, len * (w / 5 > 0.5 ? 0.85 : 1), w * 0.25, 0, w]).fill({ color: c, alpha: a * Math.min(1, s.thrust * 1.5) });
  }
}
