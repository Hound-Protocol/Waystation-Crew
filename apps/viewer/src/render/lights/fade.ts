import type { LightSource } from "./types";

/** Seconds for a light to come in or go out. Nothing in the world pops: lamps built, rooms grown and lights removed all ease. */
export const FADE_SECONDS = 1;

interface Entry { light: LightSource; v: number; goal: 0 | 1 }

/** Per-light fade factors (0..1). Lights new to the set start at 0 and rise; lights gone from the set keep fading out and are then dropped; lights that stay are untouched. */
export class LightFade {
  private m = new Map<number, Entry>();

  /** `instant` skips the fade-in (used by tests). */
  sync(lights: readonly LightSource[], instant = false): void {
    const seen = new Set<number>();
    for (const l of lights) {
      seen.add(l.id);
      const e = this.m.get(l.id);
      if (e) { e.light = l; e.goal = 1; } else this.m.set(l.id, { light: l, v: instant ? 1 : 0, goal: 1 });
    }
    for (const [id, e] of this.m) if (!seen.has(id)) e.goal = 0;
  }

  step(dt: number): void {
    const d = dt / FADE_SECONDS;
    for (const [id, e] of this.m) {
      if (e.v < e.goal) e.v = Math.min(e.goal, e.v + d); else if (e.v > e.goal) e.v = Math.max(e.goal, e.v - d);
      if (e.goal === 0 && e.v <= 0) this.m.delete(id);
    }
  }

  entries(): Array<{ light: LightSource; f: number }> { return Array.from(this.m.values(), (e) => ({ light: e.light, f: e.v })); }
}
