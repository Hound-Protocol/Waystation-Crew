import { shipPhase, liftoffIn, arrivalIn } from "@wc/sim-core";

/** What the overview card shows for the thing under the reticle. Pure data, so it is testable; the card below only displays it. */
export interface BodyInfo { name: string; kind: "Planet" | "Star"; /** tiles from the station */ distance: number }
export interface OverviewCtx {
  stationName: string; crew: number; clock: string;
  /** the ship's own clock (render tick minus its slip) */
  shipTick: number; slip: number; holding: boolean; aboard: number;
  bodies: Map<string, BodyInfo>;
}
export interface OverviewData { id: string; kind: string; title: string; rows: [string, string][] }

export const mmss = (ticks: number) => { const s = Math.max(0, Math.round(ticks)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const PREP_LABEL: Record<string, string> = { "gate-closing": "Gate closing", restraining: "Restraining", locked: "Locked for flight", burn: "Burn", releasing: "Releasing" };

function shipRows(c: OverviewCtx): [string, string][] {
  const p = shipPhase(c.shipTick), rows: [string, string][] = [];
  const status = p.phase === "docked" ? "Docked" : p.phase === "landed" ? "On the pad" : p.phase === "flight" ? `In flight, ${p.leg === "out" ? "to the planet" : "to the station"}` : (PREP_LABEL[p.phase] ?? p.phase);
  rows.push(["Status", c.holding ? "Docked, waiting for pilots" : status]);
  const arrive = arrivalIn(c.shipTick);
  rows.push(arrive !== null ? ["Arrives in", mmss(arrive)] : ["Lift-off in", mmss(liftoffIn(c.shipTick))]);
  rows.push(["Aboard", String(c.aboard)]);
  if (c.slip > 0) rows.push(["Delay", mmss(c.slip)]);
  return rows;
}

export function overviewFor(id: string, c: OverviewCtx): OverviewData {
  if (id === "ship") return { id, kind: "Cargo ship", title: "Cargo ship", rows: shipRows(c) };
  if (id === "station") {
    const p = shipPhase(c.shipTick);
    const ship = c.holding ? "Waiting for pilots" : p.at === "station" ? "Docked" : p.phase === "flight" ? "In flight" : "On the pad";
    return { id, kind: "Station", title: c.stationName, rows: [["Crew", String(c.crew)], ["Time", c.clock], ["Ship", ship]] };
  }
  const b = c.bodies.get(id.replace(/^body:/, ""));
  return { id, kind: b?.kind ?? "Body", title: b?.name ?? "Unknown", rows: b ? [["Distance", `${Math.round(b.distance).toLocaleString("en-US")} tiles`]] : [] };
}

/** The 16:9 card at the bottom of the screen. It eases in and out, lingers briefly when the reticle slips off, and cross-fades between targets (no pop-ins). */
export class OverviewCard {
  private el = document.createElement("div");
  private kindEl = document.createElement("div"); private titleEl = document.createElement("div"); private rowsEl = document.createElement("div");
  private shown: string | null = null; private on = false; private linger = 0; private swap = 0; private pending: OverviewData | null = null; private lastRows = "";
  constructor(parent: HTMLElement) {
    this.el.id = "overview"; this.kindEl.className = "ov-kind"; this.titleEl.className = "ov-title"; this.rowsEl.className = "ov-rows";
    this.el.append(this.kindEl, this.titleEl, this.rowsEl); parent.appendChild(this.el);
  }
  private fill(d: OverviewData) {
    this.kindEl.textContent = d.kind; this.titleEl.textContent = d.title;
    const html = d.rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join(""); if (html !== this.lastRows) { this.rowsEl.innerHTML = html; this.lastRows = html; }
  }
  private show(on: boolean) { if (on !== this.on) { this.on = on; this.el.classList.toggle("on", on); } }
  update(dt: number, data: OverviewData | null) {
    if (this.swap > 0) { this.swap -= dt; if (this.swap <= 0 && this.pending) { this.fill(this.pending); this.shown = this.pending.id; this.show(true); this.pending = null; } return; }
    if (data) {
      this.linger = 0;
      if (!this.on && this.shown === null) { this.fill(data); this.shown = data.id; this.show(true); }
      else if (data.id !== this.shown) { this.show(false); this.pending = data; this.swap = 0.2; }
      else { this.fill(data); this.show(true); }
    } else if (this.on) {
      this.linger += dt; if (this.linger > 0.35) { this.show(false); this.shown = null; }
    }
  }
}
