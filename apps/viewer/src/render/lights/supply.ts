/** How lit the station's lamps are when power is short. Pure, so it is testable; the light pass reads `gain` and `emergency` each frame. */
export const EMERGENCY_GAIN = 0.15;
/** Lamps tint toward this (r, g, b 0..255) in a blackout, when only the emergency lights are on. */
export const EMERGENCY_COLOR: readonly [number, number, number] = [255, 80, 60];
const RATE = 3;   // 1/s: about a second to settle, like every other light change

export class SupplyEase {
  /** multiplier on every lamp's intensity */ gain = 1;
  /** 0..1 how far the lamps have shifted to the emergency tint */ emergency = 0;
  private goalGain = 1; private goalEmergency = 0;
  /** `level` is the grid's supply level, 0..1: a brownout dims in proportion, 0 is a blackout. */
  set(level: number): void {
    const l = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 1));
    this.goalGain = l > 0 ? l : EMERGENCY_GAIN; this.goalEmergency = l > 0 ? 0 : 1;
  }
  step(dt: number): void {
    const k = 1 - Math.exp(-Math.max(0, dt) * RATE);
    this.gain += (this.goalGain - this.gain) * k; this.emergency += (this.goalEmergency - this.emergency) * k;
  }
}
