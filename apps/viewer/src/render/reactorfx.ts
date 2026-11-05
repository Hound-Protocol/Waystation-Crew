import { Container, Graphics } from "pixi.js";
import { TUNING } from "@wc/sim-core";
import { TILE } from "./tiles";

export type CoreStatus = "offline" | "starting" | "running" | "scram";
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The core's glow for a status and output at a time (seconds): colour and strength. Pure; the overlay eases toward it. */
export function coreGlow(status: CoreStatus, output: number, t: number): { a: number; rgb: [number, number, number] } {
  const tau = Math.PI * 2;
  switch (status) {
    case "running": return { a: clamp01(0.14 + 0.7 * clamp01(output) + 0.04 * Math.sin(t * tau * 0.8)), rgb: [140, 230, 255] };
    case "starting": return { a: clamp01(0.2 + 0.1 * Math.sin(t * tau * 1.5)), rgb: [255, 170, 80] };
    case "scram": return { a: clamp01(0.16 + 0.1 * Math.sin(t * tau * 0.5)), rgb: [255, 60, 40] };
    default: return { a: 0.06, rgb: [90, 100, 110] };
  }
}

/** The console's four gauges, each 0..1, with a warning for temperature outside the healthy band. */
export function gaugeBars(p: { feed: number; temp: number; field: number; coolant: number }): { key: "feed" | "temp" | "field" | "coolant"; v: number; warn: boolean }[] {
  return [
    { key: "feed", v: clamp01(p.feed), warn: false },
    { key: "temp", v: clamp01(p.temp), warn: p.temp > TUNING.band[1] || p.temp < TUNING.band[0] },
    { key: "field", v: clamp01(p.field), warn: false },
    { key: "coolant", v: clamp01(p.coolant), warn: false },
  ];
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Draws the reactor prop's live core and gauges on its tile. Everything eases (no pop-ins), and it only exists once the station has a reactor. */
export class ReactorFx {
  readonly root = new Container();
  private core = new Graphics(); private gauges = new Graphics();
  private a = 0.06; private rgb: [number, number, number] = [90, 100, 110]; private bars = [0, 0, 0, 0];
  private pos: { x: number; y: number } | null = null;
  constructor() { this.core.blendMode = "add"; this.root.addChild(this.core, this.gauges); this.root.visible = false; }
  setSite(tile: { x: number; y: number } | null) { this.pos = tile; this.root.visible = !!tile; if (tile) this.root.position.set(tile.x * TILE, tile.y * TILE); }

  update(dt: number, time: number, p: { status: CoreStatus; output: number; feed: number; temp: number; field: number; coolant: number } | null) {
    if (!this.pos) return;
    const goal = p ? coreGlow(p.status, p.output, time) : { a: 0.06, rgb: [90, 100, 110] as [number, number, number] };
    const k = 1 - Math.exp(-dt * 4);
    this.a = mix(this.a, goal.a, k); for (let i = 0; i < 3; i++) this.rgb[i] = mix(this.rgb[i], goal.rgb[i], k);
    const col = (Math.round(this.rgb[0]) << 16) | (Math.round(this.rgb[1]) << 8) | Math.round(this.rgb[2]);
    this.core.clear(); this.core.circle(8, 8, 9).fill({ color: col, alpha: this.a * 0.35 }); this.core.circle(8, 8, 5).fill({ color: col, alpha: this.a });
    const bars = p ? gaugeBars(p) : null;
    this.gauges.clear(); this.gauges.rect(2, 11, 12, 4).fill({ color: 0x07080b, alpha: 0.9 });
    for (let i = 0; i < 4; i++) {
      this.bars[i] = mix(this.bars[i], bars ? bars[i].v : 0, k);
      const h = Math.max(0.5, this.bars[i] * 3), warn = bars?.[i].warn ?? false;
      this.gauges.rect(3 + i * 3, 14 - h, 2, h).fill(warn ? 0xff6a4a : 0x6be3ff);
    }
  }
}
