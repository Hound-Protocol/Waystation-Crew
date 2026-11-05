import { BufferImageSource, Filter, GlProgram } from "pixi.js";
import type { BakeInput, TileCanvas } from "../tiles";
import { TILE } from "../tiles";
import { deriveLights } from "./sources";
import { solidMask, applyDoors } from "./occluders";
import { softness, sampleLight, quantize, TINT_K, characterLevel } from "./model";
import { pickLights } from "./pick";
import { LightFade } from "./fade";
import { FRAGMENT, VERTEX, MAX_LIGHTS, MAX_STEPS } from "./shader";
import type { LightSource } from "./types";

export interface LightBudget { maxLights: number; steps: number; shadows: boolean }

/** One byte per cell/pixel on the GPU (r8unorm), nearest-sampled. Not cached by pixi, so replacing one frees the old. */
const byteTexture = (data: Uint8Array, w: number, h: number): BufferImageSource => new BufferImageSource({ resource: data, width: w, height: h, format: "r8unorm", scaleMode: "nearest" });

/** GPU lighting for the station canvas: a filter on the map layer that lights each pixel from the visible lights, with shadows from the solid-tile mask. */
export class LightPass {
  readonly filter: Filter;
  private readonly fade = new LightFade();
  private mapW = 1; private mapH = 1;
  private mask: BufferImageSource; private emis: BufferImageSource;
  private maskBytes = new Uint8Array(1); private doorsDirty = false;
  /** kept for the parity probe */
  maskData = new Uint8Array(1); canvas: TileCanvas | null = null;
  private readonly lights = new Float32Array(MAX_LIGHTS * 4);
  private readonly colors = new Float32Array(MAX_LIGHTS * 4);
  private readonly aim = new Float32Array(MAX_LIGHTS * 4);
  /** Brightness (0.38..1) for a character standing at a tile-space point, from the lights currently on screen. */
  levelAt(x: number, y: number): number { return characterLevel(sampleLight(this.maskData, this.mapW, this.active, x, y).L); }
  get mapSize() { return { w: this.mapW, h: this.mapH }; }
  /** debug/test: lower the light count further than the budget allows */
  cap = Infinity;
  budget: LightBudget = { maxLights: MAX_LIGHTS, steps: MAX_STEPS, shadows: true };
  /** lights sent to the GPU on the last update (debug and tests) */
  active: LightSource[] = [];

  constructor() {
    this.mask = byteTexture(new Uint8Array(1), 1, 1); this.emis = byteTexture(new Uint8Array(1), 1, 1);
    const u = {
      uView: { value: new Float32Array([0, 0, 16, 0]), type: "vec4<f32>" },
      uMap: { value: new Float32Array([1, 1, 0, MAX_STEPS]), type: "vec4<f32>" },
      uLights: { value: this.lights, type: "vec4<f32>", size: MAX_LIGHTS },
      uColors: { value: this.colors, type: "vec4<f32>", size: MAX_LIGHTS },
      uAim: { value: this.aim, type: "vec4<f32>", size: MAX_LIGHTS },
    };
    this.filter = new Filter({ glProgram: GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: "light-pass" }), resources: { lightUniforms: u, uMask: this.mask, uEmis: this.emis }, resolution: "inherit" as unknown as number });
  }

  /** Call whenever the station is rebuilt. `canvas` is the unlit tile canvas from `buildTileCanvas(inp, { lit: false })`. */
  setStation(inp: BakeInput, canvas: TileCanvas): void {
    this.fade.sync(deriveLights(inp)); this.mapW = inp.w; this.mapH = inp.h;
    const mask = solidMask(inp); this.maskData = mask as Uint8Array<ArrayBuffer>; this.canvas = canvas;
    this.maskBytes = Uint8Array.from(mask, (m) => (m ? 255 : 0)); this.doorsDirty = false;
    const oldMask = this.mask, oldEmis = this.emis;
    this.mask = byteTexture(this.maskBytes, inp.w, inp.h);
    this.emis = canvas.emissive ? byteTexture(canvas.emissive.data, canvas.emissive.w, canvas.emissive.h) : byteTexture(new Uint8Array(1), 1, 1);
    this.filter.resources.uMask = this.mask; this.filter.resources.uEmis = this.emis;
    oldMask.destroy(); oldEmis.destroy();                         // a rebuild must not leave the previous textures on the GPU
  }

  /** Doors let light through as they open: call each frame with the eased open amounts (0..1); uploads only when something changed. */
  setDoors(doors: ReadonlyArray<{ x: number; y: number }>, open: ArrayLike<number>): void {
    if (!doors.length) return;
    const w = this.mapW;
    for (let i = 0; i < doors.length; i++) {
      const v = Math.round((1 - Math.min(1, Math.max(0, open[i]))) * 255);
      if (this.maskBytes[doors[i].y * w + doors[i].x] !== v) { applyDoors(this.maskBytes, w, [doors[i]], [open[i]]); this.doorsDirty = true; }
    }
    if (this.doorsDirty) { this.mask.update(); this.doorsDirty = false; }
  }

  /** Per frame: pick the visible lights and upload them. `tx, ty, scale` are the camera (screen = tile * scale + t); `res` is the renderer resolution. */
  update(dt: number, tx: number, ty: number, scale: number, viewW: number, viewH: number, res: number): void {
    this.fade.step(dt);
    const view = { x0: -tx / scale, y0: -ty / scale, x1: (viewW - tx) / scale, y1: (viewH - ty) / scale };
    const live = this.fade.entries().filter((e) => e.f > 0).map((e) => (e.f === 1 ? e.light : { ...e.light, i: e.light.i * e.f }));   // fading lights carry their fade in their intensity
    this.active = pickLights(live, view, Math.min(this.budget.maxLights, this.cap));
    let n = 0;
    for (const l of this.active) {
      this.lights.set([l.x, l.y, l.r, l.i], n * 4); this.colors.set([l.c[0] / 255, l.c[1] / 255, l.c[2] / 255, l.kind === "spot" ? 1 : 0], n * 4); this.aim.set([l.dir ?? 0, l.cone ?? Math.PI, 1, 0], n * 4); n++;
    }
    const g = this.filter.resources.lightUniforms.uniforms;
    g.uView[0] = tx; g.uView[1] = ty; g.uView[2] = scale; g.uView[3] = softness(scale);
    g.uMap[0] = this.mapW; g.uMap[1] = this.mapH; g.uMap[2] = n; g.uMap[3] = this.budget.shadows ? this.budget.steps : 1;
  }
}

/** Debug/parity: what the CPU reference says a pixel of the lit station should be. Used by the in-browser parity probe, never per frame. */
export function expectedPixel(pass: LightPass, tx: number, ty: number, scale: number): [number, number, number] | null {
  const cv = pass.canvas; if (!cv) return null;
  const d = cv.getContext("2d")!.getImageData(Math.floor(tx * TILE), Math.floor(ty * TILE), 1, 1).data;
  if (d[3] === 0) return null;
  if (cv.emissive && cv.emissive.data[Math.floor(ty * TILE) * cv.emissive.w + Math.floor(tx * TILE)] > 0) return [d[0], d[1], d[2]];
  const { L, tint } = sampleLight(pass.maskData, pass.mapSize.w, pass.active, tx, ty), q = quantize(L, softness(scale));
  return [0, 1, 2].map((k) => Math.min(255, d[k] * q + tint[k] * TINT_K)) as [number, number, number];
}
