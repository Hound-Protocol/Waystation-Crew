import { describe, it, expect } from "vitest";
import { CrewTally } from "./crewtally";

const chars = [{ id: 0, dept: 1, state: 5 }, { id: 1, dept: 1, state: 2 }, { id: 2, dept: 6, state: 3 }, { id: 3, dept: 0, state: 0 }];
describe("CrewTally", () => {
  it("counts crew per department and by what they are doing", () => {
    const t = new CrewTally(); t.reset(chars);
    expect(t.deptCounts()).toEqual([1, 2, 0, 0, 0, 0, 1]);
    expect(t.activity()).toEqual({ working: 1, eating: 1, sleeping: 1, relaxing: 0 });
  });
  it("follows state changes", () => {
    const t = new CrewTally(); t.reset(chars); t.setState(0, 4); t.setState(3, 5);
    expect(t.activity()).toEqual({ working: 1, eating: 1, sleeping: 1, relaxing: 1 });
  });
  it("ignores changes for unknown crew", () => {
    const t = new CrewTally(); t.reset(chars); t.setState(99, 5);
    expect(t.activity().working).toBe(1);
  });
});
