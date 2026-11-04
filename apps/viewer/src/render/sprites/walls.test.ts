import { describe, it, expect } from "vitest";
import { TileKind } from "@wc/sim-core";
import { Img } from "./image";
import { rotate90 } from "./transform";
import { buildAtlas } from "./atlas";
import { wallIsVertical } from "./orient";

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
});
