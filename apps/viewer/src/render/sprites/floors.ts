import { Img } from "./image";
import { hex, type RGB } from "./palette";

/** Floor styles by module: 0 plating, 1 clinical, 2 command carpet, 3 grating, 4 security, 5 galley, 6 cargo, 7 arrivals, 8 plaza, 9 quarters. */
export const FLOOR_STYLES = 10;

function base(im: Img, main: RGB, line: RGB, hi: RGB, parity: number) {
  im.rect(0, 0, 15, 15, main);
  for (let y = 0; y < 16; y += 4) im.rect(0, y, 15, y, line);
  for (let y = 1; y < 16; y += 4) im.rect(0, y, 15, y, hi);
  im.rect(8, 0, 8, 15, line); im.rect(0, 0, 0, 15, hi);
  if (parity) { im.px(3, 6, line); im.px(12, 11, line); }
}

export function drawFloor(style: number, parity: number): Img {
  const im = new Img();
  switch (style) {
    case 1: { // clinical: pale tiles
      im.rect(0, 0, 15, 15, hex(parity ? "#4a525c" : "#515963"));
      im.rect(0, 0, 15, 0, hex("#646d79")); im.rect(0, 0, 0, 15, hex("#646d79")); im.rect(15, 0, 15, 15, hex("#2f353d")); im.rect(0, 15, 15, 15, hex("#2f353d"));
      im.px(7, 7, hex("#5c6571")); im.px(8, 8, hex("#5c6571")); break; }
    case 2: { // command carpet: deep blue with a pinstripe
      im.rect(0, 0, 15, 15, hex(parity ? "#1c2744" : "#1f2b4a"));
      im.rect(0, 0, 15, 0, hex("#2a3a63")); im.rect(0, 15, 15, 15, hex("#141c33"));
      for (let x = 2; x < 16; x += 4) im.rect(x, 1, x, 14, hex("#223052")); break; }
    case 3: { // engineering grating
      im.rect(0, 0, 15, 15, hex("#1c1f25"));
      for (let y = 1; y < 16; y += 3) for (let x = parity; x < 16; x += 3) im.rect(x, y, x + 1, y, hex("#2c313b"));
      im.rect(0, 0, 15, 0, hex("#2f343e")); im.rect(0, 15, 15, 15, hex("#111317")); break; }
    case 4: { // security: dark checker with red trim
      const dark = ((parity + 1) & 1) === 0;
      im.rect(0, 0, 15, 15, hex(dark ? "#262329" : "#2d2a31"));
      im.rect(0, 0, 15, 0, hex("#3a3640")); im.rect(0, 15, 15, 15, hex("#17151a"));
      im.rect(0, 7, 15, 7, hex("#3a1a1d")); break; }
    case 5: { // galley: warm lino
      im.rect(0, 0, 15, 15, hex(parity ? "#3a342b" : "#40392f"));
      im.rect(0, 0, 15, 0, hex("#524a3c")); im.rect(0, 15, 15, 15, hex("#26221b")); im.rect(8, 0, 8, 15, hex("#2f2a22")); break; }
    case 6: { // cargo: scuffed plates with yellow lane ticks
      base(im, hex("#262a30"), hex("#1a1d22"), hex("#30353d"), parity);
      im.rect(0, 15, 15, 15, hex("#16181c")); if (parity) { im.rect(2, 13, 5, 13, hex("#7a6420")); } break; }
    case 7: { // arrivals: bright plates, blue guide rails
      base(im, hex("#2a2f37"), hex("#1b1f25"), hex("#363c46"), parity);
      im.rect(0, 14, 15, 14, hex("#1f3a52")); break; }
    case 8: { // plaza: large lighter tiles
      im.rect(0, 0, 15, 15, hex(parity ? "#2c3038" : "#313640"));
      im.rect(0, 0, 15, 0, hex("#3f4551")); im.rect(0, 0, 0, 15, hex("#3f4551")); im.rect(15, 0, 15, 15, hex("#1d2025")); im.rect(0, 15, 15, 15, hex("#1d2025")); break; }
    case 9: { // quarters: soft grey-blue carpet
      im.rect(0, 0, 15, 15, hex(parity ? "#2a2f3a" : "#2d3340"));
      for (let y = 2; y < 16; y += 4) for (let x = (y / 2) & 3; x < 16; x += 4) im.px(x, y, hex("#242933"));
      im.rect(0, 0, 15, 0, hex("#363d4c")); break; }
    default: base(im, hex("#22252c"), hex("#17191e"), hex("#292d35"), parity);
  }
  return im;
}
