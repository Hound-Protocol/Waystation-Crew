import { Img } from "./image";

/** Quarter turn clockwise: new(x,y) = old(y, 15-x) for a 16x16 image. */
export function rotate90(src: Img): Img {
  const out = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const sx = y, sy = src.w - 1 - x;
    const s = (sy * src.w + sx) * 4, d = (y * src.w + x) * 4;
    out.data[d] = src.data[s]; out.data[d + 1] = src.data[s + 1]; out.data[d + 2] = src.data[s + 2]; out.data[d + 3] = src.data[s + 3];
  }
  return out;
}

/** n quarter turns clockwise (0..3). */
export function rotateN(src: Img, n: number): Img {
  let im = src;
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) im = rotate90(im);
  return im;
}
