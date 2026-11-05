/**
 * Render clock: advances at exactly sim speed every frame, with only a very gentle correction toward
 * (latest - lead), so the once-per-second arrival of data never causes speed surges. Never passes the
 * newest data; snaps forward only after a long gap (e.g. a hidden tab).
 */
export class ClockSync {
  constructor(public t: number) {}
  /** Start already one lead behind the newest data, so there is always path ahead of the render position. */
  reset(tick: number, speed = 1) { this.t = tick - (1.5 + speed * 0.1); }
  update(dt: number, latest: number, speed: number, paused: boolean): number {
    if (paused) return this.t;
    const lead = 1.5 + speed * 0.1;
    if (latest - this.t > lead * 3 + 60) { this.t = Math.max(this.t, latest - lead); return this.t; }
    const err = latest - lead - this.t; // >0: we are too far behind
    // within +-3 ticks: at most +-8% speed; beyond that, catch up (or ease back) faster
    const adj = Math.max(-0.08, Math.min(0.08, 0.15 * err)) + (Math.abs(err) > 3 ? 0.15 * (err - Math.sign(err) * 3) : 0);
    const rate = Math.max(0, speed * (1 + Math.max(-0.5, Math.min(2, adj))));
    this.t = Math.min(latest, this.t + rate * dt);
    return this.t;
  }
}
