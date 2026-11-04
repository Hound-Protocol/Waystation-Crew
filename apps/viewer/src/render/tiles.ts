import { Texture } from "pixi.js";
import type { FurnitureSnap } from "@wc/protocol";

export const TILE = 16;
// TileKind order: Void, Floor, Wall, Door, Bed, Console, Table, Plant, Airlock
const FLAT = ["#07080b", "#1b2028", "#3a4350", "#245f73", "#4b5a6e", "#1d2b35", "#3b3f48", "#1f5a3a", "#8a4a1c"];

export function buildTileCanvas(w: number, h: number, tiles: number[], _furniture: FurnitureSnap[]): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = w * TILE; cv.height = h * TILE;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = tiles[y * w + x];
      g.fillStyle = FLAT[k] ?? FLAT[0];
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (k === 1) { g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(x * TILE, y * TILE, TILE, 1); g.fillRect(x * TILE, y * TILE, 1, TILE); }
    }
  return cv;
}

export function canvasTexture(cv: HTMLCanvasElement): Texture {
  const t = Texture.from(cv);
  t.source.scaleMode = "nearest";
  return t;
}
