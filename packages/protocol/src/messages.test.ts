import { describe, it, expect } from "vitest";
import { encode, decodeClient, decodeServer, type ClientMsg, type ServerMsg } from "./messages";

describe("message codec", () => {
  it("round-trips every server message", () => {
    const snap: ServerMsg = { t: "snapshot", tick: 5, w: 2, h: 1, tiles: [1, 2], furniture: [{ id: 0, kind: 5, x: 1, y: 0, roomId: 0 }], rooms: [{ id: 0, name: "Bridge", x: 0, y: 0, w: 2, h: 1 }], chars: [{ id: 0, name: "A", dept: 1, rank: 0, x: 1, y: 0, state: 0, job: -1 }] };
    const delta: ServerMsg = { t: "delta", tick: 9, moves: [{ id: 0, startTick: 6, from: { x: 1, y: 0 }, path: [{ x: 1, y: 1 }] }], states: [{ id: 0, state: 1 }], clock: { speed: 1, paused: false } };
    const insp: ServerMsg = { t: "inspect", id: 3, tick: 9, lines: ["Now: Eat"] };
    for (const m of [snap, delta, insp]) expect(decodeServer(encode(m))).toEqual(m);
  });
  it("round-trips every client message", () => {
    const msgs: ClientMsg[] = [
      { t: "subscribe", viewport: { x: 0, y: 0, w: 10, h: 10, zoom: 3 } },
      { t: "devCmd", cmd: { c: "speed", mult: 10 } },
      { t: "devCmd", cmd: { c: "pause" } },
      { t: "devCmd", cmd: { c: "spawn", count: 3, dept: 2 } },
      { t: "devCmd", cmd: { c: "reset", seed: 7 } },
      { t: "inspect", id: 4 },
      { t: "inspect", id: null },
    ];
    for (const m of msgs) expect(decodeClient(encode(m))).toEqual(m);
  });
  it("rejects unknown or malformed messages", () => {
    expect(() => decodeServer('{"t":"nope"}')).toThrow();
    expect(() => decodeClient("not json")).toThrow();
    expect(() => decodeClient('{"t":"devCmd","cmd":{"c":"speed","mult":"fast"}}')).toThrow();
  });
});
