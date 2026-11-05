import type { Profile } from "@wc/protocol";

const NEEDS: Array<[keyof Profile["needs"], string]> = [["hunger", "FOOD"], ["energy", "ENERGY"], ["social", "SOCIAL"], ["fun", "MORALE"]];
const SHIFT_HOURS = { day: "06-14", swing: "14-22", night: "22-06" } as const;

const CSS = `
#pda{position:fixed;left:12px;top:50%;z-index:9;width:min(250px,68vw);transform:translate(-120%,-50%) rotate(-3deg);opacity:0;visibility:hidden;
 transition:transform .45s cubic-bezier(.2,.9,.25,1.05),opacity .3s ease,visibility 0s linear .45s;filter:drop-shadow(0 10px 18px rgba(0,0,0,.55))}
#pda.open{transform:translate(0,-50%) rotate(0);opacity:1;visibility:visible;transition:transform .45s cubic-bezier(.2,.9,.25,1.05),opacity .3s ease,visibility 0s}
#pda .body{position:relative;background:linear-gradient(160deg,#3a4350,#232a33 55%,#1b2027);border:2px solid #0e1116;border-radius:18px 18px 26px 26px;padding:14px 12px 12px;box-shadow:inset 0 0 0 2px #4a5563,inset 0 -6px 10px rgba(0,0,0,.35)}
#pda .body:before{content:"";position:absolute;left:22px;top:-10px;width:9px;height:12px;background:#2c333d;border:2px solid #0e1116;border-bottom:0;border-radius:3px 3px 0 0}
#pda .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font:9px ui-monospace,monospace;color:#7d8a99;letter-spacing:.12em}
#pda .led{width:7px;height:7px;border-radius:50%;background:#5dffa0;box-shadow:0 0 6px #5dffa0;animation:pdaled 2.4s ease-in-out infinite}
@keyframes pdaled{50%{opacity:.35}}
#pda .x{background:#2a313b;color:#9fb0c2;border:1px solid #0e1116;border-radius:4px;font:10px ui-monospace,monospace;padding:1px 6px;cursor:pointer;transition:background .15s,color .15s}#pda .x:hover{background:#3b4654;color:#fff}
#pda .screen{position:relative;background:#06130f;border:2px solid #0a0d11;border-radius:6px;padding:8px 9px;color:#6dffb4;font:10.5px/1.35 ui-monospace,monospace;text-shadow:0 0 4px rgba(93,255,160,.55);box-shadow:inset 0 0 18px rgba(0,0,0,.8),inset 0 0 0 1px #12382a;overflow:hidden;min-height:330px}
#pda .screen:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px)}
#pda .nm{font-size:13px;color:#d2ffe8;letter-spacing:.04em}#pda .sub{color:#43b884}
#pda hr{border:0;border-top:1px dashed #1f6a4b;margin:6px 0}
#pda .lbl{color:#43b884;font-size:9px;letter-spacing:.14em;margin-bottom:2px}
#pda .act{color:#fff;display:flex;gap:6px;align-items:baseline}#pda .act i{width:6px;height:6px;border-radius:50%;background:#6dffb4;display:inline-block;animation:pdaled 1.2s ease-in-out infinite}
#pda .bar{display:flex;align-items:center;gap:6px;margin:2px 0}#pda .bar span{width:48px;color:#43b884}
#pda .bar b{flex:1;height:7px;background:#0c2a20;border:1px solid #1f6a4b;position:relative}
#pda .bar b i{position:absolute;left:0;top:0;bottom:0;background:#6dffb4;width:0;transition:width .8s ease,background .6s ease}
#pda .bar b i.mid{background:#ffd75d}#pda .bar b i.low{background:#ff6a6a}
#pda .tag{display:inline-block;border:1px solid currentColor;padding:0 4px;margin-left:4px;font-size:9px}
#pda .on{color:#6dffb4}#pda .off{color:#ffd75d}#pda .bad{color:#ff6a6a}
#pda .th{color:#a9e8c9;margin:2px 0;transition:opacity .3s}
#pda .btns{display:flex;justify-content:center;gap:10px;margin-top:9px}#pda .btns u{width:26px;height:8px;border-radius:4px;background:#161b22;border:1px solid #0e1116;box-shadow:inset 0 1px 0 #3a4350}`;

/** Handheld PDA on the left: live status of the selected character. Slides in and out; values ease, nothing pops. */
export class Pda {
  private el: HTMLElement; private screen: HTMLElement; private bars = new Map<string, HTMLElement>(); private built = false;
  private text = new Map<string, HTMLElement>();
  constructor(private onClose: () => void) {
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    this.el = document.createElement("div"); this.el.id = "pda";
    this.el.innerHTML = `<div class="body"><div class="top"><span><span class="led" style="display:inline-block"></span> CREW-PDA</span><button class="x">✕</button></div><div class="screen"></div><div class="btns"><u></u><u></u><u></u></div></div>`;
    document.body.appendChild(this.el);
    this.screen = this.el.querySelector(".screen")!;
    (this.el.querySelector(".x") as HTMLElement).onclick = () => onClose();
  }
  private build() {
    this.screen.innerHTML = `<div class="nm" data-t="name"></div><div class="sub" data-t="role"></div><hr>
      <div class="lbl">STATUS</div><div class="act"><i></i><span data-t="activity"></span></div><div class="sub" data-t="place"></div><div>CONDITION <span data-t="cond" class="tag"></span></div><hr>
      <div class="lbl">NEEDS</div>${NEEDS.map(([k, n]) => `<div class="bar"><span>${n}</span><b><i data-b="${k}"></i></b></div>`).join("")}<hr>
      <div class="lbl">DUTY</div><div data-t="job"></div><div class="sub" data-t="shift"></div><hr>
      <div class="lbl">THINKING</div><div data-t="th0" class="th"></div><div data-t="th1" class="th"></div><div data-t="th2" class="th"></div>`;
    this.screen.querySelectorAll<HTMLElement>("[data-b]").forEach((e) => this.bars.set(e.dataset.b!, e));
    this.screen.querySelectorAll<HTMLElement>("[data-t]").forEach((e) => this.text.set(e.dataset.t!, e));
    this.built = true;
  }
  private set(k: string, v: string, cls?: string) {
    const e = this.text.get(k)!; if (e.textContent !== v) e.textContent = v;
    if (cls !== undefined && e.dataset.c !== cls) { e.dataset.c = cls; e.classList.remove("on", "off", "bad"); if (cls) e.classList.add(cls); }
  }
  get isOpen() { return this.el.classList.contains("open"); }
  show() { this.el.classList.add("open"); }
  hide() { this.el.classList.remove("open"); }
  update(p: Profile) {
    if (!this.built) this.build();
    this.set("name", p.name.toUpperCase()); this.set("role", `${p.rank} · ${p.dept} · #${String(p.id).padStart(4, "0")}`);
    this.set("activity", p.activity); this.set("place", `@ ${p.place}`);
    this.set("cond", p.condition.toUpperCase(), p.condition === "Fine" ? "on" : /Starving|Exhausted|Isolated|Restless/.test(p.condition) ? "bad" : "off");
    for (const [k] of NEEDS) { const v = p.needs[k], b = this.bars.get(k)!; b.style.width = `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`; b.className = v < 0.2 ? "low" : v < 0.5 ? "mid" : ""; }
    if (p.job) {
      this.set("job", `${p.job.dept} · ${p.job.room}`); this.set("shift", `${p.job.shift} shift ${SHIFT_HOURS[p.job.shift]} · ${p.job.onShift ? "ON DUTY" : "off duty"}`, p.job.onShift ? "on" : "off");
    } else { this.set("job", "No assigned post"); this.set("shift", `station ${p.shiftNow} shift`, ""); }
    for (let i = 0; i < 3; i++) this.set(`th${i}`, p.thoughts[i] ? `> ${p.thoughts[i]}` : "");
  }
}
