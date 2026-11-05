import { describe, it, expect } from "vitest";
import { createTilemap, TileKind } from "../station/tilemap";
import type { Station } from "../station/starter";
import { buildCoverage, addLamp, isMountSpot } from "./coverage";
import { surveyOrders, MIN_GAIN, MAX_ORDERS } from "./survey";

function room(): Station {
  const map = createTilemap(16, 10);
  for (let y = 1; y <= 7; y++) for (let x = 0; x <= 13; x++) map.set(x, y, y === 1 || y === 7 || x === 0 || x === 13 ? TileKind.Wall : TileKind.Floor);
  return { map, rooms: [], furniture: [], deco: [] };
}
const survey = (st: Station, over: Partial<Parameters<typeof surveyOrders>[2]> = {}) => surveyOrders(st, buildCoverage(st), { max: MAX_ORDERS, skip: () => false, taken: new Set(), ...over });

describe("surveyOrders", () => {
  it("finds the gaps in an unlit room and proposes wall spots that really light them", () => {
    expect([MIN_GAIN, MAX_ORDERS]).toEqual([8, 6]);
    const st = room(), orders = survey(st);
    expect(orders.length).toBeGreaterThanOrEqual(2); expect(orders.length).toBeLessThanOrEqual(MAX_ORDERS);
    const seen = new Set<string>();
    for (const o of orders) { expect(isMountSpot(st.map, o.x, o.y)).toBe(true); expect(o.gain).toBeGreaterThanOrEqual(MIN_GAIN); expect(seen.has(`${o.x},${o.y}`)).toBe(false); seen.add(`${o.x},${o.y}`); }
    for (let i = 1; i < orders.length; i++) expect(orders[i].gain).toBeLessThanOrEqual(orders[i - 1].gain + 0);   // best first
  });
  it("is satisfied once those lamps exist: the next survey finds nothing worth building", () => {
    const st = room();
    for (const o of survey(st)) st.deco!.push({ x: o.x, y: o.y, sprite: "wall:light", layer: "wall" });
    expect(survey(st)).toEqual([]);
  });
  it("does not order where a lamp already lights the tiles, and discounts overlap between its own picks", () => {
    const st = room(); st.deco = [{ x: 3, y: 1, sprite: "wall:light", layer: "wall" }];
    const orders = survey(st);
    for (const o of orders) expect(Math.abs(o.x - 3)).toBeGreaterThan(2);
    const cov = buildCoverage(st); for (const o of orders) addLamp(cov, st, o.x, o.y);
    let dark = 0; for (let y = 2; y <= 6; y++) for (let x = 1; x <= 12; x++) if (cov[y * 16 + x] === 0) dark++;
    expect(dark).toBeLessThan(MIN_GAIN);
  });
  it("skips spots already ordered or struck off, and tiles the caller excludes", () => {
    const st = room(), first = survey(st)[0];
    expect(survey(st, { taken: new Set([first.y * 16 + first.x]) }).every((o) => o.x !== first.x || o.y !== first.y)).toBe(true);
    expect(survey(st, { skip: () => true })).toEqual([]);
  });
  it("respects the order cap", () => { expect(survey(room(), { max: 1 })).toHaveLength(1); expect(survey(room(), { max: 0 })).toEqual([]); });
  it("ignores a mount spot that already carries another fitting", () => {
    const st = room(); st.deco = [{ x: 3, y: 1, sprite: "wall:screen-map", layer: "wall" }];
    expect(survey(st).every((o) => !(o.x === 3 && o.y === 1))).toBe(true);
  });
});
