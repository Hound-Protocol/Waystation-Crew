import { describe, it, expect } from "vitest";
import { shipPose, gateProfile } from "./pose";
import { shipPhase, HOUR } from "./timeline";

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
const first = (pred: (t: number) => boolean, from = 0) => { for (let t = from; t < from + 2 * HOUR; t++) if (pred(t)) return t; throw new Error("none"); };
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
    expect(speed(liftoff)).toBeLessThan(speed(liftoff + 300) / 100);       // starts from rest
    expect(speed(landing - 1)).toBeLessThan(speed(liftoff + 300) / 100);   // and arrives at rest
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
  const all = range(0, HOUR);
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
    expect(shipPose(liftoff + 300).thrust).toBe(0);
    expect(shipPose(liftoff + 20).glow).toBeGreaterThan(shipPose(liftoff + 400).glow);
    expect(shipPose(0)).toMatchObject({ bars: 0, thrust: 0, glow: 0 });
  });
  it("keeps the station gateway open while docked, shuts it before departure, and keeps it shut while away", () => {
    for (let t = 0; t < 400; t += 10) expect(shipPose(t).stationGate).toEqual({ v: 1, moving: false });
    const close = first((t) => shipPhase(t).phase === "gate-closing");
    expect(shipPose(close).stationGate.v).toBe(1); expect(shipPose(close + 59).stationGate.v).toBeLessThan(0.2);
    for (let t = close + 60; t < arrive; t += 7) expect(shipPose(t).stationGate, `t=${t}`).toEqual({ v: 0, moving: false });
    expect(shipPose(arrive).stationGate.moving).toBe(true); expect(shipPose(arrive + 60).stationGate).toEqual({ v: 1, moving: false });
  });
  it("opens the pad stub gate on landing, holds it open through the wait, and shuts it only for the next departure", () => {
    for (let t = 0; t < landing; t += 11) expect(shipPose(t).padGate).toEqual({ v: 0, moving: false });
    expect(shipPose(landing).padGate.moving).toBe(true);
    expect(shipPose(landing + 60).padGate).toEqual({ v: 1, moving: false });
    const padClose = first((t) => shipPhase(t).phase === "gate-closing", landing);
    expect(padClose).toBe(landing + 300);
    expect(shipPose(padClose + 59).padGate.v).toBeLessThan(0.2);
    expect(shipPose(padClose + 60).padGate).toEqual({ v: 0, moving: false });
  });
  it("opens in three beats: a small crack, a pause, then a slow heavy swing", () => {
    const g = (t: number) => shipPose(t).padGate.v;
    expect(g(landing)).toBe(0);
    expect(g(landing + 4)).toBeGreaterThan(0); expect(g(landing + 4)).toBeLessThan(0.1);
    expect(g(landing + 15)).toBeCloseTo(0.1, 5); expect(g(landing + 17)).toBeCloseTo(0.1, 5);
    expect(g(landing + 30)).toBeGreaterThan(0.2); expect(g(landing + 30)).toBeLessThan(0.9);
    let prev = 0; for (let t = landing; t <= landing + 60; t++) { expect(g(t)).toBeGreaterThanOrEqual(prev); prev = g(t); }
    expect(gateProfile(1)).toBeCloseTo(1, 9);
  });
  it("is the same every hour", () => { for (const t of all.filter((x) => x % 17 === 0)) expect(shipPose(t + 4 * HOUR)).toEqual(shipPose(t)); });
});
