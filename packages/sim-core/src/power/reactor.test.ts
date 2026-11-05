import { describe, it, expect } from "vitest";
import { createReactor, stepReactor, startRestart, TUNING, type ReactorState } from "./reactor";

const running = (o: Partial<ReactorState> = {}): ReactorState => ({ ...createReactor(), status: "running", feed: 0.6, field: 0.7, coolant: 0.5, temp: 0.62, fuel: 0.8, ...o });
const run = (r: ReactorState, n: number) => { for (let i = 0; i < n; i++) stepReactor(r); return r; };

describe("reactor", () => {
  it("output rises with feed inside the temp band", () => {
    const lo = run(running({ feed: 0.5, temp: 0.6 }), 1), hi = run(running({ feed: 0.9, temp: 0.6 }), 1);
    expect(hi.output).toBeGreaterThan(lo.output); expect(lo.output).toBeGreaterThan(0.2);
  });
  it("output is near zero below the band", () => {
    const r = running({ feed: 0.9, temp: 0.2, coolant: 0.5 }); stepReactor(r);
    expect(r.output).toBeLessThan(0.05);
  });
  it("fuel burns in proportion to feed", () => {
    const a = running({ feed: 0.3, field: 1, coolant: 1 }), b = running({ feed: 0.9, field: 1, coolant: 1 }); const fa = a.fuel, fb = b.fuel;
    run(a, 100); run(b, 100);
    expect((fb - b.fuel) / (fa - a.fuel)).toBeCloseTo(3, 1);
  });
  it("an empty tank scrams and zeroes output", () => {
    const r = running({ fuel: 0 }); stepReactor(r);
    expect(r.status).toBe("scram"); expect(r.output).toBe(0);
  });
  it("temp settles toward the balance of heat and coolant", () => {
    const r = running({ temp: 0.1, feed: 0.6, coolant: 0.5 }); run(r, 600);
    const hot = running({ temp: 0.9, feed: 0.6, coolant: 0.5 }); run(hot, 600);
    expect(Math.abs(r.temp - hot.temp)).toBeLessThan(0.03);
    const cooled = running({ temp: 0.62, feed: 0.6, coolant: 0.9 }); run(cooled, 600);
    expect(cooled.temp).toBeLessThan(r.temp);
  });
  it("temp above the band accumulates wear", () => {
    const hot = running({ feed: 1, coolant: 0.2, field: 1, temp: 0.9 }), calm = running();
    run(hot, 200); run(calm, 200);
    expect(hot.wear).toBeGreaterThan(calm.wear * 2);
  });
  it("a field below what temp demands scrams", () => {
    const r = running({ field: 0.1, temp: 0.7 }); stepReactor(r);
    expect(r.status).toBe("scram"); expect(r.output).toBe(0);
  });
  it("restart runs field, coolant, temp, feed in order and ends running", () => {
    const r = running({ status: "scram", output: 0, temp: 0, field: 0, coolant: 0, feed: 0 });
    expect(startRestart(r)).toBe(true); expect(r.status).toBe("starting"); expect(r.step).toBe(0);
    const seen: number[] = [];
    r.field = 0.7; run(r, TUNING.restartSteps[0]); seen.push(r.step);
    r.coolant = 0.5; run(r, TUNING.restartSteps[1]); seen.push(r.step);
    run(r, TUNING.restartSteps[2]); seen.push(r.step);
    r.feed = 0.6; run(r, TUNING.restartSteps[3] + 1); seen.push(r.step);
    expect(seen.slice(0, 3)).toEqual([1, 2, 3]); expect(r.status).toBe("running");
  });
  it("feed applied before the temperature step resets the sequence", () => {
    const r = running({ status: "scram", output: 0, temp: 0, field: 0, coolant: 0, feed: 0 }); startRestart(r);
    r.field = 0.7; run(r, TUNING.restartSteps[0] + 5); expect(r.step).toBe(1);
    r.feed = 0.6; stepReactor(r); expect(r.step).toBe(0); expect(r.status).toBe("starting");
  });
  it("restart is refused with an empty tank", () => {
    const r = running({ status: "scram", fuel: 0 }); expect(startRestart(r)).toBe(false); expect(r.status).toBe("scram");
  });
  it("values never leave 0..1 over 100000 ticks with random setpoints", () => {
    const r = running(); let s = 12345; const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
    for (let i = 0; i < 100000; i++) {
      if (i % 50 === 0) { r.feed = rnd(); r.field = rnd(); r.coolant = rnd(); if (r.status === "scram" && rnd() < 0.2) { r.fuel = Math.max(r.fuel, 0.5); startRestart(r); } }
      stepReactor(r);
      for (const k of ["fuel", "feed", "field", "coolant", "temp", "wear", "output", "fieldDraw"] as const) { if (!(r[k] >= 0 && r[k] <= 1)) throw new Error(`${k}=${r[k]} at ${i}`); }
    }
  });
  it("left unattended with fixed setpoints the reactor eventually scrams from wear", () => {
    const r = running({ fuel: 1 }); let t = 0; while (r.status === "running" && t < 100000) { stepReactor(r); r.fuel = 1; t++; }
    expect(r.status).toBe("scram"); expect(t).toBeGreaterThan(5000);
  });
});
