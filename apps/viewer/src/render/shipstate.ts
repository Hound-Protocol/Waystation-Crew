/**
 * The docked ship's pre-departure routine, as a pure function of sim time. A stand-in until real flights drive the ship:
 * idle -> bars lower -> locked (nozzles warm) -> burn (main thrusters fire) -> bars raise (nozzles cool) -> idle.
 * bars: 0 raised / open .. 1 locked. thrust: main-engine plume. glow: nozzle heat (lingers after the burn).
 */
export const CYCLE = 1800;
export type ShipPhase = "docked" | "restraining" | "locked" | "burn" | "releasing";
export interface ShipState { phase: ShipPhase; bars: number; thrust: number; glow: number }

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function shipState(tick: number): ShipState {
  const t = ((tick % CYCLE) + CYCLE) % CYCLE;
  if (t < 1200) return { phase: "docked", bars: 0, thrust: 0, glow: 0 };
  if (t < 1260) { const k = ease((t - 1200) / 60); return { phase: "restraining", bars: k, thrust: 0, glow: 0.5 * k }; }
  if (t < 1380) return { phase: "locked", bars: 1, thrust: 0, glow: 0.5 };
  if (t < 1440) {
    const up = clamp01((t - 1380) / 20), down = clamp01((1440 - t) / 20);
    return { phase: "burn", bars: 1, thrust: ease(Math.min(up, down)), glow: 0.5 + 0.5 * ease(up) };
  }
  if (t < 1500) { const k = ease((t - 1440) / 60); return { phase: "releasing", bars: 1 - k, thrust: 0, glow: 1 - k }; }
  return { phase: "docked", bars: 0, thrust: 0, glow: 0 };
}
