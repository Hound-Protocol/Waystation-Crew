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
  it("keeps the ship out of the station map: no ship room, and the berth west of Arrivals is empty space", () => {
    expect(st.rooms.some((r) => r.name === "Cargo Ship")).toBe(false);
    expect(ship).toBeTruthy();
    const b = ship.berth;
    expect(b.x + b.w).toBe(arrivals.x);
    expect(b.y + (b.h - 1) / 2).toBe(HUB.y);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) expect(st.map.get(x, y), `${x},${y}`).toBe(TileKind.Void);
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
  it("its cockpit has three consoles a crew member can reach from the ramp", () => {
    const cockpit = ship.furniture.filter((f) => f.kind === TileKind.Console);
    expect(cockpit.length).toBe(3);
    for (const f of cockpit) { const ip = interactionPoint(ship.map, f)!; expect(ip).toBeTruthy(); expect(findPath(ship.map, { x: 34, y: 11 }, ip), `console@${f.x},${f.y}`).not.toBeNull(); }
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
