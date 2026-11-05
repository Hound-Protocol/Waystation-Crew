import { describe, it, expect } from "vitest";
import { shipPose, gateProfile, GATE_TICKS } from "./pose";
import { shipPhase, CYCLE } from "./timeline";

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
const first = (pred: (t: number) => boolean, from = 0) => { for (let t = from; t < from + 2 * CYCLE; t++) if (pred(t)) return t; throw new Error("none"); };
const liftoff = first((t) => shipPhase(t).phase === "flight" && shipPhase(t).leg === "out");
const landing = first((t) => shipPhase(t).phase === "landed");
const backStart = first((t) => shipPhase(t).phase === "flight" && shipPhase(t).leg === "back");
const arrive = first((t) => shipPhase(t).phase === "docked", backStart);

describe("ship pose: where the ship is", () => {
  it("sits at the station berth while docked and at the pad berth while landed, heading unturned", () => {
    for (const t of [0, 300, liftoff - 400]) expect(shipPose(t)).toMatchObject({ s: 0, turn: 0, dir: 0 });
    for (const t of [landing, landing + 100, landing + 299]) expect(shipPose(t)).toMatchObject({ s: 1, turn: 0, dir: 0 });
  });
  it("flies out from the station to the pad, monotonically, easing from rest to rest", () => {
    let prev = 0;
    for (let t = liftoff; t < landing; t++) { const s = shipPose(t).s; expect(s, `t=${t}`).toBeGreaterThanOrEqual(prev); prev = s; expect(shipPose(t).dir).toBe(1); }
    expect(shipPose(liftoff).s).toBe(0);
    expect(shipPose(landing - 1).s).toBeGreaterThan(0.9999);
    const speed = (t: number) => shipPose(t + 1).s - shipPose(t).s;
    expect(speed(liftoff)).toBeLessThan(speed(liftoff + 150) / 100);       // starts from rest
    expect(speed(landing - 1)).toBeLessThan(speed(liftoff + 150) / 100);   // and arrives at rest
  });
  it("flies back the same way in reverse", () => {
    let prev = 1;
    for (let t = backStart; t < arrive; t++) { const s = shipPose(t).s; expect(s, `t=${t}`).toBeLessThanOrEqual(prev); prev = s; expect(shipPose(t).dir).toBe(-1); }
    expect(shipPose(backStart).s).toBe(1); expect(shipPose(arrive - 1).s).toBeLessThan(0.0001);
  });
  it("turns toward the travel direction for the middle of each flight and back to the berth heading at the ends", () => {
    for (const [a, b] of [[liftoff, landing], [backStart, arrive]]) {
      expect(shipPose(a).turn).toBe(0); expect(shipPose(b - 1).turn).toBeLessThan(0.01);
      expect(shipPose(Math.floor((a + b) / 2)).turn).toBeGreaterThan(0.99);
      let prev = -1; for (let t = a; t < Math.floor((a + b) / 2); t++) { const k = shipPose(t).turn; expect(k).toBeGreaterThanOrEqual(prev); prev = k; }
    }
  });
});

describe("ship pose: bars, engines, gates", () => {
  const all = range(0, CYCLE);
  it("keeps every level within 0..1", () => {
    for (const t of all) { const p = shipPose(t); for (const v of [p.bars, p.thrust, p.glow, p.stationGate.v, p.padGate.v, p.s, p.turn]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); } }
  });
  it("lowers the bars before the burn, locks them, raises them after; only fires the engines on the pad when locked", () => {
    for (const t of all) { const p = shipPose(t), ph = shipPhase(t).phase; if (ph !== "flight" && p.thrust > 0) expect(p.bars, `t=${t}`).toBe(1); if (ph === "flight") expect(p.bars).toBe(0); }
    const prep0 = first((t) => shipPhase(t).phase === "restraining");
    expect(shipPose(prep0).bars).toBe(0); expect(shipPose(prep0 + 30).bars).toBeGreaterThan(0); expect(shipPose(prep0 + 30).bars).toBeLessThan(1);
    expect(shipPose(prep0 + 60).bars).toBe(1);
    const burn = first((t) => shipPhase(t).phase === "burn");
    expect(shipPose(burn + 25).thrust).toBe(1); expect(shipPose(burn + 5).thrust).toBeGreaterThan(0); expect(shipPose(burn + 5).thrust).toBeLessThan(1);
    const rel = first((t) => shipPhase(t).phase === "releasing");
    expect(shipPose(rel + 30).bars).toBeGreaterThan(0); expect(shipPose(rel + 30).bars).toBeLessThan(1);
  });
  it("fires the main engines while accelerating out of the berth and glows while they cool", () => {
    expect(shipPose(liftoff + 20).thrust).toBeGreaterThan(0.5);
    expect(shipPose(liftoff + 150).thrust).toBe(0);
    expect(shipPose(liftoff + 20).glow).toBeGreaterThan(shipPose(liftoff + 250).glow);
    expect(shipPose(0)).toMatchObject({ bars: 0, thrust: 0, glow: 0 });
  });
  it("keeps the station gateway open while docked, shuts it before departure, and keeps it shut while away", () => {
    for (let t = 0; t < 400; t += 10) expect(shipPose(t).stationGate).toEqual({ v: 1, moving: false });
    const close = first((t) => shipPhase(t).phase === "gate-closing");
    expect(shipPose(close).stationGate.v).toBe(1); expect(shipPose(close + 4).stationGate.v).toBeLessThan(0.2);
    for (let t = close + 5; t < arrive; t += 7) expect(shipPose(t).stationGate, `t=${t}`).toEqual({ v: 0, moving: false });
    expect(shipPose(arrive).stationGate.moving).toBe(true); expect(shipPose(arrive + 5).stationGate).toEqual({ v: 1, moving: false });
  });
  it("opens the pad stub gate on landing, holds it open through the wait, and shuts it only for the next departure", () => {
    for (let t = 0; t < landing; t += 11) expect(shipPose(t).padGate).toEqual({ v: 0, moving: false });
    expect(shipPose(landing).padGate.moving).toBe(true);
    expect(shipPose(landing + 5).padGate).toEqual({ v: 1, moving: false });
    const padClose = first((t) => shipPhase(t).phase === "gate-closing", landing);
    expect(padClose).toBe(landing + 300);
    expect(shipPose(padClose + 4).padGate.v).toBeLessThan(0.2);
    expect(shipPose(padClose + 5).padGate).toEqual({ v: 0, moving: false });
  });
  it("opens in five seconds: a fast bouncy crack and a pause in the first two, then a three-second swing", () => {
    expect(GATE_TICKS).toBe(5);
    const v = (sec: number) => gateProfile(sec / 5);
    expect(v(0)).toBe(0);
    let peak = 0; for (let t = 0; t <= 2; t += 0.02) peak = Math.max(peak, v(t));
    expect(peak).toBeGreaterThan(0.12 * 1.1);                     // overshoots the crack: the bounce
    expect(v(0.3)).toBeGreaterThan(0.08);                          // and it is quick
    expect(v(1.6)).toBeCloseTo(0.12, 2); expect(v(2)).toBeCloseTo(0.12, 2); // settled: the pause
    expect(v(3)).toBeGreaterThan(0.2); expect(v(3)).toBeLessThan(0.9);
    let prev = v(2); for (let t = 2; t <= 5; t += 0.05) { expect(v(t)).toBeGreaterThanOrEqual(prev - 1e-9); prev = v(t); }
    expect(gateProfile(1)).toBeCloseTo(1, 9);
    const g = (t: number) => shipPose(t).padGate.v;                // and the pose uses it over the first 5 ticks of landing
    expect(g(landing)).toBe(0); expect(g(landing + 5)).toBe(1);
    expect(g(landing + 1)).toBeGreaterThan(0.05);
  });
  it("is the same every cycle", () => { for (const t of all.filter((x) => x % 17 === 0)) expect(shipPose(t + 4 * CYCLE)).toEqual(shipPose(t)); });
});
