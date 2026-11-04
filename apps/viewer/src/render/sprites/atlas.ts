import { drawTile } from "./tiles";
import { drawHuman, appearance } from "./human";

export interface Atlas { width: number; height: number; data: Uint8ClampedArray; frames: Record<string, { x: number; y: number; w: number; h: number }> }

export function buildAtlas(): Atlas {
  const items: Array<[string, { w: number; h: number; data: Uint8ClampedArray }]> = [];
  for (let k = 0; k <= 8; k++) items.push([`tile:${k}`, drawTile(k)]);
  for (let d = 0; d < 6; d++) for (let v = 0; v < 4; v++) items.push([`char:${d}:${v}`, drawHuman({ ...appearance(v), dept: d })]);
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
