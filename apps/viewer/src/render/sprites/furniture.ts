import { Img } from "./image";
import { hex, mul, CYAN, ORANGE, GREENE, RED, LAMP, AMBER, ICE, SCR, VIO, WHT, LIME, type RGB } from "./palette";

const BODY = hex("#1b1e24"), TOP = hex("#2d3139"), BLK = hex("#06090c"), SHD = hex("#0d0e12"), KEY = hex("#2a2e36");

function desk(screen: (im: Img) => void): Img {
  const im = new Img();
  im.box(1, 5, 14, 13, BODY); im.rect(1, 5, 14, 5, TOP);
  im.rect(3, 6, 12, 10, BLK); screen(im);
  im.rect(3, 12, 12, 12, KEY); for (let x = 4; x < 12; x += 2) im.px(x, 12, hex("#3b4049"));
  im.rect(1, 14, 14, 14, SHD);
  im.px(13, 11, GREENE);
  return im;
}
const lines = (im: Img, c: RGB, ys: number[], x0 = 4, x1 = 11) => { for (const y of ys) for (let x = x0; x <= x1 - ((y * 3) % 3); x++) im.px(x, y, c); };

export const CONSOLES: Record<string, () => Img> = {
  "console:command": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#0b2a4a")); lines(im, CYAN, [7, 9], 4, 10); for (const [x, y] of [[5, 8], [8, 8], [10, 8]]) im.px(x, y, LAMP); }),
  "console:nav": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#062014")); for (const [x, y] of [[6, 7], [9, 7], [5, 8], [10, 8], [6, 9], [9, 9]]) im.px(x, y, hex("#2aa05a")); im.px(7, 8, GREENE); im.px(8, 8, GREENE); im.px(8, 7, GREENE); im.px(10, 7, LIME); }),
  "console:med": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#0a3140")); for (const [x, y] of [[4, 8], [5, 8], [6, 7], [7, 9], [8, 8], [9, 8], [10, 7], [11, 8]]) im.px(x, y, RED); }),
  "console:sec": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#1c1013")); im.rect(4, 7, 7, 8, hex("#2a1a1d")); im.rect(8, 7, 11, 8, hex("#2a1a1d")); im.px(5, 7, RED); im.px(10, 8, RED); im.rect(4, 9, 11, 9, hex("#3a1a1d")); }),
  "console:eng": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#2a1606")); for (const [x, h] of [[4, 1], [6, 3], [8, 2], [10, 3]]) im.rect(x, 10 - h, x + 1, 9, ORANGE); }),
  "console:kiosk": () => { const im = new Img(); im.box(4, 2, 11, 14, BODY); im.rect(5, 3, 10, 8, BLK); im.rect(6, 4, 9, 7, hex("#0b2a4a")); im.px(7, 6, CYAN); im.px(8, 5, CYAN); im.px(9, 4, CYAN); im.rect(6, 10, 9, 10, KEY); im.px(7, 12, GREENE); im.px(9, 12, AMBER); im.rect(4, 14, 11, 14, SHD); return im; },
  "console:supply": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#2a2006")); lines(im, AMBER, [7, 8, 9], 4, 11); }),
  "console:galley": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#0c2418")); lines(im, GREENE, [7, 9], 4, 9); im.px(10, 8, LAMP); im.px(11, 8, LAMP); }),
  "console:arrivals": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#0b2a4a")); for (const [x, y] of [[6, 8], [7, 9], [8, 8], [9, 7]]) im.px(x, y, ICE); }),
  "console:habitation": () => desk((im) => { im.rect(4, 7, 11, 9, hex("#0b2a4a")); lines(im, SCR, [8], 4, 11); }),
  "console:medical": () => CONSOLES["console:med"](),
  "console:security": () => CONSOLES["console:sec"](),
  "console:engineering": () => CONSOLES["console:eng"](),
};

function bedBase(blanket: RGB, frame: RGB, pillow: RGB): Img {
  const im = new Img();
  im.box(2, 1, 13, 14, frame); im.rect(3, 2, 12, 13, mul(frame, 1.3));
  im.rect(4, 3, 11, 5, pillow); im.rect(4, 3, 4, 5, mul(pillow, 1.15));
  im.rect(3, 7, 12, 13, blanket); im.rect(3, 7, 12, 7, mul(blanket, 1.3)); im.rect(12, 7, 12, 13, mul(blanket, 0.65));
  return im;
}
export const BEDS: Record<string, () => Img> = {
  "bed:habitation": () => bedBase(hex("#2c3d55"), hex("#2a2d34"), hex("#7d8794")),
  "bed:medical": () => { const im = bedBase(hex("#cfe3ea"), hex("#7c8790"), hex("#f4fbfd")); im.rect(2, 6, 2, 12, hex("#aab5bc")); im.rect(13, 6, 13, 12, hex("#aab5bc")); im.px(5, 9, hex("#7fb6c6")); im.px(10, 9, hex("#7fb6c6")); im.rect(6, 1, 9, 1, SCR); return im; },
  "bed:bunk": () => { const im = bedBase(hex("#2f4a3a"), hex("#1f2228"), hex("#8e99a4")); im.rect(1, 1, 1, 14, hex("#4d5361")); im.rect(14, 1, 14, 14, hex("#4d5361")); for (const y of [4, 8, 12]) im.px(0, y, hex("#8e9aa3")); return im; },
  "bed:pod": () => { const im = new Img(); im.box(1, 1, 14, 14, hex("#2b3038")); im.rect(2, 2, 13, 13, hex("#3a404b")); im.rect(3, 3, 12, 8, hex("#0b2a4a")); im.rect(4, 4, 11, 7, SCR); im.rect(4, 4, 11, 4, ICE); im.rect(3, 10, 12, 12, hex("#1c1f25")); im.px(4, 11, GREENE); im.px(6, 11, AMBER); return im; },
  "bed:security": () => { const im = bedBase(hex("#4a4f58"), hex("#22252b"), hex("#6d7580")); im.rect(3, 9, 12, 9, hex("#2a2d34")); return im; },
  "bed:arrivals": () => bedBase(hex("#8a4a1c"), hex("#2a2d34"), hex("#aab5bc")),
};
for (const k of ["command", "engineering", "supply", "galley"]) BEDS[`bed:${k}`] = BEDS["bed:habitation"];

function tableBase(top: RGB, edge: RGB): Img {
  const im = new Img();
  im.box(1, 3, 14, 12, edge); im.rect(2, 4, 13, 10, top); im.rect(2, 4, 13, 4, mul(top, 1.25)); im.rect(1, 13, 14, 13, SHD);
  return im;
}
export const TABLES: Record<string, () => Img> = {
  "table:basic": () => { const im = tableBase(hex("#555b66"), hex("#3b3f48")); im.px(6, 6, LAMP); return im; },
  "table:galley": () => { const im = tableBase(hex("#8a949e"), hex("#4a525c")); for (const x of [4, 8, 11]) { im.rect(x, 6, x + 1, 7, hex("#e8edf0")); im.px(x, 8, hex("#5f6a72")); } im.px(7, 9, AMBER); return im; },
  "table:command": () => { const im = tableBase(hex("#1a2a4a"), hex("#0f1a30")); for (const [x, y] of [[5, 6], [8, 7], [10, 6], [7, 9]]) im.px(x, y, CYAN); im.rect(4, 8, 11, 8, hex("#2a3f6a")); return im; },
  "table:round": () => { const im = new Img(); im.rect(3, 3, 12, 12, hex("#3b3f48")); im.rect(4, 2, 11, 13, hex("#3b3f48")); im.rect(4, 4, 11, 11, hex("#6b7480")); im.rect(5, 4, 10, 4, hex("#8e99a4")); im.rect(5, 13, 10, 13, SHD); im.px(7, 7, LAMP); return im; },
};
for (const k of ["arrivals", "security", "medical", "engineering", "supply", "habitation"]) TABLES[`table:${k}`] = TABLES["table:basic"];

export const PLANTS: Record<string, () => Img> = {
  "plant:fern": () => { const im = new Img(); im.box(5, 10, 10, 14, hex("#3a3f48")); im.rect(6, 10, 9, 10, hex("#1e2b22")); for (const [x, y] of [[8, 4], [6, 6], [10, 6], [5, 8], [11, 8], [8, 7]]) { im.px(x, y, GREENE); im.px(x, y + 1, hex("#3fd98a")); im.px(x - 1, y + 1, hex("#1f7a4c")); im.px(x + 1, y + 1, hex("#1f7a4c")); } return im.outline(); },
  "plant:tree": () => { const im = new Img(); im.box(6, 11, 9, 14, hex("#4a3a2a")); im.rect(7, 6, 8, 11, hex("#5a4228")); im.rect(3, 1, 12, 6, hex("#1f7a4c")); im.rect(4, 0, 11, 7, hex("#1f7a4c")); for (const [x, y] of [[5, 2], [8, 1], [10, 3], [6, 5], [9, 5]]) { im.px(x, y, hex("#3fd98a")); im.px(x + 1, y, GREENE); } return im.outline(); },
  "plant:hydro": () => { const im = new Img(); im.box(1, 5, 14, 13, hex("#242a30")); im.rect(2, 6, 13, 12, hex("#1a2420")); for (const x of [3, 6, 9, 12]) for (const y of [7, 10]) { im.px(x, y, GREENE); im.px(x, y + 1, hex("#1f7a4c")); im.px(x - 1, y, hex("#3fd98a")); } im.rect(1, 3, 14, 3, VIO); im.rect(1, 4, 14, 4, hex("#4a3a70")); im.rect(1, 14, 14, 14, SHD); return im; },
};

export const FURNITURE_SPRITES: Record<string, () => Img> = { ...CONSOLES, ...BEDS, ...TABLES, ...PLANTS };
void WHT;
