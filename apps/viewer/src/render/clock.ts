/**
 * Smooth render clock: advances every frame at sim speed and gently chases (latest - lead),
 * so periodic delta arrivals never cause stalls or jumps. Never passes the newest data.
 */
export class ClockSync {
  constructor(public t: number) {}
  reset(t: number) { this.t = t; }
  update(dt: number, latest: number, speed: number, paused: boolean): number {
    if (paused) return this.t;
    const lead = 1 + speed * 0.12;
    const target = latest - lead;
    if (latest - this.t > lead * 3 + 60) { this.t = Math.max(this.t, latest - lead); return this.t; }
    const rate = Math.max(0.15 * speed, speed + 3 * (target - this.t));
    this.t = Math.min(latest, this.t + rate * dt);
    return this.t;
  }
}
