import type { ShipChunkSnap, ShipStatus, Profile, CharSnap, Clock, DecoSnap, DevCmd, FurnitureSnap, Move, RoomSnap, StateChange, TaskChange, Viewport } from "./types";

export type ClientMsg = { t: "subscribe"; viewport: Viewport } | { t: "devCmd"; cmd: DevCmd } | { t: "inspect"; id: number | null };
export type ServerMsg =
  | { t: "snapshot"; tick: number; w: number; h: number; tiles: number[]; furniture: FurnitureSnap[]; rooms: RoomSnap[]; chars: CharSnap[]; deco?: DecoSnap[]; floors?: number[]; ship?: ShipChunkSnap; shipStatus?: ShipStatus }
  | { t: "station"; tick: number; w: number; h: number; tiles: number[]; furniture: FurnitureSnap[]; rooms: RoomSnap[]; deco?: DecoSnap[]; floors?: number[] }
  | { t: "delta"; tick: number; moves: Move[]; states: StateChange[]; clock: Clock; shipStatus?: ShipStatus; tasks?: TaskChange[] }
  | { t: "inspect"; id: number; tick: number; lines: string[]; profile?: Profile | null };

export interface SimTransport {
  send(m: ClientMsg): void;
  onMessage(cb: (m: ServerMsg) => void): void;
  close(): void;
}

export const encode = (m: ClientMsg | ServerMsg): string => JSON.stringify(m);

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function validCmd(c: unknown): c is DevCmd {
  if (!isObj(c)) return false;
  switch (c.c) {
    case "speed": return isNum(c.mult);
    case "pause": return true;
    case "spawn": return isNum(c.count) && (c.dept === undefined || isNum(c.dept));
    case "reset": return isNum(c.seed);
    default: return false;
  }
}

export function decodeClient(s: string): ClientMsg {
  const m: unknown = JSON.parse(s);
  if (isObj(m) && m.t === "subscribe" && isObj(m.viewport)) return m as unknown as ClientMsg;
  if (isObj(m) && m.t === "devCmd" && validCmd(m.cmd)) return m as unknown as ClientMsg;
  if (isObj(m) && m.t === "inspect" && (m.id === null || isNum(m.id))) return m as unknown as ClientMsg;
  throw new Error("invalid client message");
}

export function decodeServer(s: string): ServerMsg {
  const m: unknown = JSON.parse(s);
  if (isObj(m) && (m.t === "snapshot" || m.t === "station" || m.t === "delta" || m.t === "inspect") && isNum(m.tick)) return m as unknown as ServerMsg;
  throw new Error("invalid server message");
}
