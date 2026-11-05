import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { PLANETS, renderPlanet } from "./planet";
import { BODIES, SUN_RADIUS, stationFrame } from "./system";
import { TILE } from "../tiles";

function tex(c: HTMLCanvasElement): Texture { const t = Texture.from(c); t.source.scaleMode = "nearest"; return t; }
function planetTexture(i: number): Texture {
  const p = renderPlanet(PLANETS[i]);
  const c = document.createElement("canvas"); c.width = c.height = p.size;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.size, p.size), 0, 0);
  return tex(c);
}
function sunTexture(): Texture {
  const N = 96, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d")!, m = N / 2;
  const glow = g.createRadialGradient(m, m, m * 0.45, m, m, m);
  glow.addColorStop(0, "rgba(255,200,90,0.55)"); glow.addColorStop(1, "rgba(255,150,40,0)");
  g.fillStyle = glow; g.fillRect(0, 0, N, N);
  const bands = ["#fff4c2", "#ffd966", "#ffb347", "#f08a24"];
  for (let i = 0; i < bands.length; i++) { g.fillStyle = bands[i]; g.beginPath(); g.arc(m, m, m * 0.45 * (1 - i * 0.14), 0, Math.PI * 2); g.fill(); }
  return tex(c);
}

/** The solar system in map coordinates: a sun and orbiting planets, one full circuit per sim day. Fades in. */
export class SolarLayer {
  readonly root = new Container();
  private orbits = new Graphics();
  private sun = new Sprite(sunTexture());
  private bodies: Sprite[] = [];
  private fade = 0;
  constructor() {
    this.root.addChild(this.orbits, this.sun);
    this.sun.anchor.set(0.5);
    this.sun.scale.set((SUN_RADIUS * 2 * TILE) / 96 / 0.9);
    for (const b of BODIES) {
      const s = new Sprite(planetTexture(b.planet)); s.anchor.set(0.5);
      s.scale.set((b.radius * 2 * TILE) / (s.texture.width * (PLANETS[b.planet].ring ? 1 / PLANETS[b.planet].ring!.outer : 1)));
      this.bodies.push(s); this.root.addChild(s);
    }
    this.root.alpha = 0;
  }
  /** tick: the render clock; scale: camera pixels per tile. */
  update(dt: number, tick: number, scale: number) {
    this.fade = Math.min(1, this.fade + dt / 1.2);
    this.root.alpha = this.fade * this.fade * (3 - 2 * this.fade);
    const f = stationFrame(tick);
    this.sun.position.set(f.sun.x * TILE, f.sun.y * TILE);
    BODIES.forEach((b, i) => { const p = f.body(b); this.bodies[i].position.set(p.x * TILE, p.y * TILE); });
    // orbit rings fade in as the view pulls back past the station
    const a = Math.max(0, Math.min(1, (3 - scale) / 2.5)) * 0.35;
    this.orbits.clear();
    if (a > 0.01) for (const b of BODIES) this.orbits.circle(f.sun.x * TILE, f.sun.y * TILE, b.orbit * TILE).stroke({ color: 0x8fa6d9, width: 1.5 / (scale / TILE), alpha: a });
  }
}
