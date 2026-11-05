import { HUB } from "./starter";
import { describe, it, expect } from "vitest";
import { createWorld, step, stepMany } from "../world";
import { seedPopulation } from "../population";
import { buildStarterStation, growStation, STARTER_CREW } from "./layout";
import { createRng } from "../rng";
import { findPath } from "./nav";
import { interactionPoint } from "./starter";
import { TileKind } from "./tilemap";
import { GROWTH_INTERVAL } from "./growth";

const beds = (st: ReturnType<typeof buildStarterStation>) => st.furniture.filter((f) => f.kind === TileKind.Bed).length;

describe("modular growth", () => {
  it("the same seed builds the same station", () => {
    const a = buildStarterStation(3), b = buildStarterStation(3);
    expect(a.rooms.map((r) => `${r.name}${r.x},${r.y},${r.w}x${r.h}`)).toEqual(b.rooms.map((r) => `${r.name}${r.x},${r.y},${r.w}x${r.h}`));
    expect(Array.from(a.map.tiles)).toEqual(Array.from(b.map.tiles));
  });
  it("different seeds build different stations", () => {
    expect(buildStarterStation(1).rooms.map((r) => `${r.x},${r.y}`).join()).not.toBe(buildStarterStation(2).rooms.map((r) => `${r.x},${r.y}`).join());
  });
  it("the starter station has capacity for 100 crew and needs nothing more at that size", () => {
    const st = buildStarterStation(1);
    expect(beds(st)).toBeGreaterThanOrEqual(Math.ceil(STARTER_CREW * 1.1));
    expect(growStation(st, STARTER_CREW, createRng(5))).toBeNull();
  });
  it("more crew triggers more beds and more department rooms, staying connected and inside the map", () => {
    const st = buildStarterStation(1), before = { beds: beds(st), rooms: st.rooms.length };
    const rng = createRng(11);
    for (let i = 0; i < 40; i++) growStation(st, 300, rng);
    st.furniture.forEach((f, i) => { expect(f.id).toBe(i); });
    expect(beds(st)).toBeGreaterThanOrEqual(Math.ceil(300 * 1.1) - 20);
    expect(st.rooms.length).toBeGreaterThan(before.rooms + 15);
    const start = { x: HUB.x, y: HUB.y + 3 };                                  // the plaza
    for (const f of st.furniture) { const ip = interactionPoint(st.map, f); expect(ip, `${f.style}@${f.x},${f.y}`).not.toBeNull(); expect(findPath(st.map, start, ip!), `${f.style}@${f.x},${f.y}`).not.toBeNull(); }
    for (const r of st.rooms) expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= st.map.w && r.y + r.h <= st.map.h).toBe(true);
  });
  it("rooms never overlap", () => {
    const st = buildStarterStation(2), rng = createRng(4);
    for (let i = 0; i < 25; i++) growStation(st, 250, rng);
    const owner = new Map<string, number>();
    for (const f of st.furniture) { const k = `${f.x},${f.y}`; expect(owner.has(k), `furniture overlap at ${k}`).toBe(false); owner.set(k, f.roomId); }
  });
  it("the running sim grows the station when the crew outgrows it, and keeps its indexes valid", () => {
    const w = createWorld(7);
    seedPopulation(w, 100);
    for (let i = 0; i < 8; i++) seedPopulation(w, 12);                                  // crew grows to ~196
    const rooms = w.station.rooms.length, posts = w.posts.length;
    w.tick = GROWTH_INTERVAL - 1;
    step(w);                                                                             // the growth check runs on the hour
    expect(w.station.rooms.length).toBe(rooms + 1);
    expect(w.stationRev).toBe(1);
    expect(w.posts.length).toBeGreaterThanOrEqual(posts);
    const ids = w.posts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [kind, list] of w.furnitureByKind) for (const id of list) expect(w.station.furniture[id].kind).toBe(kind);
    let total = 0; for (const list of w.furnitureByKind.values()) total += list.length;
    expect(total).toBe(w.station.furniture.length);
    stepMany(w, 60);
  });
});
