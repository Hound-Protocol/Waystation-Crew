import { describe, it, expect } from "vitest";
import { shipPhase, HOUR, FLIGHT, PAD_WAIT, PREP, type Leg } from "./timeline";

const phases = (from: number, to: number) => { const out: string[] = []; for (let t = from; t < to; t++) { const p = shipPhase(t).phase; if (out[out.length - 1] !== p) out.push(p); } return out; };

describe("ship timeline: one round trip per sim hour", () => {
  it("repeats every hour", () => {
    for (let t = 0; t < HOUR; t += 13) expect(shipPhase(t + 5 * HOUR)).toEqual(shipPhase(t));
  });
  it("goes through the whole round trip in order within an hour", () => {
    expect(phases(0, HOUR)).toEqual([
      "docked", "gate-closing", "restraining", "locked", "burn", "releasing", "flight",
      "landed", "gate-closing", "restraining", "locked", "burn", "releasing", "flight", "docked"]);
  });
  it("is docked at the station at the start of the sim, with the gate open", () => {
    expect(shipPhase(0)).toMatchObject({ phase: "docked", at: "station" });
  });
  it("flies for 600 ticks each way and waits 300 on the pad, prep is 360", () => {
    expect([FLIGHT, PAD_WAIT, PREP]).toEqual([600, 300, 360]);
    const legs = (leg: Leg) => { let n = 0; for (let t = 0; t < HOUR; t++) if (shipPhase(t).phase === "flight" && shipPhase(t).leg === leg) n++; return n; };
    expect(legs("out")).toBe(600); expect(legs("back")).toBe(600);
    let landed = 0; for (let t = 0; t < HOUR; t++) if (shipPhase(t).phase === "landed") landed++;
    expect(landed).toBe(300);
  });
  it("is at the station, in flight, or at the pad, and always says where", () => {
    const seen = new Set<string>();
    for (let t = 0; t < HOUR; t++) { const p = shipPhase(t); seen.add(p.at); if (p.phase === "flight") expect(p.at).toBe("air"); if (p.phase === "landed") expect(p.at).toBe("pad"); }
    expect([...seen].sort()).toEqual(["air", "pad", "station"]);
  });
  it("reports progress through its segment from 0 up to just under 1", () => {
    for (let t = 0; t < HOUR; t++) { const p = shipPhase(t); expect(p.u).toBeGreaterThanOrEqual(0); expect(p.u).toBeLessThan(1); }
    expect(shipPhase(0).u).toBeGreaterThanOrEqual(0);
  });
  it("lifts off 1740 ticks into the dwell cycle (tick 1560 of the hour) and is back docked with 1380 ticks of dwell", () => {
    expect(shipPhase(1559).phase).toBe("releasing"); expect(shipPhase(1560).phase).toBe("flight");
    let docked = 0; for (let t = 0; t < HOUR; t++) if (shipPhase(t).phase === "docked") docked++;
    expect(docked).toBe(1380);
  });
});
