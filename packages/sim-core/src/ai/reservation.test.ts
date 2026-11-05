import { describe, it, expect } from "vitest";
import { createWorld, step } from "../world";
import { seedPopulation } from "../population";
import { shiftOf } from "../org/jobs";

/** Every workstation, bed or seat is used by one character at a time, across a whole ship cycle and a shift change. */
describe("reservations", () => {
  it("no furniture is ever held by two characters, and every action holds its own reservation", () => {
    const w = createWorld(7); seedPopulation(w, 60);
    const bad: string[] = [];
    for (let t = 0; t < 7000 && bad.length < 5; t++) {
      step(w);
      const seen = new Map<number, number>();
      for (let id = 0; id < w.chars.count; id++) {
        const a = w.actions[id];
        if (!a || a.furnitureId < 0) continue;
        if (seen.has(a.furnitureId)) bad.push(`t=${t} furniture ${a.furnitureId} used by ${seen.get(a.furnitureId)} and ${id}`);
        seen.set(a.furnitureId, id);
        if (w.reservations.get(a.furnitureId) !== id) bad.push(`t=${t} char ${id} acts on furniture ${a.furnitureId} held by ${w.reservations.get(a.furnitureId)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("only the character on shift is seated at a post's workstation", () => {
    const w = createWorld(7); seedPopulation(w, 60);
    const wrong: string[] = [];
    for (let t = 0; t < 4000; t++) {
      step(w);
      for (let id = 0; id < w.chars.count; id++) {
        const a = w.actions[id], post = w.chars.job[id] >= 0 ? w.posts[w.chars.job[id]] : null;
        if (a && post && a.furnitureId === post.workstationFurnitureId && a.kind === 5 && post.shift !== shiftOf(w.tick) && a.ticksLeft > 70) wrong.push(`t=${t} char ${id} works a ${post.shift} post on ${shiftOf(w.tick)} shift`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
