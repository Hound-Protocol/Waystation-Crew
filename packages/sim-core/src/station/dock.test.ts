import { describe, it, expect } from "vitest";
import { buildStarterStation, HUB } from "./starter";
import { TileKind } from "./tilemap";
import { findPath } from "./nav";
import { interactionPoint } from "./starter";
import { PAD } from "./pad";

describe("dock: the berth at the Arrivals hall, with the cargo ship as its own chunk", () => {
  const st = buildStarterStation(1);
  const arrivals = st.rooms.find((r) => r.name === "Arrivals")!;
  const ship = st.ship!;
  it("keeps the ship's interior in the station's sim-space at the berth, and hands the viewer an exact copy as its own chunk", () => {
    const room = st.rooms.find((r) => r.name === "Cargo Ship")!, b = ship.berth;
    expect(room).toBeTruthy();
    expect([b.x, b.y, b.w, b.h]).toEqual([room.x, room.y, room.w, room.h]);
    expect(b.x + b.w).toBe(arrivals.x);
    expect(b.y + (b.h - 1) / 2).toBe(HUB.y);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) expect(ship.map.get(x, y), `${x},${y}`).toBe(st.map.get(b.x + x, b.y + y));
    const inside = (d: { x: number; y: number }) => d.x >= b.x && d.x < b.x + b.w && d.y >= b.y && d.y < b.y + b.h;
    expect(ship.deco!.length).toBe(st.deco!.filter(inside).length);
    expect(ship.furniture.length).toBe(st.furniture.filter(inside).length);
    for (const f of ship.furniture) expect(st.furniture.some((g) => g.x === b.x + f.x && g.y === b.y + f.y && g.kind === f.kind)).toBe(true);
  });
  it("matches the pad: same berth size, same gate position relative to it", () => {
    expect([ship.berth.w, ship.berth.h]).toEqual([PAD.berth.w, PAD.berth.h]);
    expect(PAD.gate.y - PAD.berth.y).toBe(7);
    const rows: number[] = []; for (let y = 0; y < st.map.h; y++) if (st.map.get(arrivals.x, y) === TileKind.Airlock) rows.push(y);
    expect(rows).toEqual(Array.from({ length: 9 }, (_, i) => ship.berth.y + 7 + i));
  });
  it("has one gateway column: the Arrivals airlocks facing the berth, 9 tall, reachable from the plaza", () => {
    const gateY = ship.berth.y + 11;
    expect(findPath(st.map, { x: HUB.x, y: HUB.y + 3 }, { x: arrivals.x, y: gateY })).not.toBeNull();
  });
  it("the ship chunk is the whole deck at its local origin: one room, the stern airlock column on its east edge", () => {
    expect(ship.rooms.map((r) => r.name)).toEqual(["Cargo Ship"]);
    const r = ship.rooms[0];
    expect([r.x, r.y, r.w, r.h]).toEqual([0, 0, 36, 23]);
    expect([ship.map.w, ship.map.h]).toEqual([36, 23]);
    const stern: number[] = []; for (let y = 0; y < ship.map.h; y++) if (ship.map.get(35, y) === TileKind.Airlock) stern.push(y);
    expect(stern).toEqual(Array.from({ length: 9 }, (_, i) => 7 + i));
  });
  it("its cockpit has three consoles the plaza connects to through the ship", () => {
    const cockpit = st.furniture.filter((f) => f.kind === TileKind.Console && st.rooms[f.roomId].name === "Cargo Ship");
    expect(cockpit.length).toBe(3);
    expect(ship.furniture.filter((f) => f.kind === TileKind.Console).length).toBe(3);
    for (const f of cockpit) { const ip = interactionPoint(st.map, f)!; expect(ip).toBeTruthy(); expect(findPath(st.map, { x: HUB.x, y: HUB.y + 3 }, ip), `console@${f.x},${f.y}`).not.toBeNull(); }
  });
  it("has a seat line, side doors, a slotted hazard-framed hold and instruments", () => {
    const decoIn = (sprite: string) => ship.deco!.filter((d) => d.sprite === sprite).length;
    expect(decoIn("prop:jumpseat") + decoIn("prop:jumpseat-n")).toBe(36);
    expect(decoIn("prop:jumpseat")).toBe(18);
    expect(decoIn("prop:jumpseat-n")).toBe(18);
    expect(decoIn("floor:slot")).toBe(12);
    expect(decoIn("floor:slot-tl")).toBe(8);
    expect(decoIn("floor:slot-ml")).toBe(8);
    expect(decoIn("floor:hazard")).toBeGreaterThanOrEqual(60);
    expect(decoIn("prop:instruments")).toBeGreaterThanOrEqual(4);
    expect(decoIn("wall:canopy")).toBe(7);
    expect(decoIn("wall:viewport")).toBeGreaterThanOrEqual(4);
    expect(decoIn("wall:porthole")).toBeGreaterThanOrEqual(10);
    let sideDoors = 0;
    for (let x = 0; x < ship.map.w; x++) for (const y of [0, ship.map.h - 1]) if (ship.map.get(x, y) === TileKind.Airlock) sideDoors++;
    expect(sideDoors).toBe(4);
  });
  it("is deterministic: the same seed gives the same ship", () => {
    const again = buildStarterStation(1).ship!;
    expect(Array.from(again.map.tiles)).toEqual(Array.from(ship.map.tiles)); expect(again.deco).toEqual(ship.deco);
  });
});
