import { describe, it, expect } from "vitest";
import { createWorld } from "../world";
import { seedPopulation } from "../population";
import { addCharacter } from "../ecs";
import { assignJobs, jobOf } from "../org/jobs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { buildStarterStation, HUB } from "../station/starter";
import { flightSeats, postRole } from "./crew";
import { TileKind } from "../station/tilemap";

const spawn = (w: ReturnType<typeof createWorld>, dept: Department, i: number) => addCharacter(w, { name: `F${i}`, dept, rank: Rank.Trainee, x: HUB.x - 5 + (i % 10), y: HUB.y + 5 });

describe("flight seats", () => {
  const st = buildStarterStation(1), seats = flightSeats(st)!;
  it("are the three cockpit consoles: pilot in the middle, co-pilot and engineer either side", () => {
    expect(seats).toBeTruthy();
    const ids = [seats.copilot, seats.pilot, seats.engineer], ys = ids.map((id) => st.furniture[id].y);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) { expect(st.furniture[id].kind).toBe(TileKind.Console); expect(st.rooms[st.furniture[id].roomId].name).toBe("Cargo Ship"); }
    expect(ys[0]).toBeLessThan(ys[1]); expect(ys[1]).toBeLessThan(ys[2]);
  });
});

describe("flight crew staffing", () => {
  it("only Flight-department crew ever hold Flight posts, even when other posts run out", () => {
    const w = createWorld(1);
    for (let i = 0; i < 200; i++) spawn(w, Department.Medical, i);
    assignJobs(w);
    for (let i = 0; i < 200; i++) { const p = jobOf(w, i); if (p) expect(p.dept === Department.Flight, `char ${i}`).toBe(false); }
  });
  it("spreads Flight crew over the shifts: pilot and co-pilot of every shift are filled before any engineer", () => {
    const w = createWorld(1), seats = flightSeats(w.station)!;
    for (let i = 0; i < 6; i++) spawn(w, Department.Flight, i);
    assignJobs(w);
    const got = new Set<string>();
    for (let i = 0; i < 6; i++) { const p = jobOf(w, i)!; expect(p.dept).toBe(Department.Flight); got.add(`${p.shift}:${postRole(seats, p)}`); }
    expect([...got].sort()).toEqual(["day:copilot", "day:pilot", "night:copilot", "night:pilot", "swing:copilot", "swing:pilot"]);
  });
  it("a seeded station has two pilots on every shift, whatever the seed", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = createWorld(seed); seedPopulation(w, 60);
      const seats = flightSeats(w.station)!, filled = new Set<string>();
      for (let i = 0; i < w.chars.count; i++) { const p = jobOf(w, i); if (p && p.dept === Department.Flight && w.chars.dept[i] === Department.Flight) { const r = postRole(seats, p); if (r !== "engineer") filled.add(`${p.shift}:${r}`); } }
      expect(filled.size, `seed ${seed}`).toBe(6);
    }
  });
});
