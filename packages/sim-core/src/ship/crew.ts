import type { Station } from "../station/starter";
import { TileKind } from "../station/tilemap";
import type { JobPost } from "../org/jobs";

/** The three cockpit consoles as furniture ids: the pilot's in the middle of the nose, the co-pilot's and the engineer's either side (lowest and highest y). */
export interface FlightSeats { pilot: number; copilot: number; engineer: number }
export type FlightRole = "pilot" | "copilot" | "engineer";

export function flightSeats(st: Station): FlightSeats | null {
  const cons = st.furniture.filter((f) => f.kind === TileKind.Console && st.rooms[f.roomId]?.name === "Cargo Ship").sort((a, b) => a.y - b.y);
  if (cons.length !== 3) return null;
  return { copilot: cons[0].id, pilot: cons[1].id, engineer: cons[2].id };
}

export function postRole(seats: FlightSeats | null, post: JobPost): FlightRole | null {
  if (!seats) return null;
  return post.workstationFurnitureId === seats.pilot ? "pilot" : post.workstationFurnitureId === seats.copilot ? "copilot" : post.workstationFurnitureId === seats.engineer ? "engineer" : null;
}
