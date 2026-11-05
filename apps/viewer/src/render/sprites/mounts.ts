import { Img } from "./image";
import { hex, CYAN, ORANGE, GREENE, RED, LAMP, AMBER, ICE, SCR, WHT, LIME, type RGB } from "./palette";

const FR = hex("#14161a"), FRL = hex("#3a3f4a"), BLK = hex("#06090c");

/** Wall-mounted screen: frame at rows 5..10 of the wall face. */
function screen(bg: string, paint: (im: Img) => void): Img {
  const im = new Img();
  im.rect(2, 4, 13, 11, FR); im.rect(2, 4, 13, 4, FRL); im.rect(3, 5, 12, 10, BLK); im.rect(3, 5, 12, 10, hex(bg));
  paint(im); im.px(13, 11, GREENE);
  return im;
}
const px = (im: Img, c: RGB, ...p: Array<[number, number]>) => { for (const [x, y] of p) im.px(x, y, c); };
const plaque = (c: string, paint: (im: Img) => void): Img => { const im = new Img(); im.rect(4, 5, 11, 10, FR); im.rect(5, 6, 10, 9, hex(c)); paint(im); return im; };

export const MOUNTS: Record<string, () => Img> = {
  "wall:screen-board": () => screen("#0b1620", (im) => { for (const y of [6, 8, 10 - 1]) { im.rect(4, y, 6, y, AMBER); im.rect(8, y, 11, y, ICE); } }),
  "wall:screen-map": () => screen("#06202e", (im) => { im.rect(5, 6, 10, 9, hex("#0b3a58")); px(im, CYAN, [5, 7], [6, 6], [8, 6], [10, 7], [9, 9], [6, 9], [7, 8]); px(im, LAMP, [8, 8]); }),
  "wall:screen-graph": () => screen("#08170f", (im) => { px(im, GREENE, [4, 9], [5, 8], [6, 9], [7, 7], [8, 8], [9, 6], [10, 7], [11, 6]); im.rect(4, 10, 11, 10, hex("#1f7a4c")); }),
  "wall:screen-alert": () => screen("#2a0a0c", (im) => { im.rect(7, 6, 8, 6, RED); im.rect(6, 7, 9, 8, RED); im.rect(5, 9, 10, 9, RED); px(im, BLK, [7, 7], [8, 7], [7, 8], [8, 8]); }),
  "wall:screen-vitals": () => screen("#06202a", (im) => { px(im, GREENE, [4, 8], [5, 8], [6, 6], [7, 10], [8, 8], [9, 8], [10, 7], [11, 8]); px(im, RED, [4, 6], [5, 6]); }),
  "wall:screen-cams": () => screen("#14080a", (im) => { im.rect(4, 6, 7, 7, hex("#2a1a1d")); im.rect(8, 6, 11, 7, hex("#2a1a1d")); im.rect(4, 8, 7, 9, hex("#2a1a1d")); im.rect(8, 8, 11, 9, hex("#2a1a1d")); px(im, RED, [4, 6], [11, 9]); px(im, ICE, [6, 7], [9, 8]); }),
  "wall:screen-power": () => screen("#1c0f04", (im) => { im.rect(4, 8, 5, 10, ORANGE); im.rect(7, 6, 8, 10, ORANGE); im.rect(10, 7, 11, 10, LAMP); px(im, WHT, [6, 6], [9, 6]); }),
  "wall:screen-manifest": () => screen("#1c1606", (im) => { for (const y of [6, 8, 10]) im.rect(4, y, 11 - (y % 3), y, AMBER); }),
  "wall:screen-news": () => screen("#0a1230", (im) => { im.rect(4, 6, 11, 7, hex("#2a4fa0")); im.rect(4, 9, 9, 9, ICE); im.rect(4, 10, 11, 10, SCR); }),
  "wall:sign-arrivals": () => plaque("#0b2a4a", (im) => { px(im, CYAN, [7, 7], [8, 7], [6, 8], [9, 8], [7, 8], [8, 8], [8, 6]); }),
  "wall:sign-med": () => plaque("#e8edf0", (im) => { im.rect(7, 6, 8, 9, RED); im.rect(6, 7, 9, 8, RED); }),
  "wall:sign-sec": () => plaque("#2a0a0c", (im) => { im.rect(6, 6, 9, 8, RED); px(im, RED, [7, 9], [8, 9]); px(im, BLK, [7, 7], [8, 7]); }),
  "wall:sign-cargo": () => plaque("#2a2006", (im) => { im.rect(6, 7, 9, 9, AMBER); im.rect(6, 6, 9, 6, hex("#b8941f")); }),
  "wall:sign-hazard": () => { const im = new Img(); im.rect(3, 5, 12, 10, FR); for (let y = 6; y <= 9; y++) for (let x = 4; x <= 11; x++) im.px(x, y, (x + y) % 4 < 2 ? hex("#b8941f") : hex("#15171b")); return im; },
  "wall:sign-arrow": () => plaque("#10161c", (im) => { im.rect(6, 8, 10, 8, WHT); px(im, WHT, [9, 7], [9, 9], [10, 6 + 2]); }),
  "wall:clock": () => { const im = new Img(); im.rect(5, 4, 10, 11, FR); im.rect(4, 5, 11, 10, FR); im.rect(5, 5, 10, 10, hex("#cfd8dc")); px(im, BLK, [7, 6], [7, 7], [8, 8], [9, 8]); return im; },
  "wall:poster": () => { const im = new Img(); im.rect(4, 4, 11, 11, hex("#d8d2c0")); im.rect(5, 5, 10, 8, hex("#3a6a8a")); im.rect(5, 9, 10, 9, hex("#8a3a3a")); im.rect(5, 10, 8, 10, hex("#5a5a52")); return im; },
  "wall:poster-wanted": () => { const im = new Img(); im.rect(4, 4, 11, 11, hex("#cdb98a")); im.rect(6, 5, 9, 8, hex("#5a4a2a")); im.rect(5, 9, 10, 9, hex("#7a3a2a")); im.rect(6, 10, 9, 10, hex("#7a3a2a")); return im; },
  "wall:light": () => { const im = new Img(); im.rect(3, 4, 12, 6, hex("#14161a")); im.rect(4, 5, 11, 5, LAMP); im.rect(5, 6, 10, 6, hex("#fff3b0")); return im; },
  "wall:flag": () => { const im = new Img(); im.rect(4, 3, 11, 11, hex("#1b2c63")); im.rect(4, 3, 11, 3, hex("#c9a227")); im.rect(6, 6, 9, 8, hex("#c9a227")); px(im, hex("#1b2c63"), [7, 7], [8, 7]); im.rect(5, 11, 10, 11, hex("#c9a227")); return im; },
  "wall:medkit": () => { const im = new Img(); im.rect(4, 5, 11, 10, hex("#e8edf0")); im.rect(4, 5, 11, 5, hex("#b8c2c9")); im.rect(7, 6, 8, 9, RED); im.rect(6, 7, 9, 8, RED); return im; },
  "wall:chart": () => { const im = new Img(); im.rect(4, 4, 11, 11, hex("#e0e6ea")); for (const y of [6, 8, 10]) im.rect(5, y, 10, y, hex("#8e9aa3")); px(im, RED, [6, 7], [7, 6], [8, 8], [9, 7]); return im; },
  "wall:pipes": () => { const im = new Img(); for (const y of [5, 8]) { im.rect(0, y, 15, y + 1, hex("#6d7580")); im.rect(0, y, 15, y, hex("#aab5bc")); } im.rect(11, 5, 12, 10, hex("#8e9aa3")); px(im, AMBER, [11, 7]); return im; },
  "wall:vent": () => { const im = new Img(); im.rect(3, 5, 12, 10, FR); for (let y = 6; y <= 9; y++) im.rect(4, y, 11, y, y % 2 ? hex("#2a2d34") : hex("#0d0e12")); return im; },
  "wall:fuse": () => { const im = new Img(); im.rect(3, 4, 12, 11, hex("#2a2d34")); im.rect(4, 5, 11, 10, FR); for (const [x, c] of [[5, RED], [7, AMBER], [9, GREENE], [11, CYAN]] as Array<[number, RGB]>) { im.px(x, 6, c); im.rect(x, 7, x, 9, hex("#8e9aa3")); } return im; },
  "wall:notice": () => { const im = new Img(); im.rect(3, 4, 12, 11, hex("#5a4228")); for (const [x, y, w, h] of [[4, 5, 3, 3], [8, 5, 3, 2], [5, 9, 4, 2], [10, 8, 2, 3]]) im.rect(x, y, x + w - 1, y + h - 1, hex("#e0dcc8")); px(im, RED, [5, 5], [9, 5]); return im; },
  "wall:menu": () => { const im = new Img(); im.rect(3, 4, 12, 11, hex("#1c1f25")); im.rect(4, 5, 11, 10, hex("#2a2d34")); for (const y of [6, 8, 10 - 0]) im.rect(5, y, 10 - (y % 3), y, y === 8 ? AMBER : hex("#cfd8dc")); return im; },
  "wall:extinguisher": () => { const im = new Img(); im.rect(6, 5, 9, 11, hex("#b81f24")); im.rect(6, 4, 9, 4, hex("#14161a")); im.rect(7, 7, 8, 8, hex("#e0e6ea")); im.rect(10, 4, 10, 7, hex("#14161a")); return im; },
  // hull windows: full-tile panes blitted over the wall, so they read on any wall orientation
  "wall:canopy": () => { const im = new Img(); const A = hex("#0b1a2e"), B = hex("#10304f"), C = hex("#1a4b78"); im.rect(0, 0, 15, 15, FR); im.rect(0, 0, 15, 0, FRL); im.rect(1, 1, 14, 14, A); im.rect(1, 6, 14, 10, B); im.rect(1, 11, 14, 14, C); for (let i = 0; i < 6; i++) im.px(10 - i, 2 + i * 2 > 14 ? 14 : 2 + i * 2, hex("#6cc6e6")); px(im, WHT, [3, 3], [11, 5], [6, 8], [13, 9]); px(im, ICE, [8, 4], [2, 7]); return im; },
  "wall:viewport": () => { const im = new Img(); im.rect(0, 0, 15, 15, FR); im.rect(1, 1, 14, 1, FRL); im.rect(2, 3, 13, 12, hex("#3a3f4a")); im.rect(3, 4, 12, 11, hex("#0b1a2e")); im.rect(3, 8, 12, 11, hex("#10304f")); px(im, WHT, [5, 5], [10, 6], [7, 9]); px(im, hex("#6cc6e6"), [4, 10], [5, 9], [6, 8]); return im; },
  "wall:porthole": () => { const im = new Img(); im.rect(0, 0, 15, 15, FR); im.rect(1, 1, 14, 1, FRL); const R = hex("#3a3f4a"), G = hex("#0b1a2e"); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = (x - 7.5) ** 2 + (y - 7.5) ** 2; if (d <= 22) im.px(x, y, R); if (d <= 12) im.px(x, y, G); } px(im, WHT, [6, 6], [9, 8]); px(im, hex("#6cc6e6"), [5, 9], [6, 10]); return im; },
  "wall:shutter": () => { const im = new Img(); im.rect(0, 0, 15, 15, FR); im.rect(1, 1, 14, 1, FRL); for (let y = 3; y <= 12; y++) im.rect(2, y, 13, y, y % 2 ? hex("#2a2d34") : hex("#1b1e24")); px(im, AMBER, [13, 2]); px(im, hex("#b8941f"), [2, 13], [3, 13], [6, 13], [7, 13]); return im; },
  "wall:panel": () => { const im = new Img(); im.rect(4, 5, 11, 10, hex("#2a2d34")); im.rect(5, 6, 10, 9, FR); px(im, GREENE, [6, 7]); px(im, AMBER, [8, 7]); px(im, RED, [9, 8]); px(im, LIME, [6, 9]); return im; },
};

/** A closed orange square, inset one pixel from the tile edge. */
const slotSquare = (): Img => { const im = new Img(), c = hex("#c8601a"); im.rect(2, 2, 13, 2, c); im.rect(2, 13, 13, 13, c); im.rect(2, 2, 2, 13, c); im.rect(13, 2, 13, 13, c); return im; };
const OUTLINE = hex("#2a2d34"), HI = hex("#8e9aa3");
export const DECALS: Record<string, () => Img> = {
  // one continuous rear ramp: vertical grip bars across the direction of travel, no tile borders, period 8 divides 16 so tiles join seamlessly
  "floor:ramp": () => { const im = new Img(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) im.px(x, y, x % 8 < 4 ? hex("#c8601a") : hex("#241f1b")); return im; },
  // cargo slots: every cell is the same closed square outline (the ship blueprint is rotated when stamped, so corner pieces would land wrong)
  "floor:slot-ml": () => slotSquare(), "floor:slot-mr": () => slotSquare(), "floor:slot-tl": () => slotSquare(),
  "floor:slot-tr": () => slotSquare(), "floor:slot-bl": () => slotSquare(), "floor:slot-br": () => slotSquare(),
  "floor:slot": () => slotSquare(),
  "floor:stool": () => { const im = new Img(); im.rect(5, 6, 10, 11, hex("#2a2d34")); im.rect(6, 5, 9, 12, hex("#2a2d34")); im.rect(6, 6, 9, 10, hex("#6d7580")); im.rect(6, 6, 9, 6, HI); im.rect(6, 12, 9, 12, hex("#0d0e12")); return im; },
  "floor:rug": () => { const im = new Img(); im.rect(0, 0, 15, 15, hex("#3a2a44")); im.rect(1, 1, 14, 14, hex("#52385e")); im.rect(3, 3, 12, 12, hex("#3a2a44")); im.rect(5, 5, 10, 10, hex("#7a4a8a")); return im; },
  "floor:hazard": () => { const im = new Img(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x < 2 || x > 13 || y < 2 || y > 13) im.px(x, y, (x + y) % 8 < 4 ? hex("#b8941f") : hex("#15171b")); return im; },
  "floor:lane": () => { const im = new Img(); im.rect(7, 0, 8, 15, hex("#6a6a30")); for (const y of [3, 4, 11, 12]) im.rect(7, y, 8, y, hex("#22252c")); return im; },
  "floor:arrow": () => { const im = new Img(); im.rect(7, 5, 8, 13, hex("#6d7580")); im.rect(6, 6, 9, 6, hex("#6d7580")); im.rect(5, 7, 10, 7, hex("#6d7580")); im.rect(4, 8, 11, 8, hex("#6d7580")); return im; },
  "floor:medcross": () => { const im = new Img(); im.rect(6, 2, 9, 13, hex("#8a2a2e")); im.rect(2, 6, 13, 9, hex("#8a2a2e")); im.rect(7, 3, 8, 12, hex("#a83a3e")); im.rect(3, 7, 12, 8, hex("#a83a3e")); return im; },
  "floor:pad": () => { const im = new Img(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if ((d > 5.2 && d < 6.7) || (d > 2.2 && d < 3.2)) im.px(x, y, hex("#2a6a9a")); } return im; },
  "floor:grate": () => { const im = new Img(); im.rect(1, 1, 14, 14, hex("#14161a")); for (let i = 2; i < 14; i += 3) { im.rect(i, 1, i, 14, hex("#3a3f4a")); im.rect(1, i, 14, i, hex("#3a3f4a")); } im.rect(0, 0, 15, 0, OUTLINE); return im; },
};
void LIME; void CYAN;
