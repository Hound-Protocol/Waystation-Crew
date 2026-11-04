import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { createRng } from "@wc/sim-core";
import { PLANETS, renderPlanet } from "./planet";

function tex(c: HTMLCanvasElement): Texture {
  const t = Texture.from(c); t.source.scaleMode = "nearest"; return t;
}
function starCanvas(seed: number, n: number, size: number, colors: string[]): HTMLCanvasElement {
  const r = createRng(seed), c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  for (let i = 0; i < n; i++) { g.fillStyle = colors[r.int(0, colors.length - 1)]; g.fillRect(r.int(0, size - 1), r.int(0, size - 1), 1, 1); }
  return c;
}
function planetCanvas(i: number): HTMLCanvasElement {
  const p = renderPlanet(PLANETS[i]);
  const c = document.createElement("canvas"); c.width = c.height = p.size;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.size, p.size), 0, 0);
  return c;
}

/** Screen-space backdrop: three parallax star layers + slow-drifting planets. Fades in. */
export class SpaceLayer {
  readonly root = new Container();
  private stars: Array<{ s: TilingSprite; k: number }> = [];
  private planets: Array<{ s: Sprite; k: number; fx: number; fy: number; drift: number }> = [];
  private fade = 0;
  constructor() {
    const defs: Array<[number, number, number, string[]]> = [
      [1, 260, 512, ["#2a3350", "#39426a"]], [2, 140, 512, ["#56628f", "#7a86b3"]], [3, 60, 512, ["#cfe0ff", "#ffffff", "#ffe9b0"]],
    ];
    defs.forEach(([seed, n, size, cols], i) => {
      const s = new TilingSprite({ texture: tex(starCanvas(seed, n, size, cols)), width: 1, height: 1 });
      this.root.addChild(s); this.stars.push({ s, k: 0.012 * (i + 1) });
    });
    // fx, fy: where the planet sits in the view (0..1); k: parallax; scale: size on screen
    const placed: Array<[number, number, number, number, number]> = [[0, 0.82, 0.22, 0.05, 3], [1, 0.12, 0.78, 0.035, 3], [2, 0.34, 0.14, 0.08, 2], [3, 0.9, 0.86, 0.03, 2]];
    for (const [i, fx, fy, k, sc] of placed) {
      const s = new Sprite(tex(planetCanvas(i))); s.anchor.set(0.5); s.scale.set(sc);
      this.root.addChild(s); this.planets.push({ s, k, fx, fy, drift: 0.4 + i * 0.15 });
    }
    this.root.alpha = 0;
  }
  update(dt: number, camTx: number, camTy: number, w: number, h: number) {
    this.fade = Math.min(1, this.fade + dt / 0.8); // soft fade-in, no pop
    this.root.alpha = this.fade * this.fade * (3 - 2 * this.fade);
    for (const { s, k } of this.stars) { s.width = w; s.height = h; s.tilePosition.set(Math.round(camTx * k), Math.round(camTy * k)); }
    for (const p of this.planets) p.s.position.set(p.fx * w + camTx * p.k, p.fy * h + camTy * p.k);
  }
}
