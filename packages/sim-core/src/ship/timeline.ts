/**
 * The ship's round trip as a pure function of sim time (1 tick = 1 sim second), one trip per sim hour.
 * Cycle (c = ticks since the ship docked): dwell at the station -> prep (gate closes, bars lower, locked, burn, bars raise)
 * -> flight out -> landed on the pad (gate opens, 5-minute timer) -> prep -> flight back -> docked.
 */
export const HOUR = 3600;
export const FLIGHT = 600, PAD_WAIT = 300, PREP = 360;
/** Prep sub-phases, in order, with their lengths (sum = PREP). */
export const PREP_STEPS = [["gate-closing", 60], ["restraining", 60], ["locked", 120], ["burn", 60], ["releasing", 60]] as const;
/** Dwell at the station; the rest of the hour is the trip. */
export const DWELL = HOUR - (PREP + FLIGHT + PAD_WAIT + PREP + FLIGHT);
/** The cycle starts when the ship docks; this shifts it so that the sim starts with the ship docked, partway through its dwell. */
const PHASE_SHIFT = 180;

export type Phase = "docked" | "gate-closing" | "restraining" | "locked" | "burn" | "releasing" | "flight" | "landed";
export type Where = "station" | "air" | "pad";
export type Leg = "out" | "back";
export interface ShipPhase { phase: Phase; at: Where; leg: Leg | null; /** ticks into the segment, and its length */ t: number; dur: number; /** t / dur, 0 up to just under 1 */ u: number }

type Seg = { phase: Phase; at: Where; leg: Leg | null; dur: number };
const prep = (at: Where): Seg[] => PREP_STEPS.map(([phase, dur]) => ({ phase, at, leg: null, dur }));
const SEGMENTS: Seg[] = [
  { phase: "docked", at: "station", leg: null, dur: DWELL }, ...prep("station"),
  { phase: "flight", at: "air", leg: "out", dur: FLIGHT },
  { phase: "landed", at: "pad", leg: null, dur: PAD_WAIT }, ...prep("pad"),
  { phase: "flight", at: "air", leg: "back", dur: FLIGHT },
];

export function shipPhase(tick: number): ShipPhase {
  let c = (((tick + PHASE_SHIFT) % HOUR) + HOUR) % HOUR;
  for (const s of SEGMENTS) {
    if (c < s.dur) return { phase: s.phase, at: s.at, leg: s.leg, t: c, dur: s.dur, u: c / s.dur };
    c -= s.dur;
  }
  throw new Error("unreachable");
}
