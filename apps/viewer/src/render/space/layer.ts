import { Container, Sprite, Texture, TilingSprite } from "pixi.js";
import { createRng } from "@wc/sim-core";

function tex(c: HTMLCanvasElement): Texture {
  const t = Texture.from(c); t.source.scaleMode = "nearest"; return t;
}
function starCanvas(seed: number, n: number, size: number, colors: string[]): HTMLCanvasElement {
  const r = createRng(seed), c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  for (let i = 0; i < n; i++) { g.fillStyle = colors[r.int(0, colors.length - 1)]; g.fillRect(r.int(0, size - 1), r.int(0, size - 1), 1, 1); }
  return c;
}

/** Screen-space backdrop: three parallax star layers. Fades in. */
export class SpaceLayer {
  readonly root = new Container();
  private stars: Array<{ s: TilingSprite; k: number }> = [];
  private fade = 0;
  constructor() {
    const defs: Array<[number, number, number, string[]]> = [
      [1, 260, 512, ["#2a3350", "#39426a"]], [2, 140, 512, ["#56628f", "#7a86b3"]], [3, 60, 512, ["#cfe0ff", "#ffffff", "#ffe9b0"]],
    ];
    defs.forEach(([seed, n, size, cols], i) => {
      const s = new TilingSprite({ texture: tex(starCanvas(seed, n, size, cols)), width: 1, height: 1 });
      this.root.addChild(s); this.stars.push({ s, k: 0.012 * (i + 1) });
    });
    this.root.alpha = 0;
  }
  update(dt: number, camTx: number, camTy: number, w: number, h: number) {
    this.fade = Math.min(1, this.fade + dt / 0.8); // soft fade-in, no pop
    this.root.alpha = this.fade * this.fade * (3 - 2 * this.fade);
    for (const { s, k } of this.stars) { s.width = w; s.height = h; s.tilePosition.set(Math.round(camTx * k), Math.round(camTy * k)); }
  }
}
