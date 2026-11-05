import { Img } from "./image";
import { hex } from "./palette";

/** Neighbour bits for a wall tile (true = another wall/door continues that way). */
export interface WallMask { n: boolean; e: boolean; s: boolean; w: boolean; ne: boolean; se: boolean; sw: boolean; nw: boolean }
export const maskKey = (m: WallMask) => (+m.n) | (+m.e << 1) | (+m.s << 2) | (+m.w << 3) | (+m.ne << 4) | (+m.se << 5) | (+m.sw << 6) | (+m.nw << 7);

const CAP = hex("#2e323b"), CAP_HI = hex("#454a56"), LIT1 = hex("#4d5361"), LIT2 = hex("#3c414d"), SH1 = hex("#16181d"), SH2 = hex("#0d0e12"), FACE = hex("#252830"), FACE_DK = hex("#1b1d23");
const PANEL = hex("#2a2d36"), RIVET = hex("#5a6070"), HAZ1 = hex("#b8941f"), HAZ2 = hex("#15171b");

/** A wall tile that adapts to any neighbourhood: bevelled edges where it is open, a front face when nothing is south of it. */
export function drawWallAuto(m: WallMask): Img {
  const im = new Img();
  const faceTop = m.s ? 16 : 4;                                   // rows >= faceTop show the front face
  im.rect(0, 0, 15, faceTop - 1, CAP);
  if (!m.n) { im.rect(0, 0, 15, 0, CAP_HI); im.rect(0, 1, 15, 1, LIT2); }
  if (!m.w) { im.rect(0, 0, 0, faceTop - 1, LIT1); im.rect(1, 1, 1, faceTop - 1, LIT2); }
  if (!m.e) { im.rect(15, 0, 15, faceTop - 1, SH2); im.rect(14, 0, 14, faceTop - 1, SH1); }
  // panel seams on the cap, so long runs read as plating
  if (m.w && m.e) { im.rect(8, 2, 8, faceTop - 2, FACE); }
  if (m.n && m.s) { im.rect(2, 8, 13, 8, FACE); }
  // inside corners: a diagonal neighbour is missing though both orthogonal ones exist
  if (m.n && m.w && !m.nw) { im.px(0, 0, SH1); im.px(1, 0, FACE); im.px(0, 1, FACE); }
  if (m.n && m.e && !m.ne) { im.px(15, 0, SH1); im.px(14, 0, FACE); im.px(15, 1, FACE); }
  if (!m.s) {
    im.rect(0, 4, 15, 4, SH1);
    im.rect(0, 5, 15, 11, FACE);
    im.rect(0, 5, 15, 5, PANEL); im.rect(0, 11, 15, 11, FACE_DK);
    im.rect(8, 6, 8, 10, FACE_DK);
    for (const [x, y] of [[2, 7], [13, 7]]) im.px(x, y, RIVET);
    im.rect(0, 12, 15, 12, SH1);
    for (let y = 13; y <= 14; y++) for (let x = 0; x < 16; x++) im.px(x, y, (x + y) % 4 < 2 ? HAZ1 : HAZ2);
    im.rect(0, 15, 15, 15, SH2);
    if (!m.w) { im.rect(0, 4, 0, 15, LIT1); im.rect(1, 5, 1, 11, LIT2); }
    if (!m.e) { im.rect(15, 4, 15, 15, SH2); im.rect(14, 5, 14, 11, FACE_DK); }
  }
  return im;
}
