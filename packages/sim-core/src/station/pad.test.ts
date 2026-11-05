import { describe, it, expect } from "vitest";
import { buildPad, PAD } from "./pad";
import { TileKind } from "./tilemap";
import { findPath } from "./nav";

describe("landing pad", () => {
  const pad = buildPad();
  const decoAt = (sprite: string) => pad.deco!.filter((d) => d.sprite === sprite);

  it("is an open-air chunk: floor (plus beacon props) inside the pad rectangle, nothing (void) outside", () => {
    expect(pad.map.w).toBe(PAD.w); expect(pad.map.h).toBe(PAD.h);
    for (let y = 0; y < PAD.h; y++) for (let x = 0; x < PAD.w; x++) {
      const inside = x >= PAD.pad.x && x < PAD.pad.x + PAD.pad.w && y >= PAD.pad.y && y < PAD.pad.y + PAD.pad.h;
      const k = pad.map.get(x, y);
      if (inside) expect([TileKind.Floor, TileKind.Airlock, TileKind.Prop], `${x},${y}`).toContain(k); else expect(k, `${x},${y}`).toBe(TileKind.Void);
    }
  });
  it("is framed by a complete ring of hazard squares on its edge", () => {
    const haz = new Set(decoAt("floor:hazard").map((d) => `${d.x},${d.y}`));
    const { x, y, w, h } = PAD.pad;
    for (let i = 0; i < w; i++) { expect(haz.has(`${x + i},${y}`)).toBe(true); expect(haz.has(`${x + i},${y + h - 1}`)).toBe(true); }
    for (let j = 0; j < h; j++) { expect(haz.has(`${x},${y + j}`)).toBe(true); expect(haz.has(`${x + w - 1},${y + j}`)).toBe(true); }
  });
  it("has a ship berth the size of the ship (36 x 23 with its wall margin), fully on the pad", () => {
    expect(PAD.berth.w).toBe(36); expect(PAD.berth.h).toBe(23);
    for (let y = PAD.berth.y; y < PAD.berth.y + PAD.berth.h; y++) for (let x = PAD.berth.x; x < PAD.berth.x + PAD.berth.w; x++) expect(pad.map.get(x, y), `${x},${y}`).not.toBe(TileKind.Void);
  });
  it("has a gate stub touching the ship's stern gateway: a 1x9 airlock run centred on the berth", () => {
    const stub: number[] = []; for (let y = 0; y < PAD.h; y++) if (pad.map.get(PAD.gate.x, y) === TileKind.Airlock) stub.push(y);
    expect(stub.length).toBe(9);
    expect(PAD.gate.x).toBe(PAD.berth.x + PAD.berth.w);                              // the column right behind the ship's last column
    expect(stub[0] + 4).toBe(PAD.berth.y + (PAD.berth.h - 1) / 2);                  // centred on the berth, as the ship's gateway is on the ship
  });
  it("has an apron with 28 slots marked like the hold (30 + 30 square cells) and a loader lane between the banks", () => {
    expect(decoAt("floor:slot").length).toBe(60);
    const lane = decoAt("floor:lane"); expect(lane.length).toBeGreaterThanOrEqual(20);
    const rows = new Set(lane.map((d) => d.y)); expect(rows.size).toBe(1);
    const mid = [...rows][0];
    expect(decoAt("floor:slot").filter((d) => d.y < mid).length).toBe(30); expect(decoAt("floor:slot").filter((d) => d.y > mid).length).toBe(30);
  });
  it("lights the approach with beacons on the pad rim", () => {
    const b = decoAt("prop:beacon"); expect(b.length).toBeGreaterThanOrEqual(8);
    for (const d of b) expect(pad.map.get(d.x, d.y)).toBe(TileKind.Prop);
  });
  it("lets people walk from the gate stub to the lane and around every slot", () => {
    const from = { x: PAD.gate.x + 1, y: PAD.berth.y + 11 };
    for (const d of decoAt("floor:slot")) {
      let reached = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = { x: d.x + dx, y: d.y + dy }; if (pad.map.get(t.x, t.y) === TileKind.Floor && findPath(pad.map, from, t)) { reached = true; break; } }
      expect(reached, `slot ${d.x},${d.y}`).toBe(true);
    }
  });
});
