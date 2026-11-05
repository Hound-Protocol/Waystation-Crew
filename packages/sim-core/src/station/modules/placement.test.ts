import { describe, it, expect } from "vitest";
import { createWorld, stepMany } from "../../world";
import { seedPopulation } from "../../population";
import { ActionKind } from "../../ai/affordances";
import { jobOf } from "../../org/jobs";

describe("crew placement", () => {
  it("characters arrive in the Arrivals module and workers end up in their own department module", () => {
    const w = createWorld(7);
    seedPopulation(w, 40);
    const arrivals = w.station.rooms.find((r) => r.name === "Arrivals")!;
    const inRoom = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    for (let id = 0; id < w.chars.count; id++) expect(inRoom(arrivals, Math.round(w.chars.x[id]), Math.round(w.chars.y[id])), `char ${id} spawns in Arrivals`).toBe(true);
    stepMany(w, 600);
    let working = 0, inOwn = 0;
    for (let id = 0; id < w.chars.count; id++) {
      const a = w.actions[id], job = jobOf(w, id);
      if (!a || a.kind !== ActionKind.Work || !job) continue;
      const f = w.station.furniture[job.workstationFurnitureId];
      working++;
      if (inRoom(w.station.rooms[f.roomId], Math.round(w.chars.x[id]), Math.round(w.chars.y[id]))) inOwn++;
    }
    expect(working).toBeGreaterThan(5);
    expect(inOwn).toBe(working);
  });
});
