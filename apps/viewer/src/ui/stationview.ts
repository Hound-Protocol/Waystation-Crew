import { shipPhase, liftoffIn, arrivalIn, CYCLE, GROWTH_INTERVAL, DEPARTMENT_NAMES } from "@wc/sim-core";

/** Needs shown as mood bars, in display order. */
export const MOOD_KEYS = ["hunger", "energy", "social", "hygiene", "fun"] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];

export interface StatsIn {
  power: { status: "offline" | "starting" | "running" | "scram"; output: number; demand: number; battery: number; fuel: number; fuelStore: number; supplyLevel: number };
  needs: Record<MoodKey, number>; lamps: number; lightable: number; dark: number; orders: number; built: number; rooms: number;
}
export interface StationCtx {
  name: string; tick: number; shipTick: number; slip: number; holding: boolean; aboard: number; crew: number;
  /** crew per department, in DEPARTMENT_NAMES order */
  deptCounts: number[];
  activity: { working: number; eating: number; sleeping: number; relaxing: number };
  /** floor tiles of the station */
  footprint: number;
  stats: StatsIn | null;
}

const PREP_LABEL: Record<string, string> = { "gate-closing": "Gate closing", restraining: "Restraining", locked: "Locked for flight", burn: "Burn", releasing: "Releasing" };
const SECONDS_PER_DAY = 86400;

export interface StationView {
  title: string; day: number;
  depts: { name: string; count: number; share: number }[];
  activity: { label: string; count: number }[];
  mood: { avg: number; items: { key: MoodKey; value: number }[] };
  lights: { lamps: number; dark: number; orders: number; built: number; litShare: number };
  power: { status: string; output: number; demand: number; battery: number; fuel: number; fuelStore: number; supplyLevel: number; /** demand over output for a gauge, 0..1.5 (above 1 is a brownout) */ load: number };
  ship: { status: string; nextLabel: string; next: number; progress: number; aboard: number; delay: number };
  facts: { rooms: number; footprint: number; day: number; growth: number };
}

export function stationView(c: StationCtx): StationView {
  const total = c.deptCounts.reduce((a, b) => a + b, 0);
  const depts = DEPARTMENT_NAMES.map((name, i) => ({ name, count: c.deptCounts[i] ?? 0, share: total > 0 ? (c.deptCounts[i] ?? 0) / total : 0 }));
  const a = c.activity, counted = a.working + a.eating + a.sleeping + a.relaxing;
  const activity = [
    { label: "Working", count: a.working }, { label: "Eating", count: a.eating }, { label: "Sleeping", count: a.sleeping },
    { label: "Relaxing", count: a.relaxing }, { label: "Moving", count: Math.max(0, c.crew - counted) },
  ];
  const s = c.stats;
  const items = MOOD_KEYS.map((key) => ({ key, value: s ? s.needs[key] : 0 }));
  const avg = s ? items.reduce((x, m) => x + m.value, 0) / items.length : 0;
  const lights = {
    lamps: s?.lamps ?? 0, dark: s?.dark ?? 0, orders: s?.orders ?? 0, built: s?.built ?? 0,
    litShare: s && s.lightable > 0 ? 1 - s.dark / s.lightable : 1,
  };

  const pw = s?.power, STATUS = { offline: "Offline", starting: "Restarting", running: "Running", scram: "Scram, blackout" } as const;
  const power = pw
    ? { status: STATUS[pw.status], output: pw.output, demand: pw.demand, battery: pw.battery, fuel: pw.fuel, fuelStore: pw.fuelStore, supplyLevel: pw.supplyLevel, load: pw.output > 0 ? Math.min(1.5, pw.demand / pw.output) : pw.demand > 0 ? 1.5 : 0 }
    : { status: "Offline" as string, output: 0, demand: 0, battery: 0, fuel: 0, fuelStore: 0, supplyLevel: 1, load: 0 };

  const p = shipPhase(c.shipTick), arrive = arrivalIn(c.shipTick);
  const status = p.phase === "docked" ? "Docked" : p.phase === "landed" ? "On the pad"
    : p.phase === "flight" ? `In flight, ${p.leg === "out" ? "to the planet" : "to the station"}` : (PREP_LABEL[p.phase] ?? p.phase);
  const next = arrive ?? liftoffIn(c.shipTick);
  const ship = {
    status: c.holding ? "Docked, waiting for pilots" : status,
    nextLabel: arrive !== null ? "Arrives in" : "Lift-off in", next,
    progress: arrive !== null ? p.u : Math.min(1, Math.max(0, 1 - next / CYCLE)),
    aboard: c.aboard, delay: c.slip,
  };

  const day = Math.floor(c.tick / SECONDS_PER_DAY) + 1;
  return {
    title: c.name, day, depts, activity, mood: { avg, items }, lights, power, ship,
    facts: { rooms: s?.rooms ?? 0, footprint: c.footprint, day, growth: (c.tick % GROWTH_INTERVAL) / GROWTH_INTERVAL },
  };
}
