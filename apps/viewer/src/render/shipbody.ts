export interface Rect { x: number; y: number; w: number; h: number }

const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };

/**
 * Where the flying ship's body is: its centre in world tiles and its rotation (radians, clockwise on screen, 0 = nose west as docked).
 * s: 0 at berth `a` .. 1 at berth `b`; turn: 0..1 from the berth heading toward the travel direction (nose first); dir: +1 toward b, -1 toward a.
 */
export function shipPlacement(p: { s: number; turn: number; dir: -1 | 0 | 1 }, a: Rect, b: Rect): { x: number; y: number; rot: number } {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const travel = Math.atan2(by - ay, bx - ax) + (p.dir < 0 ? Math.PI : 0);
  return { x: ax + (bx - ax) * p.s, y: ay + (by - ay) * p.s, rot: p.turn === 0 ? 0 : wrap(travel - Math.PI) * p.turn };
}

/**
 * Where a crew member standing at sim tile (x, y) is drawn: inside the ship's berth they ride the flying body (moved to its centre and turned about it);
 * everyone else stays put. Positions are tile corners, as the sim keeps them.
 */
export function aboardPlace(berth: Rect, body: { x: number; y: number; rot: number }): (x: number, y: number) => { x: number; y: number } {
  const cx = berth.x + berth.w / 2, cy = berth.y + berth.h / 2, cos = Math.cos(body.rot), sin = Math.sin(body.rot);
  return (x, y) => {
    if (x < berth.x || x >= berth.x + berth.w || y < berth.y || y >= berth.y + berth.h) return { x, y };
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    return { x: body.x + dx * cos - dy * sin - 0.5, y: body.y + dx * sin + dy * cos - 0.5 };
  };
}
