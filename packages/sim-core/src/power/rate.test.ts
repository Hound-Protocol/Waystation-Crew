import { describe, it, expect } from "vitest";
import { createWorld, type World } from "../world";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { ActionKind, AFFORDANCES } from "../ai/affordances";
import { stepActions } from "../ai/decide";
import { machineRate } from "./grid";

const worker = (w: World, kind: ActionKind, ticks: number) => {
  const id = addCharacter(w, { name: "W", dept: Department.Supply, rank: Rank.Technician, x: 100, y: 100 });
  w.actions[id] = { kind, furnitureId: -1, path: [], ticksLeft: ticks }; return id;
};
const ticksToFinish = (w: World, id: number, cap = 5000) => { let t = 0; while (w.actions[id] && t < cap) { stepActions(w); t++; } return w.actions[id] ? Infinity : t; };

describe("machine rate", () => {
  it("is 1 when fully supplied, follows supply in a brownout, floors at a quarter, and is 0 in a blackout", () => {
    const w = createWorld(1);
    for (const [lvl, rate] of [[1, 1], [0.5, 0.5], [0.1, 0.25], [0, 0]] as const) { w.power.supplyLevel = lvl; expect(machineRate(w)).toBe(rate); }
  });
  it("a Work task takes 1/supplyLevel as long, capped at 4x", () => {
    const w = createWorld(1); const id = worker(w, ActionKind.Work, 100);
    expect(ticksToFinish(w, id)).toBe(100);
    w.power.supplyLevel = 0.5; const b = worker(w, ActionKind.Work, 100); expect(ticksToFinish(w, b)).toBe(200);
    w.power.supplyLevel = 0.1; const c = worker(w, ActionKind.Work, 100); expect(ticksToFinish(w, c)).toBe(400);
  });
  it("a Work task makes no progress during a scram", () => {
    const w = createWorld(1); w.power.supplyLevel = 0; const id = worker(w, ActionKind.Work, 100);
    for (let i = 0; i < 1000; i++) stepActions(w);
    expect(w.actions[id]!.ticksLeft).toBe(100);
  });
  it("Sleep is unaffected by power", () => {
    const w = createWorld(1); w.power.supplyLevel = 0; const id = worker(w, ActionKind.Sleep, 28800); w.chars.energy[id] = 0.2;
    const aff = AFFORDANCES.find((a) => a.kind === ActionKind.Sleep)!;
    for (let i = 0; i < 10; i++) stepActions(w);
    expect(w.chars.energy[id]).toBeCloseTo(0.2 + 10 * aff.amountPerTick, 6);
  });
  it("reactor duties are not slowed: engineers can recover a blackout", () => {
    const w = createWorld(1); w.power.supplyLevel = 0; const id = worker(w, ActionKind.Restart, 15);
    expect(ticksToFinish(w, id)).toBe(15);
  });
});
