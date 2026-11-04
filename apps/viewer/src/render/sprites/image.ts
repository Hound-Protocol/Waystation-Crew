import { OUT, mul, type RGB } from "./palette";

export class Img {
  data: Uint8ClampedArray;
  constructor(public w = 16, public h = 16) { this.data = new Uint8ClampedArray(w * h * 4); }
  px(x: number, y: number, c: RGB) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255; }
  alpha(x: number, y: number) { return this.data[(y * this.w + x) * 4 + 3]; }
  rect(x0: number, y0: number, x1: number, y1: number, c: RGB) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, c); }
  /** 3-tone box: light left edge, dark right and bottom edges. */
  box(x0: number, y0: number, x1: number, y1: number, base: RGB, hi?: RGB, dk?: RGB) {
    this.rect(x0, y0, x1, y1, base);
    const h = hi ?? mul(base, 1.35), d = dk ?? mul(base, 0.65);
    this.rect(x0, y0, x0, y1, h); this.rect(x1, y0, x1, y1, d); this.rect(x0, y1, x1, y1, d);
  }
  outline(col: RGB = OUT) {
    const src = this.data.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src[(y * this.w + x) * 4 + 3] !== 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && src[(ny * this.w + nx) * 4 + 3]) { this.px(x, y, col); break; }
      }
    }
    return this;
  }
}
