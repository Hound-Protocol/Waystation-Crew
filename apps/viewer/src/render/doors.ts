import { Container, Sprite, type Texture } from "pixi.js";
import { TILE } from "./tiles";
import { DOOR_FRAMES } from "./doorframes";

export { DOOR_FRAMES };
export const doorFrame = (open: number) => Math.min(DOOR_FRAMES - 1, Math.max(0, Math.round(open * (DOOR_FRAMES - 1))));

export interface Mover { x: number; y: number; vx?: number; vy?: number }

/** How far a door should be open for one character: fully when close, ramping up while heading toward it. */
function wanted(dx: number, dy: number, m: Mover): number {
  const d = Math.hypot(dx, dy);
  if (d < 0.9) return 1;
  if (d > 2.7) return 0;
  const sp = Math.hypot(m.vx ?? 0, m.vy ?? 0);
  if (sp < 0.2) return 0;
  const toward = ((m.vx ?? 0) * dx + (m.vy ?? 0) * dy) / (sp * d); // cos of angle between heading and door
  return toward > 0.8 ? Math.min(1, (2.7 - d) / 1.2) : 0;
}

/** Eased open amount (0..1) for each door; opens fast, closes slower. No rendering. */
export class DoorModel {
  open: number[];
  constructor(public doors: Array<{ x: number; y: number }>) { this.open = doors.map(() => 0); }
  update(dt: number, movers: Mover[]) {
    for (let i = 0; i < this.doors.length; i++) {
      const cx = this.doors[i].x + 0.5, cy = this.doors[i].y + 0.5;
      let target = 0;
      for (const m of movers) {
        const dx = cx - (m.x + 0.5), dy = cy - (m.y + 0.5);
        if (Math.abs(dx) > 2.8 || Math.abs(dy) > 2.8) continue;
        target = Math.max(target, wanted(dx, dy, m));
        if (target >= 1) break;
      }
      const rate = target > this.open[i] ? 12 : 4;
      this.open[i] += (target - this.open[i]) * (1 - Math.exp(-dt * rate));
      if (this.open[i] < 0.002) this.open[i] = 0;
    }
  }
}

/** Pixi sprites for each door tile, driven by a DoorModel. */
export class DoorLayer {
  readonly root = new Container();
  model = new DoorModel([]);
  private sprites: Sprite[] = [];
  private frames: number[] = [];
  private prev = new Map<number, { x: number; y: number }>();
  private vertical: boolean[] = [];
  constructor(private textures: Map<string, Texture>) {}
  reset(tiles: ArrayLike<number>, w: number, h: number, isVertical: (x: number, y: number) => boolean) {
    this.root.removeChildren(); this.sprites = []; this.frames = []; this.vertical = [];
    const doors: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (tiles[y * w + x] === 3) doors.push({ x, y });
    this.model = new DoorModel(doors);
    for (const d of doors) {
      const v = isVertical(d.x, d.y);
      const s = new Sprite(this.textures.get(`door:${v ? "v" : "h"}:0`)); s.position.set(d.x * TILE, d.y * TILE); s.tint = 0xa8a8a8;
      this.root.addChild(s); this.sprites.push(s); this.frames.push(0); this.vertical.push(v);
    }
  }
  update(dt: number, ids: number[], pos: (id: number) => { x: number; y: number } | null) {
    const movers: Mover[] = [];
    for (const id of ids) {
      const p = pos(id); if (!p) continue;
      const q = this.prev.get(id); const m: Mover = { x: p.x, y: p.y };
      if (q && dt > 0) { m.vx = (p.x - q.x) / dt; m.vy = (p.y - q.y) / dt; }
      this.prev.set(id, { x: p.x, y: p.y }); movers.push(m);
    }
    this.model.update(dt, movers);
    for (let i = 0; i < this.sprites.length; i++) {
      const f = doorFrame(this.model.open[i]);
      if (f !== this.frames[i]) { this.frames[i] = f; this.sprites[i].texture = this.textures.get(`door:${this.vertical[i] ? "v" : "h"}:${f}`)!; }
    }
  }
}
