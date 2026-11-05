import { describe, it, expect } from "vitest";
import { createWorld, step, hashWorld, type World } from "../world";
import { seedPopulation } from "../population";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { shiftOf } from "../org/jobs";
import { ActionKind } from "../ai/affordances";
import { buildCoverage, lampsOf, isMountSpot, needsLight } from "./coverage";
import { engineeringLead, SURVEY_INTERVAL, BUILD_TICKS } from "./ops";

const dark = (w: World) => { const cov = buildCoverage(w.station), m = w.station.map; let n = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (needsLight(m.get(x, y)) && cov[y * m.w + x] === 0) n++; return n; };

describe("the Engineering lead", () => {
  it("is nobody when no engineer is on shift", () => { expect(engineeringLead(createWorld(1))).toBe(-1); });
  it("is the highest-ranked Engineering character on shift, the lowest id on a tie", () => {
    const w = createWorld(1), mk = (rank: Rank) => addCharacter(w, { name: "E", dept: Department.Engineering, rank, x: 100, y: 100 });
    const a = mk(Rank.Technician), b = mk(Rank.Chief), c = mk(Rank.Chief);
    // put them on the current shift by giving each an open Engineering post of this shift
    const posts = w.posts.filter((p) => p.dept === Department.Engineering && p.shift === shiftOf(w.tick) && !w.postHolder.has(p.id));
    for (const [i, id] of [a, b, c].entries()) { w.chars.job[id] = posts[i].id; w.postHolder.set(posts[i].id, id); }
    expect(engineeringLead(w)).toBe(b);
    w.chars.job[b] = -1; expect(engineeringLead(w)).toBe(c);
  });
});

describe("engineers fix the gaps", () => {
  it("builds lamps over a shift, only engineers build, every lamp is on a real mount spot, and the coverage cache matches a rebuild", () => {
    const w = createWorld(7); seedPopulation(w, 60);
    const before = lampsOf(w.station).length, darkBefore = dark(w), rev = w.stationRev, builders = new Set<number>();
    for (let t = 0; t < 4 * SURVEY_INTERVAL; t++) {
      step(w);
      for (let id = 0; id < w.chars.count; id++) if (w.actions[id]?.kind === ActionKind.Build) builders.add(id);
    }
    const lamps = lampsOf(w.station);
    expect(lamps.length).toBeGreaterThan(before);
    expect(w.stationRev).toBeGreaterThan(rev);                                // the viewer is told, so it rebakes and fades the lamp in
    expect(dark(w)).toBeLessThan(darkBefore);
    for (const l of lamps.slice(before)) { expect(isMountSpot(w.station.map, l.x, l.y) || w.station.map.get(l.x, l.y) !== 0).toBe(true); }
    expect(builders.size).toBeGreaterThan(0);
    for (const id of builders) expect(w.chars.dept[id]).toBe(Department.Engineering);
    expect(w.light.cover).toEqual(buildCoverage(w.station));
    expect(BUILD_TICKS).toBe(240);
  });
  it("does nothing with no engineers on shift, and is deterministic with them", () => {
    const empty = createWorld(3); for (let t = 0; t < 2 * SURVEY_INTERVAL; t++) step(empty);
    expect(lampsOf(empty.station).length).toBe(lampsOf(createWorld(3).station).length); expect(empty.light.orders).toEqual([]);
    const run = () => { const w = createWorld(5); seedPopulation(w, 40); for (let t = 0; t < 3 * SURVEY_INTERVAL; t++) step(w); return hashWorld(w); };
    expect(run()).toBe(run());
  });
});
