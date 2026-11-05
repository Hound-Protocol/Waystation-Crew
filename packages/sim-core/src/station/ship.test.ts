import { describe, it, expect } from "vitest";
import { typeOf } from "./kit";
import { createRng } from "../rng";

/** The ship deck blueprint, unrotated: nose at the top (y = 0), stern ramp at the bottom. Cell (x, y) is floor-space; the grid has a 1-cell wall margin. */
const bp = typeOf("ship_deck").make(createRng(1));
const W = 21, H = 34;
const at = (x: number, y: number) => bp.grid[y + 1]?.[x + 1] ?? " ";
const count = (ch: string) => bp.grid.join("").split(ch).length - 1;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe("ship deck: flight deck", () => {
  it("is its own room: a bulkhead across the hull at y=7 with a 3-wide door", () => {
    for (const x of [...range(0, 8), ...range(12, 20)]) expect(at(x, 7), `bulkhead x=${x}`).toBe("#");
    for (const x of [9, 10, 11]) expect(["."].includes(at(x, 7)), `door x=${x}`).toBe(true);
  });
  it("has pilot, co-pilot and engineer stations plus instrument racks, all forward of the bulkhead", () => {
    const consoles = [..."Cn"].flatMap((g) => range(0, W - 1).flatMap((x) => range(0, H - 1).filter((y) => at(x, y) === g)));
    expect(consoles.length).toBe(3);
    expect(count("@")).toBeGreaterThanOrEqual(4);
    for (let y = 7; y < H; y++) for (let x = 0; x < W; x++) expect(at(x, y)).not.toBe("@");
  });
  it("has a canopy across the nose and viewports along its flanks", () => {
    expect(range(7, 13).every((x) => at(x, -1) === "[")).toBe(true);        // 7-wide canopy in the wall ring above the nose
    expect(count("]")).toBeGreaterThanOrEqual(4);
  });
});

describe("ship deck: passenger line", () => {
  it("has a continuous seat line down both hulls to the very back (y 11..28)", () => {
    for (const y of range(11, 28)) { expect(at(0, y), `L y=${y}`).toBe("~"); expect(at(20, y), `R y=${y}`).toBe("~"); }
    expect(count("~")).toBe(36);
  });
  it("has portholes along the hull beside the seats and the two boarding doors behind the flight deck", () => {
    expect(count("(")).toBeGreaterThanOrEqual(10);
    expect(count("A")).toBe(4 + 9);                                    // 2 side gates x 2 cells + the 9-cell stern gateway
  });
});

describe("ship deck: stern", () => {
  it("has the whole 9x3 rear ramp as one continuous surface (no gap at the centre)", () => {
    for (const y of range(31, 33)) for (const x of range(6, 14)) expect(at(x, y), `ramp ${x},${y}`).toBe(",");
  });
  it("closes the stern with one 9-wide gateway: a single unbroken run of airlock cells, no small door in the middle", () => {
    for (const x of range(6, 14)) expect(at(x, H), `gate x=${x}`).toBe("A");
    expect(count("d")).toBe(0);
  });
  it("carries no in-hull thruster tiles: the engines are big external sprites", () => {
    expect(count("!")).toBe(0); expect(count("}")).toBe(0);
  });
});

describe("ship deck: cargo hold", () => {
  it("is framed by hazard stripes with the stern open to the ramp", () => {
    for (const x of range(2, 18)) expect(at(x, 10), `top x=${x}`).toBe("h");
    for (const y of range(10, 30)) { expect(at(2, y), `L y=${y}`).toBe("h"); expect(at(18, y), `R y=${y}`).toBe("h"); }
    for (const x of range(6, 14)) expect(at(x, 30), `mouth x=${x}`).not.toBe("h");
  });
  it("has a loader lane down the middle", () => {
    for (const y of range(11, 29)) expect(at(10, y), `lane y=${y}`).toBe("=");
  });
  it("has 28 slots: 8 large (2x2), 8 medium (2x1), 12 small (1x1)", () => {
    for (const g of ["1", "2", "3", "4"]) expect(count(g), `large corner ${g}`).toBe(8);
    for (const g of ["<", ">"]) expect(count(g), `medium end ${g}`).toBe(8);
    expect(count(";")).toBe(12);
  });
  it("every slot cell and every console is reachable on foot from the stern door", () => {
    const open = new Set([".", "=", "h", ",", ";", "<", ">", "1", "2", "3", "4", "A"]);
    const seen = new Set<string>(); const q: Array<[number, number]> = [[10, H]];
    while (q.length) {
      const [x, y] = q.pop()!; const k = `${x},${y}`;
      if (seen.has(k) || !open.has(at(x, y))) continue;
      seen.add(k);
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ("<>1234;".includes(at(x, y))) expect(seen.has(`${x},${y}`), `slot ${at(x, y)}@${x},${y}`).toBe(true);
      if ("Cn".includes(at(x, y))) expect(seen.has(`${x},${y + 1}`), `console@${x},${y}`).toBe(true);
    }
  });
});
