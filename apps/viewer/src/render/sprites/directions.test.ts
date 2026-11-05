import { describe, it, expect } from "vitest";
import { buildAtlas } from "./atlas";

const a = buildAtlas();
const px = (k: string, x: number, y: number) => { const f = a.frames[k], i = ((f.y + y) * a.width + f.x + x) * 4; return [a.data[i], a.data[i + 1], a.data[i + 2], a.data[i + 3]].join(","); };
const diff = (k1: string, k2: string, y0 = 0, y1 = 15) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = 0; x < 16; x++) if (px(k1, x, y) !== px(k2, x, y)) n++; return n; };
const key = (d: number, v: number, dir: string) => (dir === "down" ? `char:${d}:${v}` : `char:${d}:${v}:${dir}`);

describe("four-direction character sprites", () => {
  it("every department and look has up / down / left / right frames", () => {
    for (let d = 0; d < 6; d++) for (let v = 0; v < 4; v++) for (const dir of ["up", "down", "left", "right"]) expect(a.frames[key(d, v, dir)], key(d, v, dir)).toBeTruthy();
  });
  it("the four views are clearly different from each other", () => {
    const dirs = ["up", "down", "left", "right"];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(diff(key(2, 1, dirs[i]), key(2, 1, dirs[j])), `${dirs[i]} vs ${dirs[j]}`).toBeGreaterThan(12);
  });
  it("left is the mirror image of right", () => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) expect(px(key(1, 0, "left"), x, y)).toBe(px(key(1, 0, "right"), 15 - x, y));
  });
  it("the back view shows no face: head rows differ from the front view", () => {
    expect(diff(key(0, 0, "up"), key(0, 0, "down"), 2, 6)).toBeGreaterThan(3);
  });
  it("each view keeps the department's look (same suit colour appears)", () => {
    const suit = (k: string) => { let n = 0; for (let y = 6; y < 12; y++) for (let x = 0; x < 16; x++) if (px(k, x, y) === px(key(3, 0, "down"), 7, 9)) n++; return n; };
    for (const dir of ["up", "left", "right"]) expect(suit(key(3, 0, dir))).toBeGreaterThan(2);
  });
});
