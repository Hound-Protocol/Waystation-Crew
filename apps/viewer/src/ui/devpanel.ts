import type { ClientMsg, CharSnap } from "@wc/protocol";

const DEPTS = ["Command", "Engineering", "Medical", "Security", "Supply", "Service", "Flight"];
const STATES = ["idle", "walking", "eating", "sleeping", "relaxing", "working"];

export interface DevPanelOpts { send: (m: ClientMsg) => void; onSelect: (id: number) => void }

const CSS = `
#devtoggle{position:fixed;right:8px;top:6px;z-index:11;background:#10151c;color:#4de1ff;border:1px solid #28445a;font:11px ui-monospace,monospace;padding:4px 8px;cursor:pointer}
#dev{position:fixed;right:0;top:30px;bottom:0;width:min(300px,86vw);z-index:10;background:rgba(10,13,18,.93);border-left:1px solid #28445a;color:#9fb4c4;font:11px/1.35 ui-monospace,monospace;display:flex;flex-direction:column;gap:6px;padding:8px;box-sizing:border-box;opacity:0;visibility:hidden;transform:translateX(16px);transition:opacity .22s ease,transform .22s ease,visibility 0s linear .22s}
#dev.open{opacity:1;visibility:visible;transform:none;transition:opacity .22s ease,transform .22s ease,visibility 0s}
#dev button,#dev select,#dev input{background:#161d27;color:#cfe3f0;border:1px solid #2c3f52;font:inherit;padding:3px 6px}
#dev button{cursor:pointer}#dev button:hover{border-color:#4de1ff}
#dev .row{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
#dev .list{flex:1;min-height:80px;overflow:auto;border:1px solid #1e2b38}
#dev .item{padding:2px 6px;cursor:pointer;white-space:nowrap;transition:background .15s ease,color .15s ease}#dev .item:hover{background:#18222e}#dev .item.sel{background:#1d3a4a;color:#fff}
#dev pre{margin:0;max-height:34vh;overflow:auto;white-space:pre-wrap;color:#b9d2e2;border:1px solid #1e2b38;padding:4px}
#dev h4{margin:2px 0;color:#4de1ff;font-weight:normal}`;

export class DevPanel {
  private el: HTMLElement; private list: HTMLElement; private insp: HTMLElement; private search: HTMLInputElement;
  private chars: CharSnap[] = []; private states = new Map<number, number>(); private selected: number | null = null;
  private pauseBtn: HTMLButtonElement; private lastRender = 0;
  constructor(private o: DevPanelOpts) {
    const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    const toggle = document.createElement("button"); toggle.id = "devtoggle"; toggle.textContent = "dev"; document.body.appendChild(toggle);
    this.el = document.createElement("div"); this.el.id = "dev";
    this.el.innerHTML = `<h4>Dev panel (\` to toggle)</h4>
      <div class="row"><button data-a="pause">pause / play</button>${[1, 10, 60, 600].map((s) => `<button data-speed="${s}">${s}x</button>`).join("")}</div>
      <div class="row"><select data-f="dept">${DEPTS.map((d, i) => `<option value="${i}">${d}</option>`).join("")}</select>
        <input data-f="count" type="number" value="5" min="1" max="500" style="width:56px"><button data-a="spawn">spawn</button></div>
      <div class="row"><input data-f="seed" type="number" value="1" style="width:70px"><button data-a="reset">reset seed</button></div>
      <input data-f="search" placeholder="search crew…"><div class="list"></div><h4>Inspector</h4><pre>Select a character</pre>`;
    document.body.appendChild(this.el);
    this.list = this.el.querySelector(".list")!; this.insp = this.el.querySelector("pre")!;
    this.search = this.el.querySelector('[data-f="search"]')!; this.pauseBtn = this.el.querySelector('[data-a="pause"]')!;
    toggle.onclick = () => this.el.classList.toggle("open");
    window.addEventListener("keydown", (e) => { if (e.key === "`") this.el.classList.toggle("open"); });
    this.search.oninput = () => this.render();
    this.el.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const speed = t.getAttribute("data-speed"); if (speed) o.send({ t: "devCmd", cmd: { c: "speed", mult: +speed } });
      const a = t.getAttribute("data-a");
      const val = (f: string) => +(this.el.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value;
      if (a === "pause") o.send({ t: "devCmd", cmd: { c: "pause" } });
      if (a === "spawn") o.send({ t: "devCmd", cmd: { c: "spawn", count: Math.max(1, Math.min(500, val("count") | 0)), dept: val("dept") } });
      if (a === "reset") o.send({ t: "devCmd", cmd: { c: "reset", seed: val("seed") | 0 } });
    });
    // select on pointerdown: the list re-renders as states change, which would swallow a click
    this.list.addEventListener("pointerdown", (e) => {
      const id = (e.target as HTMLElement).getAttribute("data-id");
      if (id !== null) { this.select(+id); o.onSelect(+id); }
    });
  }
  setChars(chars: CharSnap[]) { this.chars = chars; this.states.clear(); for (const c of chars) this.states.set(c.id, c.state); this.render(); }
  updateStates(s: Array<{ id: number; state: number }>) {
    for (const x of s) this.states.set(x.id, x.state);
    const now = performance.now();
    if (now - this.lastRender > 700) this.render();
  }
  setClock(paused: boolean) { this.pauseBtn.textContent = paused ? "play ▶" : "pause ❚❚"; }
  select(id: number | null) { this.selected = id; if (id === null) this.insp.textContent = "Select a character"; this.render(); }
  setInspect(lines: string[]) { this.insp.textContent = lines.join("\n"); }
  private render() {
    if (!this.el.classList.contains("open")) return;
    this.lastRender = performance.now();
    const q = this.search.value.trim().toLowerCase();
    const rows = this.chars.filter((c) => !q || c.name.toLowerCase().includes(q) || DEPTS[c.dept].toLowerCase().includes(q)).slice(0, 300);
    // keyed diff: reuse row elements so nothing is torn down and rebuilt (no flicker, no lost hover)
    const have = new Map<string, HTMLElement>();
    for (const el of Array.from(this.list.children) as HTMLElement[]) have.set(el.dataset.id ?? "", el);
    let prev: Element | null = null;
    for (const c of rows) {
      const key = String(c.id);
      let el = have.get(key);
      if (el) have.delete(key); else { el = document.createElement("div"); el.className = "item"; el.dataset.id = key; }
      const text = `${c.name} · ${DEPTS[c.dept]} · ${STATES[this.states.get(c.id) ?? 0]}`;
      if (el.textContent !== text) el.textContent = text;
      el.classList.toggle("sel", c.id === this.selected);
      const want: Element | null = prev ? prev.nextElementSibling : this.list.firstElementChild;
      if (want !== el) this.list.insertBefore(el, want);
      prev = el;
    }
    for (const el of have.values()) el.remove();
  }
}
