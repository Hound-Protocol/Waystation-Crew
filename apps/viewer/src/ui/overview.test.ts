import { describe, it, expect } from "vitest";
import { shipPhase, CYCLE } from "@wc/sim-core";
import { mmss, overviewFor, type OverviewCtx } from "./overview";

const first = (pred: (t: number) => boolean) => { for (let t = 0; t < CYCLE; t++) if (pred(t)) return t; throw new Error("none"); };
const ctx = (tick: number, over: Partial<OverviewCtx> = {}): OverviewCtx => ({ stationName: "Waystation Crew", crew: 60, clock: "day 1 06:31", shipTick: tick, slip: 0, holding: false, aboard: 2, bodies: new Map(), ...over });
const row = (d: { rows: [string, string][] }, k: string) => d.rows.find(([a]) => a === k)?.[1];

describe("mmss", () => { it("formats ticks (sim seconds) as m:ss", () => { expect(mmss(0)).toBe("0:00"); expect(mmss(75)).toBe("1:15"); expect(mmss(3600)).toBe("60:00"); }); });

describe("overviewFor", () => {
  it("the station card names the station and gives crew, time and what the ship is doing", () => {
    const d = overviewFor("station", ctx(0));
    expect(d.title).toBe("Waystation Crew"); expect(d.kind).toBe("Station");
    expect(row(d, "Crew")).toBe("60"); expect(row(d, "Time")).toBe("day 1 06:31"); expect(row(d, "Ship")).toBeDefined();
  });
  it("the ship card counts down to lift-off while docked, and says who is aboard", () => {
    const t = first((x) => shipPhase(x).phase === "docked");
    const d = overviewFor("ship", ctx(t));
    expect(d.kind).toBe("Cargo ship"); expect(row(d, "Status")).toBe("Docked"); expect(row(d, "Lift-off in")).toMatch(/^\d+:\d\d$/); expect(row(d, "Aboard")).toBe("2");
  });
  it("in flight it shows arrival time and direction instead", () => {
    const t = first((x) => shipPhase(x).phase === "flight");
    const d = overviewFor("ship", ctx(t + 60));
    expect(row(d, "Status")).toMatch(/In flight/); expect(row(d, "Arrives in")).toBe("4:00"); expect(row(d, "Lift-off in")).toBeUndefined();
  });
  it("shows the slip and a waiting note when the pilots are missing", () => {
    const t = first((x) => shipPhase(x).phase === "docked");
    const d = overviewFor("ship", ctx(t, { slip: 90, holding: true }));
    expect(row(d, "Status")).toMatch(/waiting for pilots/i); expect(row(d, "Delay")).toBe("1:30");
  });
  it("a planet card shows its name and distance from the station", () => {
    const d = overviewFor("body:Home", ctx(0, { bodies: new Map([["Home", { name: "Home", kind: "Planet", distance: 1744 }]]) }));
    expect(d.title).toBe("Home"); expect(d.kind).toBe("Planet"); expect(row(d, "Distance")).toBe("1,744 tiles");
  });
});
