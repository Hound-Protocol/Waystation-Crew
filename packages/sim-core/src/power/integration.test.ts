import { describe, it, expect } from "vitest";
import { createWorld, step, stepMany, hashWorld, type World } from "../world";
import { seedPopulation } from "../population";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { reactorSite } from "./ops";

const DAY = 86400;
/** seedPopulation only fills the day shift's engineering posts; this staffs `perShift` posts on every shift. */
function staffEngineering(w: World, perShift = 6, rank = Rank.Technician) {
  const at = reactorSite(w)!; let k = 0;
  for (const shift of ["day", "swing", "night"] as const) {
    const free = w.posts.filter((p) => p.dept === Department.Engineering && p.shift === shift && !w.postHolder.has(p.id)).slice(0, perShift);
    for (const post of free) { const id = addCharacter(w, { name: "Eng", dept: Department.Engineering, rank, x: at.x, y: at.y }); w.chars.job[id] = post.id; w.postHolder.set(post.id, id);
      const spread = (m: number) => 0.55 + 0.45 * ((k * m) % 1); k++;                       // desynchronise needs, as a crew that arrived over time would be
      w.chars.energy[id] = spread(0.618); w.chars.hunger[id] = spread(0.382); w.chars.fun[id] = spread(0.271);
    }
  }
}
const staffed = (seed = 7) => { const w = createWorld(seed); seedPopulation(w, 60); staffEngineering(w); return w; };
/** Takes every engineer off the roster: they keep existing but hold no engineering post. */
function removeEngineers(w: World) {
  for (let id = 0; id < w.chars.count; id++) if (w.chars.dept[id] === Department.Engineering) {
    const post = w.chars.job[id]; if (post >= 0) w.postHolder.delete(post);
    w.chars.job[id] = -1; w.chars.dept[id] = Department.Service;
  }
}

describe("the power plant over days", () => {
  it("stays Running and never runs dry over 3 sim days with engineers on shift and ships delivering", () => {
    const w = staffed(); let minFuel = 1, scrams = 0, blackout = 0;
    for (let t = 0; t < 3 * DAY; t++) { step(w); if (t % 30) continue; minFuel = Math.min(minFuel, w.power.reactor.fuel + w.power.fuelStore); if (w.power.reactor.status === "scram") scrams++; if (w.power.lifeSupportDown) blackout++; }
    expect(w.power.reactor.status).toBe("running"); expect(minFuel).toBeGreaterThan(0); expect(scrams).toBe(0); expect(blackout).toBe(0);
  }, 300000);

  it("with engineers removed it scrams, the battery drains and doors lock; a new engineer recovers everything", () => {
    const w = staffed(); stepMany(w, 600); removeEngineers(w);
    let scrammed = false, locked = false;
    for (let t = 0; t < 2 * DAY && !(scrammed && locked); t++) { step(w); if (w.power.reactor.status === "scram") scrammed = true; if (!w.power.doorsPowered) locked = true; }
    expect(scrammed).toBe(true); expect(w.power.battery).toBeLessThan(1); expect(locked).toBe(true);
    staffEngineering(w);
    let ok = false;
    for (let t = 0; t < DAY && !ok; t++) { step(w); ok = w.power.reactor.status === "running" && w.power.doorsPowered && !w.power.lifeSupportDown; }
    expect(ok).toBe(true);
  }, 300000);

  it("is deterministic: two runs give the same world hash", () => {
    const a = staffed(3), b = staffed(3); stepMany(a, DAY); stepMany(b, DAY);
    expect(hashWorld(a)).toBe(hashWorld(b));
  }, 300000);
});
