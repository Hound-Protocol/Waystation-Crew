import { describe, it, expect } from "vitest";
import { shipPhase, CYCLE, DWELL, FLIGHT, PAD_WAIT, PREP, liftoffIn, arrivalIn, type Leg } from "./timeline";

const phases = (from: number, to: number) => { const out: string[] = []; for (let t = from; t < to; t++) { const p = shipPhase(t).phase; if (out[out.length - 1] !== p) out.push(p); } return out; };

describe("ship timeline: one round trip per sim hour", () => {
  it("repeats every hour", () => {
    for (let t = 0; t < CYCLE; t += 13) expect(shipPhase(t + 5 * CYCLE)).toEqual(shipPhase(t));
  });
  it("goes through the whole round trip in order within an hour", () => {
    expect(phases(0, CYCLE)).toEqual([
      "docked", "gate-closing", "restraining", "locked", "burn", "releasing", "flight",
      "landed", "gate-closing", "restraining", "locked", "burn", "releasing", "flight", "docked"]);
  });
  it("is docked at the station at the start of the sim, with the gate open", () => {
    expect(shipPhase(0)).toMatchObject({ phase: "docked", at: "station" });
  });
  it("flies for 300 ticks each way and waits 300 on the pad, prep is 360", () => {
    expect([FLIGHT, PAD_WAIT, PREP]).toEqual([300, 300, 360]);
    const legs = (leg: Leg) => { let n = 0; for (let t = 0; t < CYCLE; t++) if (shipPhase(t).phase === "flight" && shipPhase(t).leg === leg) n++; return n; };
    expect(legs("out")).toBe(300); expect(legs("back")).toBe(300);
    let landed = 0; for (let t = 0; t < CYCLE; t++) if (shipPhase(t).phase === "landed") landed++;
    expect(landed).toBe(300);
  });
  it("is at the station, in flight, or at the pad, and always says where", () => {
    const seen = new Set<string>();
    for (let t = 0; t < CYCLE; t++) { const p = shipPhase(t); seen.add(p.at); if (p.phase === "flight") expect(p.at).toBe("air"); if (p.phase === "landed") expect(p.at).toBe("pad"); }
    expect([...seen].sort()).toEqual(["air", "pad", "station"]);
  });
  it("reports progress through its segment from 0 up to just under 1", () => {
    for (let t = 0; t < CYCLE; t++) { const p = shipPhase(t); expect(p.u).toBeGreaterThanOrEqual(0); expect(p.u).toBeLessThan(1); }
    expect(shipPhase(0).u).toBeGreaterThanOrEqual(0);
  });
  it("lifts off 1740 ticks into the dwell cycle (tick 1560 of the hour) and is back docked with 1380 ticks of dwell", () => {
    expect(shipPhase(1559).phase).toBe("releasing"); expect(shipPhase(1560).phase).toBe("flight");
    let docked = 0; for (let t = 0; t < CYCLE; t++) if (shipPhase(t).phase === "docked") docked++;
    expect(docked).toBe(1380);
  });
});

describe("cycle length", () => {
  it("is 3000 ticks (50 min) with 5-minute flights and the dwell unchanged", () => {
    expect(CYCLE).toBe(3000);
    expect(FLIGHT).toBe(300);
    expect(DWELL).toBe(1380);
  });
});

describe("countdowns for the overview card", () => {
  const first = (pred: (t: number) => boolean) => { for (let t = 0; t < CYCLE; t++) if (pred(t)) return t; throw new Error("none"); };
  it("liftoffIn counts down to the next flight and hits 0 exactly at lift-off", () => {
    const lift = first((t) => shipPhase(t).phase === "flight");
    expect(liftoffIn(lift - 1)).toBe(1); expect(liftoffIn(lift - 100)).toBe(100);
    expect(liftoffIn(lift - PREP)).toBe(PREP);                         // gate starts closing 360 ticks before
  });
  it("from the pad the next lift-off is the flight back", () => {
    const land = first((t) => shipPhase(t).phase === "landed");
    expect(liftoffIn(land)).toBe(PAD_WAIT + PREP);
  });
  it("arrivalIn is the time left in flight, null otherwise", () => {
    const lift = first((t) => shipPhase(t).phase === "flight");
    expect(arrivalIn(lift)).toBe(FLIGHT); expect(arrivalIn(lift + 100)).toBe(FLIGHT - 100); expect(arrivalIn(lift - 1)).toBeNull();
  });
});
