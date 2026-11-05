import { mmss } from "./overview";
import { MOOD_KEYS, type StationView } from "./stationview";

const DEPT_COLORS = ["#ffd24d", "#ff9a4d", "#ff6b8b", "#6ba6ff", "#b48cff", "#5fe3a1", "#4de1ff"];
const MOOD_LABEL: Record<string, string> = { hunger: "Fed", energy: "Rested", social: "Social", hygiene: "Clean", fun: "Fun" };
const HISTORY = 60, SAMPLE_EVERY = 2;   // seconds between sparkline samples, points kept
const SVG = "http://www.w3.org/2000/svg";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", parent?: HTMLElement) => { const e = document.createElement(tag); if (cls) e.className = cls; parent?.appendChild(e); return e; };
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Rolling line of recent values, drawn as an SVG polyline that eases between samples (the viewBox slides). */
class Spark {
  readonly svg = document.createElementNS(SVG, "svg"); private line = document.createElementNS(SVG, "polyline"); private area = document.createElementNS(SVG, "polygon");
  private vals: number[] = [];
  constructor(parent: HTMLElement, private color: string) {
    this.svg.setAttribute("viewBox", `0 0 ${HISTORY - 1} 20`); this.svg.setAttribute("preserveAspectRatio", "none"); this.svg.classList.add("spark");
    this.area.setAttribute("fill", color); this.area.setAttribute("opacity", "0.14"); this.line.setAttribute("fill", "none"); this.line.setAttribute("stroke", color);
    this.line.setAttribute("stroke-width", "1.4"); this.line.setAttribute("vector-effect", "non-scaling-stroke"); this.svg.append(this.area, this.line); parent.appendChild(this.svg);
  }
  push(v: number) {
    this.vals.push(v); if (this.vals.length > HISTORY) this.vals.shift();
    const off = HISTORY - this.vals.length, pts = this.vals.map((x, i) => `${off + i},${(19 - Math.min(1, Math.max(0, x)) * 18).toFixed(2)}`);
    this.line.setAttribute("points", pts.join(" "));
    this.area.setAttribute("points", `${off},20 ${pts.join(" ")} ${HISTORY - 1},20`);
  }
}

class Bar {
  readonly row = el("div", "sc-bar"); private fill = el("i", "", el("div", "sc-track", this.row)); private val = el("b", "", this.row);
  constructor(parent: HTMLElement, label: string, color: string) { const l = el("span", "", this.row); l.textContent = label; this.row.insertBefore(l, this.row.firstChild); this.fill.style.background = color; parent.appendChild(this.row); }
  set(v: number, text = pct(v)) { this.fill.style.transform = `scaleX(${Math.min(1, Math.max(0, v))})`; if (this.val.textContent !== text) this.val.textContent = text; }
}

/** The glass HUD shown for the station: crew by department, mood, power and lighting, the ship, and station facts. Nodes are built once and updated in place; bars ease through CSS. */
export class StationCard {
  private root = el("div"); private on = false; private linger = 0; private sample = 0;
  private title = el("div", "sc-title"); private sub = el("div", "sc-sub");
  private stack = el("div", "sc-stack"); private legend: HTMLElement[] = []; private legendText: HTMLElement[] = [];
  private actVals: HTMLElement[] = []; private moodBars: Bar[] = []; private moodAvg = el("b"); private moodSpark!: Spark;
  private litBar!: Bar; private litSpark!: Spark; private lightVals: Record<string, HTMLElement> = {};
  private shipStatus = el("div", "sc-status"); private shipBar!: Bar; private shipNext = el("b"); private shipAboard = el("b"); private shipDelayRow = el("div", "sc-kv");  private shipDelay = el("b");
  private growBar!: Bar; private factVals: Record<string, HTMLElement> = {};

  constructor(parent: HTMLElement) {
    this.root.id = "station-card";
    const head = el("div", "sc-head", this.root); head.append(this.title, this.sub);
    const grid = el("div", "sc-grid", this.root);

    const crew = el("section", "sc-sec sc-crew", grid); el("h4", "", crew).textContent = "Crew";
    this.stack.className = "sc-stack"; crew.appendChild(this.stack);
    const leg = el("div", "sc-legend", crew);
    for (const c of DEPT_COLORS) { const seg = el("span", "", this.stack); seg.style.background = c; this.legend.push(seg); const l = el("em", "", leg); l.style.setProperty("--c", c); this.legendText.push(l); }
    const acts = el("div", "sc-acts", crew);
    for (let i = 0; i < 5; i++) { const a = el("div", "sc-kv", acts); el("span", "", a); this.actVals.push(el("b", "", a)); }

    const mood = el("section", "sc-sec", grid); const mh = el("h4", "", mood); mh.textContent = "Mood "; mh.appendChild(this.moodAvg);
    for (const k of MOOD_KEYS) this.moodBars.push(new Bar(mood, MOOD_LABEL[k], "linear-gradient(90deg,#4de1ff,#5fe3a1)"));
    this.moodSpark = new Spark(mood, "#5fe3a1");

    const lights = el("section", "sc-sec", grid); el("h4", "", lights).textContent = "Power & lighting";
    this.litBar = new Bar(lights, "Lit", "linear-gradient(90deg,#ffb84d,#ffe58a)"); this.litSpark = new Spark(lights, "#ffd24d");
    const lk = el("div", "sc-kvs", lights);
    for (const [key, label] of [["lamps", "Lamps"], ["dark", "Dark tiles"], ["orders", "Orders"], ["built", "Built"]] as const) { const r = el("div", "sc-kv", lk); el("span", "", r).textContent = label; this.lightVals[key] = el("b", "", r); }

    const ship = el("section", "sc-sec", grid); el("h4", "", ship).textContent = "Ship"; ship.appendChild(this.shipStatus);
    this.shipBar = new Bar(ship, "Cycle", "linear-gradient(90deg,#4de1ff,#6ba6ff)");
    const sr = el("div", "sc-kv", ship); this.shipNextLabel = el("span", "", sr); sr.appendChild(this.shipNext);
    const ar = el("div", "sc-kv", ship); el("span", "", ar).textContent = "Aboard"; ar.appendChild(this.shipAboard);
    this.shipDelayRow.className = "sc-kv"; el("span", "", this.shipDelayRow).textContent = "Delay"; this.shipDelayRow.appendChild(this.shipDelay); ship.appendChild(this.shipDelayRow);

    const facts = el("section", "sc-sec", grid); el("h4", "", facts).textContent = "Station";
    for (const [key, label] of [["rooms", "Rooms"], ["footprint", "Footprint"], ["day", "Day"]] as const) { const r = el("div", "sc-kv", facts); el("span", "", r).textContent = label; this.factVals[key] = el("b", "", r); }
    this.growBar = new Bar(facts, "Growth", "linear-gradient(90deg,#b48cff,#6ba6ff)");
    parent.appendChild(this.root);
  }
  private shipNextLabel!: HTMLElement;

  private fill(v: StationView) {
    this.title.textContent = v.title; this.sub.textContent = `Day ${v.day}`;
    v.depts.forEach((d, i) => { this.legend[i].style.flexGrow = String(d.share); this.legend[i].style.display = d.count ? "" : "none"; });
    v.depts.forEach((d, i) => { const t = `${d.name} ${d.count}`; if (this.legendText[i].textContent !== t) this.legendText[i].textContent = t; });
    v.activity.forEach((a, i) => { const row = this.actVals[i].parentElement!; (row.firstChild as HTMLElement).textContent = a.label; const t = String(a.count); if (this.actVals[i].textContent !== t) this.actVals[i].textContent = t; });
    v.mood.items.forEach((m, i) => this.moodBars[i].set(m.value)); this.moodAvg.textContent = pct(v.mood.avg);
    this.litBar.set(v.lights.litShare);
    for (const k of ["lamps", "dark", "orders", "built"] as const) { const t = String(v.lights[k]); if (this.lightVals[k].textContent !== t) this.lightVals[k].textContent = t; }
    this.shipStatus.textContent = v.ship.status; this.shipBar.set(v.ship.progress, ""); this.shipNextLabel.textContent = v.ship.nextLabel;
    this.shipNext.textContent = mmss(v.ship.next); this.shipAboard.textContent = String(v.ship.aboard);
    this.shipDelayRow.style.display = v.ship.delay > 0 ? "" : "none"; this.shipDelay.textContent = mmss(v.ship.delay);
    this.factVals.rooms.textContent = String(v.facts.rooms); this.factVals.footprint.textContent = `${v.facts.footprint.toLocaleString("en-US")} tiles`; this.factVals.day.textContent = String(v.facts.day);
    this.growBar.set(v.facts.growth);
  }
  private show(on: boolean) { if (on !== this.on) { this.on = on; this.root.classList.toggle("on", on); } }

  update(dt: number, view: StationView | null) {
    if (view) {
      this.linger = 0; this.fill(view); this.show(true);
    } else if (this.on) { this.linger += dt; if (this.linger > 0.35) this.show(false); }
  }
  /** called every frame with the live view, shown or not, so the sparklines already have history when the card opens */
  record(dt: number, view: StationView) { this.sample += dt; if (this.sample >= SAMPLE_EVERY) { this.sample = 0; this.moodSpark.push(view.mood.avg); this.litSpark.push(view.lights.litShare); } }
}
