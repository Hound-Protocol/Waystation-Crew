import { describe, it, expect } from "vitest";
import { zoomLevel, lodStyle } from "./lod";

describe("zoomLevel", () => {
  it("maps pixels-per-tile to six levels with the right boundaries", () => {
    const cases: Array<[number, number]> = [[1, 1], [2, 1], [2.99, 1], [3, 2], [4, 2], [5.99, 2], [6, 3], [8, 3], [11.99, 3], [12, 4], [16, 4], [23.99, 4], [24, 5], [32, 5], [47.99, 5], [48, 6], [64, 6], [200, 6]];
    for (const [scale, level] of cases) expect(zoomLevel(scale), `scale ${scale}`).toBe(level);
  });
  it("picks a render style per level", () => {
    expect([1, 2, 3, 4, 5, 6].map((l) => lodStyle(l as 1))).toEqual(["dot", "column", "silhouette", "sprite", "sprite", "sprite"]);
  });
});
