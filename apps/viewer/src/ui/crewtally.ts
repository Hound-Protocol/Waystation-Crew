import { DEPARTMENT_NAMES } from "@wc/sim-core";

/** CharState values the card cares about (see sim-core ai/affordances). */
const EATING = 2, SLEEPING = 3, RELAXING = 4, WORKING = 5;

/** Keeps the crew's departments and current states so the station card can count them without rescanning snapshots. */
export class CrewTally {
  private dept = new Map<number, number>(); private state = new Map<number, number>();
  reset(chars: { id: number; dept: number; state: number }[]) {
    this.dept.clear(); this.state.clear();
    for (const c of chars) { this.dept.set(c.id, c.dept); this.state.set(c.id, c.state); }
  }
  setState(id: number, state: number) { if (this.state.has(id)) this.state.set(id, state); }
  deptCounts(): number[] {
    const out = DEPARTMENT_NAMES.map(() => 0);
    for (const d of this.dept.values()) if (d >= 0 && d < out.length) out[d]++;
    return out;
  }
  activity() {
    const a = { working: 0, eating: 0, sleeping: 0, relaxing: 0 };
    for (const s of this.state.values()) {
      if (s === WORKING) a.working++; else if (s === EATING) a.eating++; else if (s === SLEEPING) a.sleeping++; else if (s === RELAXING) a.relaxing++;
    }
    return a;
  }
}
