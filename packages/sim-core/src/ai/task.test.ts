import { describe, it, expect } from "vitest";
import { createWorld, step } from "../world";
import { seedPopulation } from "../population";
import { ActionKind } from "./affordances";
import { taskOf, NO_TASK } from "./task";

describe("taskOf", () => {
  it("is empty for idling and wandering", () => {
    const w = createWorld(3); seedPopulation(w, 10);
    w.actions[0] = { kind: ActionKind.Wander, furnitureId: -1, path: [{ x: 1, y: 1 }], ticksLeft: 0 };
    expect(taskOf(w, 0)).toEqual(NO_TASK);
    w.actions[0] = null; expect(taskOf(w, 0)).toEqual(NO_TASK);
  });
  it("names the task while walking to it, with no start yet", () => {
    const w = createWorld(3); seedPopulation(w, 10);
    w.actions[0] = { kind: ActionKind.Eat, furnitureId: 1, path: [{ x: 1, y: 1 }], ticksLeft: 600 };
    expect(taskOf(w, 0)).toEqual({ kind: ActionKind.Eat, began: -1, total: 0 });
  });
  it("records when each task actually begins and how long it will take", () => {
    const w = createWorld(7); seedPopulation(w, 60);
    const seen = new Set<number>();
    for (let t = 0; t < 4000; t++) {
      step(w);
      for (let id = 0; id < w.chars.count; id++) {
        const a = w.actions[id], k = taskOf(w, id);
        if (!a || k.kind === 0 || a.path.length > 0) continue;
        expect(k.began).toBeGreaterThanOrEqual(0); expect(k.began).toBeLessThanOrEqual(w.tick); expect(k.total).toBeGreaterThan(0);
        expect(k.began + k.total).toBeGreaterThanOrEqual(w.tick - 1);      // the task has not run past its own length
        seen.add(k.kind);
      }
    }
    expect(seen.has(ActionKind.Work)).toBe(true);
  });
});
