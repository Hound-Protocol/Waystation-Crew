import { TileKind } from "@wc/sim-core";
import { Img } from "./image";
import { hex, OUT, CYAN, ORANGE, GREENE, RED } from "./palette";

function floor(): Img {
  const im = new Img();
  im.rect(0, 0, 15, 15, hex("#22252c"));
  for (let y = 0; y < 16; y += 4) im.rect(0, y, 15, y, hex("#17191e"));
  for (let y = 1; y < 16; y += 4) im.rect(0, y, 15, y, hex("#292d35"));
  im.rect(8, 0, 8, 15, hex("#17191e")); im.rect(0, 0, 0, 15, hex("#2b2f38"));
  return im;
}
function hazard(im: Img, y0: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = 0; x < 16; x++) im.px(x, y, (x + y) % 4 < 2 ? hex("#b8941f") : hex("#15171b"));
}
function wall(): Img {
  const im = new Img();
  im.rect(0, 0, 15, 15, hex("#2e323b")); im.rect(0, 0, 15, 1, hex("#454a56")); im.rect(0, 2, 15, 2, hex("#252830"));
  im.rect(8, 3, 8, 11, hex("#252830")); im.rect(0, 12, 15, 12, hex("#16181d")); hazard(im, 13, 14); im.rect(0, 15, 15, 15, hex("#0d0e12"));
  for (const [x, y] of [[3, 5], [12, 5], [3, 9], [12, 9]]) im.px(x, y, hex("#5a6070"));
  return im;
}
function door(): Img {
  const im = floor();
  im.rect(0, 3, 15, 4, hex("#16181d")); im.rect(0, 11, 15, 12, hex("#16181d"));
  im.box(0, 5, 6, 10, hex("#3a3f4a")); im.box(9, 5, 15, 10, hex("#3a3f4a")); im.rect(7, 5, 8, 10, OUT);
  for (const x of [1, 3, 5, 10, 12, 14]) im.px(x, 7, hex("#b8941f"));
  im.px(6, 2, RED); im.px(9, 2, RED);
  return im;
}
function bed(): Img {
  const im = floor();
  im.box(2, 1, 13, 14, hex("#2a2d34")); im.rect(3, 2, 12, 13, hex("#3b4252")); im.rect(4, 3, 11, 5, hex("#7d8794")); im.rect(4, 3, 4, 5, hex("#9aa3ae"));
  im.rect(3, 7, 12, 13, hex("#2c3d55")); im.rect(3, 7, 12, 7, hex("#3d5273")); im.rect(12, 7, 12, 13, hex("#1f2c3f"));
  return im;
}
function console_(): Img {
  const im = floor();
  im.box(1, 4, 14, 13, hex("#1b1e24")); im.rect(1, 4, 14, 4, hex("#2d3139")); im.rect(3, 5, 12, 9, hex("#06090c")); im.rect(4, 6, 11, 8, CYAN);
  for (let x = 4; x < 12; x++) im.px(x, 7, hex("#2aa0bd"));
  im.px(4, 11, ORANGE); im.px(6, 11, GREENE); im.px(8, 11, RED);
  return im;
}
function table(): Img {
  const im = floor();
  im.box(1, 3, 14, 12, hex("#3b3f48")); im.rect(2, 4, 13, 4, hex("#555b66"));
  for (const x of [4, 8, 12]) { im.px(x, 7, hex("#8e9aa3")); im.px(x + 0, 8, hex("#5f6a72")); }
  im.px(6, 6, LAMP_);
  return im;
}
const LAMP_ = hex("#ffd866");
function plants(): Img {
  const im = floor();
  im.box(1, 3, 14, 13, hex("#1b1e24")); im.rect(2, 4, 13, 12, hex("#1e2b22"));
  for (const x of [4, 8, 11]) for (const y of [6, 9]) { im.px(x, y, GREENE); im.px(x - 1, y + 1, hex("#3fd98a")); im.px(x + 1, y + 1, hex("#3fd98a")); im.px(x, y + 1, hex("#1f7a4c")); }
  return im;
}
function airlock(): Img {
  const im = floor();
  hazard(im, 0, 1); hazard(im, 14, 15); im.rect(2, 6, 13, 9, hex("#16181d"));
  for (const x of [3, 6, 9, 12]) im.px(x, 7, ORANGE);
  return im;
}

export function drawTile(kind: TileKind): Img {
  switch (kind) {
    case TileKind.Floor: return floor();
    case TileKind.Wall: return wall();
    case TileKind.Door: return door();
    case TileKind.Bed: return bed();
    case TileKind.Console: return console_();
    case TileKind.Table: return table();
    case TileKind.Plant: return plants();
    case TileKind.Airlock: return airlock();
    default: return new Img(); // Void: transparent so space shows through
  }
}
