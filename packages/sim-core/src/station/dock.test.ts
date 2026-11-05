import { describe, it, expect } from "vitest";
import { buildStarterStation, HUB } from "./starter";
import { TileKind } from "./tilemap";
import { findPath } from "./nav";
import { interactionPoint } from "./starter";
import { postsFor } from "../org/jobs";
import { Department } from "../org/departments";

describe("dock: the cargo ship is parked at the Arrivals hall", () => {
  const st = buildStarterStation(1);
  const ship = st.rooms.find((r) => r.name === "Cargo Ship")!;
  const arrivals = st.rooms.find((r) => r.name === "Arrivals")!;
  it("exists, is about a quarter of the station, and sits on the planet side (west) of Arrivals, nose out", () => {
    expect(ship).toBeTruthy();
    expect(ship.w).toBeGreaterThanOrEqual(34); expect(ship.h).toBeGreaterThanOrEqual(21);   // 34 long x 21 wide, lying east-west
    expect(ship.x + ship.w).toBeLessThanOrEqual(arrivals.x + 1);
    expect(ship.x).toBeGreaterThan(2);
  });
  it("its stern airlocks touch the Arrivals airlocks, so the ramp is walkable from the station", () => {
    let touching = 0;
    for (let y = 0; y < st.map.h; y++) for (let x = 0; x < st.map.w - 1; x++)
      if ([TileKind.Airlock, TileKind.Door].includes(st.map.get(x, y)) && st.map.get(x + 1, y) === TileKind.Airlock && x + 1 === arrivals.x) touching++;
    expect(touching).toBeGreaterThanOrEqual(6);
  });
  it("the plaza connects to the cockpit consoles through the ship", () => {
    const cockpit = st.furniture.filter((f) => f.kind === TileKind.Console && st.rooms[f.roomId].name === "Cargo Ship");
    expect(cockpit.length).toBe(3);
    for (const f of cockpit) { const ip = interactionPoint(st.map, f)!; expect(ip).toBeTruthy(); expect(findPath(st.map, { x: HUB.x, y: HUB.y + 3 }, ip), `console@${f.x},${f.y}`).not.toBeNull(); }
  });
  it("the cockpit offers Flight-department posts for the pilot", () => {
    const flight = postsFor(st, st.furniture.keys()).filter((p) => p.dept === Department.Flight);
    expect(flight.length).toBeGreaterThanOrEqual(3);
  });
  it("has a seat line, side doors, a slotted hazard-framed hold and instruments", () => {
    const decoIn = (sprite: string) => st.deco!.filter((d) => d.sprite === sprite && d.x >= ship.x && d.x < ship.x + ship.w && d.y >= ship.y && d.y < ship.y + ship.h).length;
    expect(decoIn("prop:jumpseat") + decoIn("prop:jumpseat-n")).toBe(36);
    expect(decoIn("prop:jumpseat")).toBe(18);                   // the far hull faces back the other way
    expect(decoIn("prop:jumpseat-n")).toBe(18);
    expect(decoIn("prop:thruster")).toBe(4);
    expect(decoIn("wall:nozzle")).toBe(4);
    expect(decoIn("floor:slot")).toBe(12);
    expect(decoIn("floor:slot-tl")).toBe(8);
    expect(decoIn("floor:slot-ml")).toBe(8);
    expect(decoIn("floor:hazard")).toBeGreaterThanOrEqual(60);
    expect(decoIn("prop:instruments")).toBeGreaterThanOrEqual(4);
    expect(decoIn("wall:canopy")).toBe(7);                      // windows: canopy across the nose, viewports, portholes
    expect(decoIn("wall:viewport")).toBeGreaterThanOrEqual(4);
    expect(decoIn("wall:porthole")).toBeGreaterThanOrEqual(10);
    let sideDoors = 0;
    for (let x = ship.x; x < ship.x + ship.w; x++) for (const y of [ship.y, ship.y + ship.h - 1]) if (st.map.get(x, y) === TileKind.Airlock) sideDoors++;
    expect(sideDoors).toBe(4);                                  // two doors on each side, two cells each
  });
});
