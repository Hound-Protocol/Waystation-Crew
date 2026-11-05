import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { buildPad, PAD } from "@wc/sim-core";
import { BODIES, stationFrame } from "./space/system";
import { buildTileCanvas, TILE } from "./tiles";
import { GateLayer } from "./gates";

const HOME = BODIES.find((b) => b.home)!;
const MARGIN = 26;   // bare ground around the paved rectangle, tiles

/** Top-left tile of the pad chunk: centred on the home planet's disc. The planet's spin is synchronous with the station, so this never moves. */
export function padOrigin(): { x: number; y: number } {
  const c = stationFrame(0).body(HOME);
  return { x: Math.round(c.x - PAD.w / 2), y: Math.round(c.y - PAD.h / 2) };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
/** The surface fades in as the camera closes in (scale = camera pixels per tile), so it never pops. */
export function padFade(scale: number): number { return smooth(Math.max(0, Math.min(1, (scale - 4) / 6))); }

const GROUND = 0x1b3550, GROUND_HI = 0x24476a, GROUND_LO = 0x14283d;
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** The landing pad on the home planet's surface: ground patch clipped to the planet disc, the baked pad, and the outpost gate stub. */
export class PadLayer {
  readonly root = new Container();
  readonly gate = new GateLayer();
  constructor() {
    const o = padOrigin(), c = stationFrame(0).body(HOME), pad = buildPad();
    this.root.position.set(o.x * TILE, o.y * TILE);
    const ground = new Graphics(), mask = new Graphics();
    const x0 = -MARGIN, y0 = -MARGIN, x1 = PAD.w + MARGIN, y1 = PAD.h + MARGIN;
    ground.rect(x0 * TILE, y0 * TILE, (x1 - x0) * TILE, (y1 - y0) * TILE).fill(GROUND);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const r = hash(x, y);
      if (r < 0.10) ground.rect(x * TILE, y * TILE, TILE, TILE).fill(GROUND_LO);
      else if (r > 0.93) ground.rect(x * TILE + 5, y * TILE + 6, 4, 3).fill(GROUND_HI);
    }
    mask.circle((c.x - o.x) * TILE, (c.y - o.y) * TILE, HOME.radius * TILE).fill(0xffffff);
    ground.mask = mask;
    const baked = new Sprite(Texture.from(buildTileCanvas({ w: PAD.w, h: PAD.h, tiles: Array.from(pad.map.tiles), rooms: pad.rooms, furniture: pad.furniture, deco: pad.deco, floors: pad.floors ? Array.from(pad.floors) : undefined })));
    baked.texture.source.scaleMode = "nearest";
    this.gate.reset(pad.map.tiles, PAD.w, PAD.h);
    this.root.addChild(mask, ground, baked, this.gate.root);
    this.root.alpha = 0; this.root.visible = false;
  }
  update(time: number, scale: number, gate: { gate: number; gateMoving: boolean }) {
    const a = padFade(scale);
    this.root.alpha = a; this.root.visible = a > 0.005;
    if (this.root.visible) this.gate.update(time, gate);
  }
}
