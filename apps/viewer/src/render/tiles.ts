import { Rectangle, Texture } from "pixi.js";
import type { DecoSnap, FurnitureSnap, RoomSnap } from "@wc/protocol";
import { TileKind } from "@wc/sim-core";
import { buildAtlas } from "./sprites";
import { Img } from "./sprites/image";
import { drawWallAuto, maskKey } from "./sprites/autowall";
import { drawFloor } from "./sprites/floors";
import { spriteFor, glowOf } from "./sprites/library";
import { bakeLighting, type Light } from "./light";

export const TILE = 16;

export interface BakeInput {
  w: number; h: number; tiles: number[]; rooms: RoomSnap[]; furniture?: FurnitureSnap[]; deco?: DecoSnap[]; floors?: number[];
}

const isWall = (k: number) => k === TileKind.Wall || k === TileKind.Door;
const wallCache = new Map<number, Img>();

/** Everything static in the station, composed in layers and lit once: floors, floor decals, autotiled walls, furniture and props, wall mounts. */
export function buildTileCanvas(inp: BakeInput): HTMLCanvasElement {
  const { w, h, tiles, rooms } = inp;
  const atlas = buildAtlas();
  const W = w * TILE, H = h * TILE;
  const data = new Uint8ClampedArray(W * H * 4);
  const blit = (img: { data: Uint8ClampedArray }, tx: number, ty: number) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const s = (y * TILE + x) * 4;
      if (img.data[s + 3] === 0) continue;
      const d = ((ty * TILE + y) * W + tx * TILE + x) * 4;
      data[d] = img.data[s]; data[d + 1] = img.data[s + 1]; data[d + 2] = img.data[s + 2]; data[d + 3] = 255;
    }
  };
  const frame = (name: string) => { const f = atlas.frames[name]; const im = { data: new Uint8ClampedArray(TILE * TILE * 4) }; for (let y = 0; y < TILE; y++) im.data.set(atlas.data.subarray(((f.y + y) * atlas.width + f.x) * 4, ((f.y + y) * atlas.width + f.x) * 4 + TILE * 4), y * TILE * 4); return im; };
  const floorCache = new Map<number, Img>();
  const floorAt = (style: number, parity: number) => { const key = style * 2 + parity; let f = floorCache.get(key); if (!f) { f = drawFloor(style, parity); floorCache.set(key, f); } return f; };
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : tiles[y * w + x]);

  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const k = tiles[ty * w + tx];
    if (k === TileKind.Void) continue;
    if (k === TileKind.Wall) {
      const m = { n: isWall(at(tx, ty - 1)), e: isWall(at(tx + 1, ty)), s: isWall(at(tx, ty + 1)), w: isWall(at(tx - 1, ty)), ne: isWall(at(tx + 1, ty - 1)), se: isWall(at(tx + 1, ty + 1)), sw: isWall(at(tx - 1, ty + 1)), nw: isWall(at(tx - 1, ty - 1)) };
      const key = maskKey(m); let im = wallCache.get(key); if (!im) { im = drawWallAuto(m); wallCache.set(key, im); }
      blit(im, tx, ty);
    } else if (k === TileKind.Door || k === TileKind.Airlock) blit(frame(`tile:${k}`), tx, ty);
    else blit(floorAt(inp.floors?.[ty * w + tx] ?? 0, (tx + ty) & 1), tx, ty);
  }
  const lights: Light[] = [];
  const addGlow = (name: string, x: number, y: number) => { const g = glowOf(name); if (g) lights.push({ x: x * TILE + 8, y: y * TILE + 8, r: g.r, i: g.i, c: g.c }); };
  for (const d of inp.deco ?? []) if (d.layer === "floor") { const s = spriteFor(d.sprite); if (s) blit(s, d.x, d.y); }
  for (const d of inp.deco ?? []) if (d.layer === "prop") { const s = spriteFor(d.sprite); if (s) blit(s, d.x, d.y); addGlow(d.sprite, d.x, d.y); }
  for (const f of inp.furniture ?? []) { const s = spriteFor(f.style ?? DEFAULT_STYLE[f.kind] ?? ""); if (s) blit(s, f.x, f.y); addGlow(f.style ?? DEFAULT_STYLE[f.kind] ?? "", f.x, f.y); }
  for (const d of inp.deco ?? []) if (d.layer === "wall") { const s = spriteFor(d.sprite); if (s) blit(s, d.x, d.y); addGlow(d.sprite, d.x, d.y + 1); }
  for (const r of rooms) lights.push({ x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE, r: Math.max(r.w, r.h) * TILE * 0.55, i: 0.5, c: [255, 170, 90] });
  // corridor and plaza lamps on a sparse grid
  if (inp.floors) for (let y = 3; y < h; y += 9) for (let x = 3; x < w; x += 9) { const st = inp.floors[y * w + x]; if (tiles[y * w + x] === TileKind.Floor && (st === 0 || st === 8)) lights.push({ x: x * TILE + 8, y: y * TILE + 8, r: 80, i: 0.6, c: [255, 190, 120] }); }
  bakeLighting(data, W, H, lights, 0.5);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  cv.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), W, H), 0, 0);
  return cv;
}

/** Sprite used for interactive furniture that carries no explicit style. */
const DEFAULT_STYLE: Record<number, string> = { [TileKind.Bed]: "bed:habitation", [TileKind.Console]: "console:habitation", [TileKind.Table]: "table:basic", [TileKind.Plant]: "plant:fern" };

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
