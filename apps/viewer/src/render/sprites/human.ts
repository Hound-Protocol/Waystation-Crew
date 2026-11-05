import { Department } from "@wc/sim-core";
import { Img } from "./image";
import { hex, mul, OUT, CYAN, ORANGE, GREENE, RED, LAMP, type RGB } from "./palette";

const PANTS = hex("#22262d"), PANTS_HI = hex("#2d323b"), PANTS_DK = hex("#15181d"), BOOT = hex("#0f1115");

interface Suit { suit: RGB; hi: RGB; dk: RGB; pad: RGB; light: RGB; extra?: (im: Img) => void }

const SUITS: Record<number, Suit> = {
  [Department.Command]: { suit: hex("#1f2a44"), hi: hex("#2d3b5c"), dk: hex("#141b2e"), pad: hex("#c9a227"), light: CYAN },
  [Department.Engineering]: { suit: hex("#2b3038"), hi: hex("#3a404b"), dk: hex("#1c2026"), pad: hex("#d9701c"), light: ORANGE },
  [Department.Medical]: { suit: hex("#8e9aa3"), hi: hex("#aab5bc"), dk: hex("#5f6a72"), pad: hex("#cfd8dc"), light: RED,
    extra: (im) => { im.px(7, 7, hex("#b8c2c9")); im.px(8, 7, hex("#b8c2c9")); im.px(7, 9, RED); im.px(8, 9, RED); } },
  [Department.Security]: { suit: hex("#2a303a"), hi: hex("#3b4452"), dk: hex("#171b22"), pad: hex("#8a1f1f"), light: RED,
    extra: (im) => im.rect(5, 2, 10, 2, hex("#3b4452")) },
  [Department.Supply]: { suit: hex("#4a4232"), hi: hex("#5e5441"), dk: hex("#2f2a20"), pad: hex("#8a7a3a"), light: LAMP,
    extra: (im) => { im.px(7, 2, LAMP); im.px(8, 2, LAMP); } },
  [Department.Service]: { suit: hex("#3d5a6c"), hi: hex("#4e7288"), dk: hex("#27394a"), pad: hex("#7a95a6"), light: GREENE },
};

export function drawHuman(o: { skin: string; hair: string; dept: Department }): Img {
  const s = SUITS[o.dept] ?? SUITS[Department.Service];
  const skin = hex(o.skin), hair = hex(o.hair), skDk = mul(skin, 0.75);
  const im = new Img();
  im.rect(5, 2, 10, 3, hair); im.px(5, 2, mul(hair, 1.4));
  im.rect(5, 4, 10, 5, skin); im.rect(10, 4, 10, 5, skDk);
  im.px(5, 4, hair); im.px(6, 4, OUT); im.px(9, 4, OUT);
  im.px(7, 6, skDk); im.px(8, 6, skDk);
  im.box(6, 7, 9, 10, s.suit, s.hi, s.dk);
  im.rect(5, 7, 5, 9, s.hi); im.rect(10, 7, 10, 9, s.dk);
  im.px(5, 7, s.pad); im.px(10, 7, mul(s.pad, 0.7));
  im.px(5, 10, skin); im.px(10, 10, skDk); im.px(8, 8, s.light);
  im.rect(6, 10, 9, 10, hex("#14161a")); im.px(7, 10, hex("#4a4f5a"));
  im.box(6, 11, 7, 13, PANTS, PANTS_HI, PANTS_DK); im.box(8, 11, 9, 13, PANTS, PANTS_HI, PANTS_DK);
  im.rect(5, 14, 7, 14, BOOT); im.rect(8, 14, 10, 14, BOOT); im.px(5, 14, hex("#262a31"));
  s.extra?.(im);
  return im.outline();
}

export type FacingDir = "up" | "down" | "left" | "right";

function mirror(src: Img): Img {
  const out = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const s = (y * src.w + x) * 4, d = (y * src.w + (src.w - 1 - x)) * 4;
    out.data[d] = src.data[s]; out.data[d + 1] = src.data[s + 1]; out.data[d + 2] = src.data[s + 2]; out.data[d + 3] = src.data[s + 3];
  }
  return out;
}

/** Back view: all hair, no face, plain back with no chest light. */
function drawBack(o: { skin: string; hair: string; dept: Department }): Img {
  const s = SUITS[o.dept] ?? SUITS[Department.Service];
  const skin = hex(o.skin), hair = hex(o.hair), skDk = mul(skin, 0.75);
  const im = new Img();
  im.rect(5, 2, 10, 5, hair); im.rect(5, 2, 10, 2, mul(hair, 1.3)); im.rect(10, 3, 10, 5, mul(hair, 0.7)); im.px(7, 6, skDk); im.px(8, 6, skDk);
  im.box(6, 7, 9, 10, s.suit, s.hi, s.dk);
  im.rect(5, 7, 5, 9, s.dk); im.rect(10, 7, 10, 9, mul(s.dk, 0.8));
  im.px(5, 7, s.pad); im.px(10, 7, mul(s.pad, 0.7)); im.px(5, 10, skin); im.px(10, 10, skDk);
  im.px(7, 8, s.hi); im.px(8, 8, s.hi); // back seam
  im.rect(6, 10, 9, 10, hex("#14161a"));
  im.box(6, 11, 7, 13, PANTS, PANTS_HI, PANTS_DK); im.box(8, 11, 9, 13, PANTS, PANTS_HI, PANTS_DK);
  im.rect(5, 14, 7, 14, BOOT); im.rect(8, 14, 10, 14, BOOT);
  if (o.dept === Department.Security) im.rect(5, 2, 10, 2, hex("#3b4452"));
  return im.outline();
}

/** Right-facing profile (left is its mirror): face on the right, one arm and a stepping leg visible. */
function drawSide(o: { skin: string; hair: string; dept: Department }): Img {
  const s = SUITS[o.dept] ?? SUITS[Department.Service];
  const skin = hex(o.skin), hair = hex(o.hair), skDk = mul(skin, 0.75);
  const im = new Img();
  im.rect(5, 2, 10, 3, hair); im.rect(5, 4, 7, 6, hair); im.px(5, 2, mul(hair, 1.4));
  im.rect(8, 4, 10, 6, skin); im.rect(8, 6, 10, 6, skDk); im.px(9, 5, OUT); im.px(10, 5, skin);
  im.box(6, 7, 9, 10, s.suit, s.hi, s.dk);
  im.rect(6, 8, 8, 10, s.hi); im.rect(7, 8, 8, 10, s.suit); // near arm over the torso
  im.px(7, 7, s.pad); im.px(8, 10, skin); im.px(9, 8, s.light);
  im.rect(6, 10, 9, 10, hex("#14161a"));
  im.box(7, 11, 8, 13, PANTS, PANTS_HI, PANTS_DK); im.box(9, 11, 10, 13, PANTS_DK, PANTS, PANTS_DK);
  im.rect(6, 14, 8, 14, BOOT); im.rect(9, 14, 11, 14, BOOT);
  if (o.dept === Department.Security) im.rect(5, 2, 10, 2, hex("#3b4452"));
  return im.outline();
}

export function drawHumanDir(o: { skin: string; hair: string; dept: Department }, dir: FacingDir): Img {
  switch (dir) {
    case "down": return drawHuman(o);
    case "up": return drawBack(o);
    case "right": return drawSide(o);
    case "left": return mirror(drawSide(o));
  }
}

export const SKINS = ["#b57a52", "#e0b48a", "#7a4e34", "#d9a07a"];
export const HAIRS = ["#1d1710", "#a07f4a", "#5a3a1f", "#101010"];
export const appearance = (v: number) => ({ skin: SKINS[v % 4], hair: HAIRS[(v + 1) % 4] });
