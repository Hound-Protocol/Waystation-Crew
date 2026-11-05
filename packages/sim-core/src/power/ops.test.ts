import { describe, it, expect } from "vitest";
import { createWorld, step, stepMany, hashWorld, type World } from "../world";
import { seedPopulation } from "../population";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { shiftOf } from "../org/jobs";
import { ActionKind } from "../ai/affordances";
import { commandAuthority, reactorSite, WATCH_TICKS } from "./ops";

const staffed = (seed = 7) => { const w = createWorld(seed); seedPopulation(w, 60); return w; };
const count = (w: World, kind: ActionKind) => { let n = 0; for (let id = 0; id < w.chars.count; id++) if (w.actions[id]?.kind === kind) n++; return n; };

describe("who commands the reactor", () => {
  it("is the on-shift Chief, and a Senior takes over when the Chief is off shift", () => {
    const w = createWorld(1), mk = (rank: Rank) => addCharacter(w, { name: "E", dept: Department.Engineering, rank, x: 100, y: 100 });
    const chief = mk(Rank.Chief), senior = mk(Rank.Senior), tech = mk(Rank.Technician);
    const posts = w.posts.filter((p) => p.dept === Department.Engineering && p.shift === shiftOf(w.tick) && !w.postHolder.has(p.id));
    for (const [i, id] of [chief, senior, tech].entries()) { w.chars.job[id] = posts[i].id; w.postHolder.set(posts[i].id, id); }
    expect(commandAuthority(w)).toBe(chief);
    w.chars.job[chief] = -1; expect(commandAuthority(w)).toBe(senior);
  });
  it("is nobody with no engineers on shift", () => { expect(commandAuthority(createWorld(1))).toBe(-1); });
});

describe("the reactor site", () => {
  it("is a walkable tile beside the reactor prop in Engineering", () => {
    const w = createWorld(7), s = reactorSite(w)!, prop = w.station.deco!.find((d) => d.sprite === "prop:reactor")!;
    expect(s).not.toBeNull(); expect(Math.abs(s.x - prop.x) + Math.abs(s.y - prop.y)).toBe(1);
  });
});

describe("engineers run the reactor", () => {
  it("one engineer is on watch per shift and never two at once", () => {
    const w = staffed(); let max = 0;
    for (let t = 0; t < 1500; t++) { step(w); max = Math.max(max, count(w, ActionKind.Watch)); }
    expect(max).toBe(1); expect(w.power.assign.watch).toBeGreaterThanOrEqual(0);
    expect(w.chars.dept[w.power.assign.watch]).toBe(Department.Engineering);
  });
  it("watch nudges the setpoints toward the healthy band", () => {
    const w = staffed(); w.power.reactor.coolant = 0.95; w.power.reactor.feed = 0.5;
    stepMany(w, 2500);
    expect(w.power.reactor.coolant).toBeLessThan(0.95); expect(w.power.reactor.status).toBe("running");
  });
  it("a scrammed reactor gets restarted and ends running, the steps in order", () => {
    const w = staffed(); const r = w.power.reactor; r.status = "scram"; r.output = 0; r.fieldDraw = 0; r.feed = 0;
    const steps: number[] = []; let ran = false;
    for (let t = 0; t < 3000; t++) { step(w); const st = r.status as string; if (st === "starting") steps.push(r.step); if (st === "running") { ran = true; break; } }
    expect(ran).toBe(true);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
  });
  it("refuel moves fuel from the store into the tank", () => {
    const w = staffed(); w.power.reactor.fuel = 0.2; w.power.fuelStore = 0.8;
    stepMany(w, 2000);
    expect(w.power.reactor.fuel).toBeGreaterThan(0.2); expect(w.power.fuelStore).toBeLessThan(0.8);
  });
  it("service lowers wear", () => {
    const w = staffed(); w.power.reactor.wear = 0.4; stepMany(w, 2500);
    expect(w.power.reactor.wear).toBeLessThan(0.3);
  });
  it("left unattended for 6 sim hours the reactor scrams", () => {
    const w = createWorld(7); let scrammed = false;
    for (let t = 0; t < 21600; t++) { step(w); if (w.power.reactor.status === "scram") { scrammed = true; break; } }
    expect(scrammed).toBe(true);
  });
  it("never has two engineers on the same duty, even when the lead changes mid-task", () => {
    const w = staffed(); const r = w.power.reactor; r.fuel = 0.2; r.wear = 0.4;
    const chief = [...Array(w.chars.count).keys()].find((id) => w.chars.dept[id] === Department.Engineering && w.chars.rank[id] === Rank.Chief);
    for (let t = 0; t < 2500; t++) {
      if (t === 400 && chief !== undefined) w.chars.job[chief] = -1;
      step(w);
      for (const k of [ActionKind.Watch, ActionKind.Refuel, ActionKind.Service, ActionKind.Restart]) expect(count(w, k)).toBeLessThanOrEqual(1);
    }
  });
  it("is deterministic", () => {
    const run = () => { const w = staffed(5); w.power.reactor.fuel = 0.2; stepMany(w, 2500); return hashWorld(w); };
    expect(run()).toBe(run());
    expect(WATCH_TICKS).toBeGreaterThan(0);
  });
});
