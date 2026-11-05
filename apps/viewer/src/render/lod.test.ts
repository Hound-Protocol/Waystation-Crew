import { describe, it, expect } from "vitest";
import { zoomLevel, lodStyle, showsTools } from "./lod";

describe("zoomLevel (1 = closest, 6 = whole solar system)", () => {
  it("maps pixels-per-tile to six levels with the right boundaries", () => {
    const cases: Array<[number, number]> = [[200, 1], [64, 1], [48, 1], [47.9, 2], [28, 2], [27.9, 3], [16, 3], [15.9, 4], [5, 4], [4.9, 5], [0.6, 5], [0.59, 6], [0.05, 6]];
    for (const [scale, level] of cases) expect(zoomLevel(scale), `scale ${scale}`).toBe(level);
  });
  it("characters are sprites at 1-2, simplified at 3, dots from 4 out", () => {
    expect([1, 2, 3, 4, 5, 6].map((l) => lodStyle(l as 1))).toEqual(["sprite", "sprite", "silhouette", "dot", "dot", "dot"]);
  });
  it("held tools are only visible at levels 1 and 2", () => {
    expect([1, 2, 3, 4, 5, 6].map((l) => showsTools(l as 1))).toEqual([true, true, false, false, false, false]);
  });
});
