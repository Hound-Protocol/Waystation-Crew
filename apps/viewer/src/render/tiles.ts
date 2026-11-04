import { Rectangle, Texture } from "pixi.js";
import type { RoomSnap } from "@wc/protocol";
import { buildAtlas } from "./sprites";
import { wallIsVertical } from "./sprites/orient";
import { bakeLighting, type Light } from "./light";

export const TILE = 16;
// TileKind order: Void, Floor, Wall, Door, Bed, Console, Table, Plant, Airlock
const LIGHT_BY_KIND: Record<number, Omit<Light, "x" | "y"> | undefined> = {
  5: { r: 34, i: 0.8, c: [60, 200, 255] }, 7: { r: 26, i: 0.5, c: [60, 255, 150] },
  3: { r: 20, i: 0.5, c: [255, 60, 60] }, 8: { r: 46, i: 0.8, c: [255, 140, 40] },
};

export function buildTileCanvas(w: number, h: number, tiles: number[], rooms: RoomSnap[]): HTMLCanvasElement {
  const atlas = buildAtlas();
  const W = w * TILE, H = h * TILE;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const k = tiles[ty * w + tx];
    const f = (k === 2 && wallIsVertical(tiles, w, h, tx, ty) ? atlas.frames["tile:2:v"] : atlas.frames[`tile:${k}`]) ?? atlas.frames["tile:0"];
    for (let y = 0; y < TILE; y++) {
      const src = ((f.y + y) * atlas.width + f.x) * 4;
      data.set(atlas.data.subarray(src, src + TILE * 4), ((ty * TILE + y) * W + tx * TILE) * 4);
    }
  }
  const lights: Light[] = [];
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const l = LIGHT_BY_KIND[tiles[ty * w + tx]];
    if (l) lights.push({ x: tx * TILE + 8, y: ty * TILE + 8, ...l });
  }
  for (const r of rooms) lights.push({ x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE, r: Math.max(r.w, r.h) * TILE * 0.55, i: 0.55, c: [255, 170, 90] });
  for (let x = 4; x < w; x += 9) lights.push({ x: x * TILE, y: 19 * TILE, r: 70, i: 0.55, c: [255, 170, 90] });
  bakeLighting(data, W, H, lights, 0.5);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  cv.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), W, H), 0, 0);
  return cv;
}

export function canvasTexture(cv: HTMLCanvasElement): Texture {
  const t = Texture.from(cv);
  t.source.scaleMode = "nearest";
  return t;
}

/** Character frames from the generated atlas: `char:<dept>:<variant>`. */
export function characterTextures(): Map<string, Texture> {
  const atlas = buildAtlas();
  const cv = document.createElement("canvas");
  cv.width = atlas.width; cv.height = atlas.height;
  cv.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(atlas.data), atlas.width, atlas.height), 0, 0);
  const base = canvasTexture(cv);
  const out = new Map<string, Texture>();
  for (const [name, f] of Object.entries(atlas.frames)) out.set(name, new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
  return out;
}
