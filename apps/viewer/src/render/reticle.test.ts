import { describe, it, expect } from "vitest";
import { zoneRadius, outlineWidth, footprintHit, footprintEdges, shipLocal, circleHit, pickTarget, overviewActive, type Grid } from "./reticle";

// an L-shaped modular station: a 4x2 bar with a 2x2 block hanging off its left end, notch at the right below the bar
const L: Grid = { w: 6, h: 4, solid: (x, y) => x >= 0 && y >= 0 && x < 6 && y < 4 && ((y < 2 && x < 4) || (y >= 2 && x < 2)) };

describe("reticle zone", () => {
  it("is a circle whose diameter is 20% of the screen height", () => { expect(zoneRadius(800)).toBe(80); expect(zoneRadius(1000)).toBe(100); });
  it("works from the whole-station view inward (levels 1 to 4), not at planet or system scale", () => {
    for (const z of [1, 2, 3, 4] as const) expect(overviewActive(z), `Z${z}`).toBe(true);
    for (const z of [5, 6] as const) expect(overviewActive(z), `Z${z}`).toBe(false);
  });
  it("the outline stays about 2 screen pixels thick at any zoom, within sane limits", () => {
    expect(outlineWidth(48)).toBeCloseTo(0.11, 9);      // close in: the thin default
    expect(outlineWidth(8)).toBeCloseTo(2.2 / 8, 9);
    expect(outlineWidth(5)).toBeCloseTo(0.44, 9);
    expect(outlineWidth(0.1)).toBe(0.5);                // never fatter than half a tile
  });
});

describe("footprintHit (any station shape)", () => {
  it("hits when the circle covers a solid tile and misses in the notch", () => {
    expect(footprintHit(L, { x: 1, y: 1 }, 0.2)).toBe(true);
    expect(footprintHit(L, { x: 5, y: 3 }, 0.5)).toBe(false);          // empty corner, nearest solid tile is 2+ away
  });
  it("counts the circle edge touching a tile", () => {
    expect(footprintHit(L, { x: 2.9, y: 3 }, 0.95)).toBe(true);        // within 0.95 of the block's right edge at x=2
    expect(footprintHit(L, { x: 4.5, y: 3 }, 0.95)).toBe(false);
  });
  it("hits nothing on an empty grid", () => { expect(footprintHit({ w: 3, h: 3, solid: () => false }, { x: 1, y: 1 }, 5)).toBe(false); });
});

describe("footprintEdges (outline of a modular footprint)", () => {
  it("a single 2x1 block is four merged runs", () => {
    const g: Grid = { w: 2, h: 1, solid: () => true };
    const e = footprintEdges(g);
    expect(e).toHaveLength(4);
    expect(e).toContainEqual({ x1: 0, y1: 0, x2: 2, y2: 0 });
    expect(e).toContainEqual({ x1: 0, y1: 1, x2: 2, y2: 1 });
    expect(e).toContainEqual({ x1: 0, y1: 0, x2: 0, y2: 1 });
    expect(e).toContainEqual({ x1: 2, y1: 0, x2: 2, y2: 1 });
  });
  it("an L shape has six sides", () => { expect(footprintEdges(L)).toHaveLength(6); });
  it("a hole inside the footprint is outlined too", () => {
    const ring: Grid = { w: 3, h: 3, solid: (x, y) => x >= 0 && y >= 0 && x < 3 && y < 3 && !(x === 1 && y === 1) };
    expect(footprintEdges(ring)).toHaveLength(8);                        // 4 outer + 4 inner
  });
  it("is empty for an empty grid", () => { expect(footprintEdges({ w: 2, h: 2, solid: () => false })).toEqual([]); });
});

describe("shipLocal", () => {
  it("maps a world point into the deck's own tile coordinates (centre pivot, clockwise rotation)", () => {
    const body = { x: 100, y: 50, rot: 0 };
    expect(shipLocal({ x: 101, y: 50 }, body, 20, 10)).toEqual({ x: 11, y: 5 });
    const q = shipLocal({ x: 100, y: 51 }, { x: 100, y: 50, rot: Math.PI / 2 }, 20, 10);   // body turned 90 degrees clockwise: world +y is deck +x
    expect(q.x).toBeCloseTo(11, 9); expect(q.y).toBeCloseTo(5, 9);
  });
});

describe("circleHit and pickTarget", () => {
  it("a body circle is hit when the zone overlaps it", () => {
    expect(circleHit({ x: 0, y: 0 }, 10, { x: 14, y: 0 }, 5)).toBe(true);
    expect(circleHit({ x: 0, y: 0 }, 10, { x: 16, y: 0 }, 5)).toBe(false);
  });
  it("picks the first hit in priority order, or nothing", () => {
    const t = (id: string, hit: boolean) => ({ id, hit: () => hit });
    expect(pickTarget({ x: 0, y: 0 }, 1, [t("ship", true), t("station", true)])?.id).toBe("ship");
    expect(pickTarget({ x: 0, y: 0 }, 1, [t("ship", false), t("station", true)])?.id).toBe("station");
    expect(pickTarget({ x: 0, y: 0 }, 1, [t("ship", false)])).toBeNull();
  });
});
