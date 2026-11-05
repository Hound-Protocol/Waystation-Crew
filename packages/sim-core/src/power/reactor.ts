/** A fusion reactor as a small deterministic control loop: 1 tick = 1 sim second, every value stays in 0..1. Engineers move the setpoints (feed, field, coolant); the rest follows. */
export type ReactorStatus = "offline" | "starting" | "running" | "scram";

export interface ReactorState {
  status: ReactorStatus;
  /** fuel in the tank */ fuel: number;
  /** setpoints set by engineers */ feed: number; field: number; coolant: number;
  /** plasma temperature, normalised */ temp: number;
  /** wear on the pumps and coils */ wear: number;
  /** restart sequence: current step (0 field, 1 coolant, 2 temperature, 3 feed) and ticks left in it */ step: number; stepLeft: number;
  /** power produced and power the containment field draws, as fractions of the maximum */ output: number; fieldDraw: number;
}

/** Initial values; adjusted by watching the sim run (see the spec's open tuning note). */
export const TUNING = {
  /** the temperature band the reactor is healthy in */ band: [0.45, 0.75] as const,
  /** below this temperature the plasma has fizzled out */ fizzle: 0.25,
  burnPerTick: 1 / 7200, tankMax: 1, tempEase: 0.02, heatPerFeed: 1.2, coolPerFlow: 0.2,
  wearBase: 2.3e-5, wearHot: 3e-4, fieldDrawMax: 0.15, outputMax: 1,
  /** containment needed per unit of temperature, and the slack before it fails */ fieldPerTemp: 0.8, fieldSlack: 0.02,
  /** how much wear weakens the field and the coolant */ wearField: 0.8, wearCool: 0.5,
  /** ticks for each restart step: field up, coolant up, temperature ramp, feed up */ restartSteps: [90, 90, 120, 60] as const,
  /** the setpoint a restart step needs before it advances, and the temperature the ramp aims for */ stepSetpoint: 0.3, rampTemp: 0.55,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A new reactor starts running and healthy: a station that opens in the dark would be a bug, not a scenario. */
export const createReactor = (): ReactorState => ({ status: "running", fuel: 0.6, feed: 0.6, field: 0.7, coolant: 0.5, temp: 0.62, wear: 0, step: 0, stepLeft: 0, output: 0, fieldDraw: 0 });

/** Begin the restart sequence from offline or scram. Refused (false) with an empty tank or while already running or starting. */
export function startRestart(r: ReactorState): boolean {
  if (r.status === "running" || r.status === "starting" || r.fuel <= 0.02) return false;
  r.status = "starting"; r.step = 0; r.stepLeft = TUNING.restartSteps[0]; return true;
}

function scram(r: ReactorState) { r.status = "scram"; r.output = 0; r.fieldDraw = 0; r.feed = 0; r.step = 0; r.stepLeft = 0; }

export function stepReactor(r: ReactorState): void {
  const T = TUNING;
  if (r.status === "running") {
    r.wear += T.wearBase + Math.max(0, r.temp - T.band[1]) * T.wearHot;
    const effField = r.field * (1 - T.wearField * clamp01(r.wear)), effCool = r.coolant * (1 - T.wearCool * clamp01(r.wear));
    const target = clamp01(r.feed * T.heatPerFeed - effCool * T.coolPerFlow);
    r.temp += (target - r.temp) * T.tempEase;
    r.fuel -= r.feed * T.burnPerTick;
    if (r.fuel <= 0 || effField < r.temp * T.fieldPerTemp - T.fieldSlack) scram(r);
    else {
      const bump = r.temp >= T.band[0] ? 1 : clamp01((r.temp - T.fizzle) / (T.band[0] - T.fizzle));
      r.output = r.feed * bump * T.outputMax; r.fieldDraw = r.field * T.fieldDrawMax;
    }
  } else if (r.status === "starting") {
    r.output = 0;
    if (r.step < 3 && r.feed >= 0.05) { r.step = 0; r.stepLeft = T.restartSteps[0]; }          // feed applied before the temperature step: start over
    const ready = r.step === 0 ? r.field >= T.stepSetpoint : r.step === 1 ? r.coolant >= T.stepSetpoint : r.step === 2 ? true : r.feed >= T.stepSetpoint;
    r.fieldDraw = r.step >= 1 || r.field >= T.stepSetpoint ? r.field * T.fieldDrawMax : 0;
    r.temp += ((r.step >= 2 ? T.rampTemp : 0) - r.temp) * T.tempEase;
    if (ready && --r.stepLeft <= 0) {
      if (r.step === 3) r.status = "running";
      else { r.step++; r.stepLeft = T.restartSteps[r.step]; }
    }
  } else {
    r.output = 0; r.fieldDraw = 0; r.temp += (0 - r.temp) * T.tempEase * 0.5;
  }
  r.fuel = clamp01(r.fuel); r.feed = clamp01(r.feed); r.field = clamp01(r.field); r.coolant = clamp01(r.coolant); r.temp = clamp01(r.temp); r.wear = clamp01(r.wear); r.output = clamp01(r.output); r.fieldDraw = clamp01(r.fieldDraw);
}
