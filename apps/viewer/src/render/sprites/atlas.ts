import { drawTile, wallVertical, doorFrame } from "./tiles";
import { rotate90 } from "./transform";
import { DOOR_FRAMES } from "../doorframes";
import { TileKind } from "@wc/sim-core";
import { drawHumanDir, appearance } from "./human";

export interface Atlas { width: number; height: number; data: Uint8ClampedArray; frames: Record<string, { x: number; y: number; w: number; h: number }> }

export function buildAtlas(): Atlas {
  const items: Array<[string, { w: number; h: number; data: Uint8ClampedArray }]> = [];
  for (let k = 0; k <= 8; k++) items.push([`tile:${k}`, drawTile(k)]);
  for (const s of ["single", "left", "mid", "right"] as const) items.push([s === "single" ? "tile:2:v" : `tile:2:v${s[0]}`, wallVertical(s)]);
  for (let k = 0; k < DOOR_FRAMES; k++) { const f = doorFrame(k / (DOOR_FRAMES - 1)); items.push([`door:h:${k}`, f], [`door:v:${k}`, rotate90(f)]); }
  for (let d = 0; d < 6; d++) for (let v = 0; v < 4; v++) for (const dir of ["down", "up", "left", "right"] as const) items.push([dir === "down" ? `char:${d}:${v}` : `char:${d}:${v}:${dir}`, drawHumanDir({ ...appearance(v), dept: d }, dir)]);
  const cols = 11, rows = Math.ceil(items.length / cols), width = cols * 16, height = rows * 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const frames: Atlas["frames"] = {};
  items.forEach(([name, img], i) => {
    const fx = (i % cols) * 16, fy = Math.floor(i / cols) * 16;
    frames[name] = { x: fx, y: fy, w: 16, h: 16 };
    for (let y = 0; y < 16; y++) data.set(img.data.subarray(y * 64, y * 64 + 64), ((fy + y) * width + fx) * 4);
  });
  return { width, height, data, frames };
}
