import { describe, it, expect } from "vitest";
import { TileKind } from "@wc/sim-core";
import { Img } from "./image";
import { rotate90 } from "./transform";
import { buildAtlas } from "./atlas";
import { wallIsVertical, wallSide } from "./orient";

describe("wall orientation", () => {
  it("rotate90 turns the image a quarter turn clockwise", () => {
    const im = new Img(); im.px(1, 2, [10, 20, 30]);
    const r = rotate90(im);
    const i = (2 * 0 + 1 * 16 + 13) * 4; // new (13,1)
    expect([r.data[i], r.data[i + 1], r.data[i + 2], r.data[i + 3]]).toEqual([10, 20, 30, 255]);
    expect(r.alpha(1, 2)).toBe(0);
  });
  it("vertical wall tiles are those joined above/below but not left/right", () => {
    const W = TileKind.Wall, F = TileKind.Floor;
    const g = [F, W, F,  F, W, F,  F, W, F];
    expect(wallIsVertical(g, 3, 3, 1, 1)).toBe(true);
    const h = [F, F, F,  W, W, W,  F, F, F];
    expect(wallIsVertical(h, 3, 3, 1, 1)).toBe(false);
    const corner = [W, W, F,  W, F, F,  F, F, F];
    expect(wallIsVertical(corner, 3, 3, 0, 0)).toBe(false); // has a right neighbour: horizontal
    expect(wallIsVertical([W], 1, 1, 0, 0)).toBe(false);
  });
  it("thick vertical walls (3 wide, long) are vertical, with left / middle / right sides", () => {
    const W = TileKind.Wall, F = TileKind.Floor;
    const rows = 6, g: number[] = [];
    for (let y = 0; y < rows; y++) g.push(F, W, W, W, F);
    for (const y of [0, 2, 5]) {
      expect(wallIsVertical(g, 5, rows, 2, y)).toBe(true);
      expect(wallSide(g, 5, rows, 1, y)).toBe("left");
      expect(wallSide(g, 5, rows, 2, y)).toBe("mid");
      expect(wallSide(g, 5, rows, 3, y)).toBe("right");
    }
    expect(wallSide([F, W, F, F, W, F], 3, 2, 1, 0)).toBe("single");
    const thickH = [W, W, W, W, W, W,  W, W, W, W, W, W,  F, F, F, F, F, F];
    expect(wallIsVertical(thickH, 6, 3, 3, 0)).toBe(false); // 2 tall, 6 wide: horizontal
  });
  it("atlas has distinct left / mid / right vertical frames", () => {
    const a = buildAtlas();
    const px = (k: string, x: number, y: number) => { const f = a.frames[k], i = ((f.y + y) * a.width + f.x + x) * 4; return [a.data[i], a.data[i + 1], a.data[i + 2]].join(); };
    for (const k of ["tile:2:vl", "tile:2:vm", "tile:2:vr"]) expect(a.frames[k]).toBeTruthy();
    expect(px("tile:2:vl", 0, 4)).not.toBe(px("tile:2:vm", 0, 4));   // only the left piece has the lit face
    expect(px("tile:2:vr", 13, 4)).not.toBe(px("tile:2:vm", 13, 4)); // only the right piece has hazard + shadow
  });
  it("atlas holds a vertical wall frame distinct from the horizontal one", () => {
    const a = buildAtlas();
    expect(a.frames["tile:2:v"]).toBeTruthy();
    const f = a.frames["tile:2"], v = a.frames["tile:2:v"];
    let diff = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = ((f.y + y) * a.width + f.x + x) * 4, j = ((v.y + y) * a.width + v.x + x) * 4;
      if (a.data[i] !== a.data[j] || a.data[i + 1] !== a.data[j + 1]) diff++;
    }
    expect(diff).toBeGreaterThan(40);
  });
  it("vertical wall has real sides: lit left edge, shadowed right edge, hazard stripe running along it", () => {
    const a = buildAtlas(), v = a.frames["tile:2:v"];
    const lum = (x: number, y: number) => { const i = ((v.y + y) * a.width + v.x + x) * 4; return a.data[i] + a.data[i + 1] + a.data[i + 2]; };
    for (const y of [1, 6, 11]) { expect(lum(0, y)).toBeGreaterThan(lum(14, y) + 30); expect(lum(0, y)).toBeGreaterThan(lum(15, y)); }
    // hazard runs vertically: a yellow pixel appears in nearly every row of the stripe columns
    const yellow = (x: number, y: number) => { const i = ((v.y + y) * a.width + v.x + x) * 4; return a.data[i] > 150 && a.data[i + 1] > 110 && a.data[i + 2] < 60; };
    let rows = 0; for (let y = 0; y < 16; y++) if (yellow(12, y) || yellow(13, y)) rows++;
    expect(rows).toBeGreaterThanOrEqual(12);
    // no horizontal hazard dashes crossing the body
    let wide = 0; for (let y = 0; y < 16; y++) { let n = 0; for (let x = 0; x < 16; x++) if (yellow(x, y)) n++; if (n > 4) wide++; }
    expect(wide).toBe(0);
  });
});

