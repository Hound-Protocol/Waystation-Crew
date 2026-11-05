import { describe, it, expect } from "vitest";
import { Department, Rank } from "@wc/sim-core";
import { PALETTE } from "./palette";
import { drawHumanDir, tierOf, BERET, type FacingDir } from "./human";
import { buildAtlas } from "./atlas";

const DIRS: FacingDir[] = ["down", "up", "left", "right"];
const base = { skin: "#b57a52", hair: "#1d1710" };
const draw = (dept: Department, dir: FacingDir, tier?: 0 | 1 | 2) => drawHumanDir({ ...base, dept, tier }, dir);
const at = (im: { data: Uint8ClampedArray }, x: number, y: number) => { const i = (y * 16 + x) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2], im.data[i + 3]]; };
const diff = (a: { data: Uint8ClampedArray }, b: { data: Uint8ClampedArray }) => { const out: [number, number][] = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (at(a, x, y).join() !== at(b, x, y).join()) out.push([x, y]); return out; };
const beretPixels = (im: { data: Uint8ClampedArray }) => { let n = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { const p = at(im, x, y); if (p[3] && ((p[0] << 16) | (p[1] << 8) | p[2]) === ((BERET[0] << 16) | (BERET[1] << 8) | BERET[2])) n++; } return n; };

describe("rank tiers", () => {
  it("maps Chief to 2, Senior to 1 and everyone else to 0", () => {
    expect(tierOf(Rank.Chief)).toBe(2); expect(tierOf(Rank.Senior)).toBe(1);
    for (const r of [Rank.Trainee, Rank.Technician, Rank.Specialist]) expect(tierOf(r)).toBe(0);
  });
});

describe("chief and senior looks", () => {
  it("leaves crew sprites unchanged", () => {
    for (const d of [Department.Engineering, Department.Medical, Department.Command]) for (const dir of DIRS) expect(diff(draw(d, dir), draw(d, dir, 0))).toEqual([]);
  });
  it("a Chief differs from crew in the head rows in every direction", () => {
    for (const d of [Department.Engineering, Department.Command, Department.Medical]) for (const dir of DIRS) expect(diff(draw(d, dir), draw(d, dir, 2)).some(([, y]) => y <= 3), `${d} ${dir}`).toBe(true);
  });
  it("a Chief has white beret pixels in the front, side and back views", () => {
    for (const dir of DIRS) { expect(beretPixels(draw(Department.Engineering, dir, 2)), dir).toBeGreaterThanOrEqual(8); expect(beretPixels(draw(Department.Engineering, dir)), dir).toBe(0); }
  });
  it("a Chief also has a collar and shoulder stripe, below the head", () => {
    for (const dir of DIRS) expect(diff(draw(Department.Engineering, dir), draw(Department.Engineering, dir, 2)).some(([, y]) => y >= 7 && y <= 8), dir).toBe(true);
  });
  it("a Senior differs from crew only in the sleeve, with no beret", () => {
    for (const dir of DIRS) {
      const d = diff(draw(Department.Engineering, dir), draw(Department.Engineering, dir, 1));
      expect(d.length, dir).toBeGreaterThan(0); for (const [, y] of d) expect(y, dir).toBe(9);
      expect(beretPixels(draw(Department.Engineering, dir, 1))).toBe(0);
    }
  });
  it("a Senior and a Chief look different", () => {
    for (const dir of DIRS) expect(diff(draw(Department.Engineering, dir, 1), draw(Department.Engineering, dir, 2)).length).toBeGreaterThan(0);
  });
  it("uses only palette colours", () => {
    for (const tier of [1, 2] as const) for (const dir of DIRS) for (const d of [Department.Engineering, Department.Medical]) { const im = draw(d, dir, tier); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = at(im, x, y); if (p[3]) expect(PALETTE.has((p[0] << 16) | (p[1] << 8) | p[2])).toBe(true); } }
  });
});

describe("the atlas", () => {
  it("has a frame for every department, variant, tier and direction, with unique keys", () => {
    const a = buildAtlas(), keys = Object.keys(a.frames).filter((k) => k.startsWith("char:"));
    expect(keys.length).toBe(7 * 4 * 3 * 4); expect(new Set(keys).size).toBe(keys.length);
    expect(a.frames["char:3:2:2"]).toBeTruthy(); expect(a.frames["char:3:2:2:left"]).toBeTruthy(); expect(a.frames["char:0:0:0:up"]).toBeTruthy();
  });
});
