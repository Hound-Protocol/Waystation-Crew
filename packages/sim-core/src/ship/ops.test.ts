import { describe, it, expect } from "vitest";
import { createWorld, step, stepMany, type World } from "../world";
import { seedPopulation, arrive } from "../population";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { HUB, interactionPoint } from "../station/starter";
import { findPath } from "../station/nav";
import { CharState } from "../ai/affordances";
import { shipPose } from "./pose";
import { shipPhase, HOUR } from "./timeline";
import { flightSeats } from "./crew";
import { blockedFor, inShip, shipBoardable, shipPoseNow } from "./ops";

const spawnAt = (w: World, dept: Department, x: number, y: number) => addCharacter(w, { name: "T", dept, rank: Rank.Trainee, x, y });
const firstTick = (pred: (t: number) => boolean) => { for (let t = 0; t < 2 * HOUR; t++) if (pred(t)) return t; throw new Error("none"); };

describe("who may enter the ship", () => {
  const w = createWorld(1), seats = flightSeats(w.station)!;
  const cockpit = interactionPoint(w.station.map, w.station.furniture[seats.pilot])!;
  const gateOut = { x: w.station.rooms.find((r) => r.name === "Arrivals")!.x + 1, y: HUB.y };
  const plaza = { x: HUB.x, y: HUB.y + 3 };
  const pathFor = (id: number, from: { x: number; y: number }, to: { x: number; y: number }) => findPath(w.station.map, from, to, blockedFor(w, id, from));
  const flight = spawnAt(w, Department.Flight, plaza.x, plaza.y), service = spawnAt(w, Department.Service, plaza.x, plaza.y);
  it("lets Flight crew in while the ship is docked with the gate fully open, and nobody else", () => {
    w.tick = 400; expect(shipBoardable(w)).toBe(true);
    expect(pathFor(flight, plaza, cockpit)).not.toBeNull();
    expect(pathFor(service, plaza, cockpit)).toBeNull();
  });
  it("lets nobody in once the gate starts closing, or while the ship is away", () => {
    for (const t of [firstTick((x) => shipPhase(x).phase === "gate-closing"), firstTick((x) => shipPhase(x).phase === "flight") + 100, firstTick((x) => shipPhase(x).phase === "landed") + 50]) {
      w.tick = t; expect(shipBoardable(w), `t=${t}`).toBe(false);
      expect(pathFor(flight, plaza, cockpit), `t=${t}`).toBeNull();
    }
  });
  it("does not open for boarding while the gate is still swinging open after docking", () => {
    const arrive = firstTick((x) => x > 2000 && shipPhase(x).phase === "docked");
    w.tick = arrive + 10; expect(shipBoardable(w)).toBe(false);
    w.tick = arrive + 61; expect(shipBoardable(w)).toBe(true);
  });
  it("traps whoever is aboard while the ship is away, but lets them leave when docked", () => {
    expect(inShip(w, cockpit.x, cockpit.y)).toBe(true); expect(inShip(w, gateOut.x, gateOut.y)).toBe(false);
    w.tick = firstTick((x) => shipPhase(x).phase === "flight") + 100;
    expect(findPath(w.station.map, cockpit, plaza, blockedFor(w, flight, cockpit))).toBeNull();
    w.tick = 400;
    expect(findPath(w.station.map, cockpit, plaza, blockedFor(w, flight, cockpit))).not.toBeNull();
    expect(findPath(w.station.map, cockpit, plaza, blockedFor(w, service, cockpit))).not.toBeNull();
  });
});

describe("the ship flies only with pilots", () => {
  it("with a crew on shift it leaves on time, carries the pilots seated, and releases them when it docks again", () => {
    const w = createWorld(1); seedPopulation(w, 60);
    const seats = flightSeats(w.station)!, liftoff = firstTick((t) => shipPhase(t).phase === "flight");
    const seatedAt = (furn: number) => { const id = w.reservations.get(furn); if (id === undefined) return false; const ip = interactionPoint(w.station.map, w.station.furniture[furn])!; return w.chars.state[id] === CharState.Working && w.chars.x[id] === ip.x && w.chars.y[id] === ip.y && w.chars.dept[id] === Department.Flight; };
    stepMany(w, liftoff - 400);                                            // just before the gate starts closing
    expect(seatedAt(seats.pilot) && seatedAt(seats.copilot)).toBe(true);
    stepMany(w, 700);                                                       // in flight
    expect(w.ship.slip).toBe(0); expect(shipPoseNow(w).phase).toBe("flight");
    expect(w.ship.crew.length).toBeGreaterThanOrEqual(2);
    for (const id of w.ship.crew) expect(inShip(w, w.chars.x[id], w.chars.y[id])).toBe(true);
    expect(seatedAt(seats.pilot) && seatedAt(seats.copilot)).toBe(true);   // still in their seats mid-flight
    const docked = firstTick((t) => t > liftoff && shipPhase(t).phase === "docked");
    stepMany(w, docked + 100 - w.tick);
    expect(shipPoseNow(w).phase).toBe("docked"); expect(w.ship.crew.length).toBe(0);
  }, 60000);

  it("with nobody to fly it, it stays docked and the schedule slips", () => {
    const w = createWorld(1);
    for (let i = 0; i < 20; i++) spawnAt(w, Department.Service, HUB.x - 5 + (i % 10), HUB.y + 5);
    const liftoff = firstTick((t) => shipPhase(t).phase === "flight");
    stepMany(w, liftoff + 300);
    expect(shipPoseNow(w).phase).toBe("docked"); expect(shipPoseNow(w).at).toBe("station");
    expect(w.ship.slip).toBeGreaterThan(300); expect(w.ship.holding).toBe(true);
    expect(shipPose(w.tick).phase).not.toBe("docked");                     // the raw schedule would be past the door by now
  }, 60000);

  it("departs once pilots arrive and are seated, and the slip stops growing", () => {
    const w = createWorld(1);
    for (let i = 0; i < 20; i++) spawnAt(w, Department.Service, HUB.x - 5 + (i % 10), HUB.y + 5);
    stepMany(w, 1800);
    expect(w.ship.holding).toBe(true); const before = w.ship.slip;
    for (let i = 0; i < 6; i++) arrive(w, Department.Flight);
    let left = -1; for (let t = 0; t < 1500 && left < 0; t++) { step(w); if (shipPoseNow(w).phase !== "docked") left = w.tick; }
    expect(left).toBeGreaterThan(0);
    expect(w.ship.slip).toBeGreaterThan(before); expect(w.ship.slip).toBeLessThan(before + 1500);
    const frozen = w.ship.slip; stepMany(w, 200); expect(w.ship.slip).toBe(frozen); expect(w.ship.holding).toBe(false);
  }, 60000);
});
