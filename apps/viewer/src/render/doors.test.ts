import { describe, it, expect } from "vitest";
import { DoorModel, doorFrame, DOOR_FRAMES } from "./doors";
import { buildAtlas } from "./sprites/atlas";

const a = buildAtlas();
const alpha = (k: string, x: number, y: number) => { const f = a.frames[k]; return a.data[((f.y + y) * a.width + f.x + x) * 4 + 3]; };

describe("door sprites", () => {
  it("has horizontal and vertical frames from closed to fully open", () => {
    for (let k = 0; k < DOOR_FRAMES; k++) { expect(a.frames[`door:h:${k}`]).toBeTruthy(); expect(a.frames[`door:v:${k}`]).toBeTruthy(); }
  });
  it("closed door covers the middle; open door leaves a gap but keeps the jambs", () => {
    expect(alpha("door:h:0", 8, 7)).toBe(255);
    expect(alpha(`door:h:${DOOR_FRAMES - 1}`, 8, 7)).toBe(0);
    expect(alpha(`door:h:${DOOR_FRAMES - 1}`, 0, 7)).toBe(255);
  });
  it("opens progressively: the covered area shrinks frame by frame", () => {
    const cover = (k: number) => { let n = 0; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (alpha(`door:h:${k}`, x, y)) n++; return n; };
    for (let k = 1; k < DOOR_FRAMES; k++) expect(cover(k)).toBeLessThan(cover(k - 1));
  });
  it("vertical frames are the rotated horizontal ones", () => {
    expect(alpha("door:v:0", 7, 8)).toBe(255);
    expect(alpha(`door:v:${DOOR_FRAMES - 1}`, 7, 8)).toBe(0);
  });
  it("maps open amount 0..1 to a frame index", () => {
    expect(doorFrame(0)).toBe(0); expect(doorFrame(1)).toBe(DOOR_FRAMES - 1);
    expect(doorFrame(0.5)).toBeGreaterThan(0); expect(doorFrame(0.5)).toBeLessThan(DOOR_FRAMES - 1);
  });
});

describe("DoorModel", () => {
  const doors = [{ x: 5, y: 5 }, { x: 20, y: 5 }];
  it("opens when a character is near and stays closed when none are", () => {
    const m = new DoorModel(doors);
    for (let i = 0; i < 60; i++) m.update(1 / 60, [{ x: 5.2, y: 5.8 }]);
    expect(m.open[0]).toBeGreaterThan(0.95); expect(m.open[1]).toBe(0);
  });
  it("opens smoothly (monotonic, no jump) and closes more slowly after they leave", () => {
    const m = new DoorModel(doors);
    let prev = 0, maxStep = 0;
    for (let i = 0; i < 40; i++) { m.update(1 / 60, [{ x: 5, y: 5 }]); maxStep = Math.max(maxStep, m.open[0] - prev); expect(m.open[0]).toBeGreaterThanOrEqual(prev); prev = m.open[0]; }
    expect(maxStep).toBeLessThan(0.3);
    let t = 0; while (m.open[0] > 0.05 && t < 600) { m.update(1 / 60, []); t++; }
    expect(t).toBeGreaterThan(10); expect(t).toBeLessThan(120);
  });
  it("opens before the character reaches the door (they never walk into a closed door)", () => {
    const m = new DoorModel(doors);
    for (let i = 0; i < 30; i++) m.update(1 / 60, [{ x: 5, y: 6.9, vx: 0, vy: -1.2 }]); // ~1.9 tiles away, walking toward it
    expect(m.open[0]).toBeGreaterThan(0.3);
  });
  it("does not open for someone just walking past along the corridor", () => {
    const m = new DoorModel(doors);
    for (let x = 0; x <= 11; x += 0.02) m.update(1 / 60, [{ x, y: 6, vx: 1.2, vy: 0 }]);
    expect(Math.max(...m.open)).toBeLessThan(0.3);
  });
});

