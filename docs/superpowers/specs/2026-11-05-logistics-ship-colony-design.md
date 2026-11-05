# Dock, cargo ship, outpost and colony loop (concept)

Status: concept for discussion. Nothing here is built. Open questions are listed at the end.

## Vision
Everything is tangible. People never pop in on the station: new followers appear in the city/outpost on the home planet, ride a cargo ship to the station, and leave the same way. The ship physically flies station -> planet -> station.

## World layout
- **Solar system** (built): sun + four planets, home planet circles the sun once per sim day.
- **Station orbits the home planet** once per 24h (change from today, where it only rides beside it).
- **Planets are clickable**: camera glides to the body and follows it, an outline marks it, an info card shows details (name, type, radius, orbit, day length, colony). Eased, no pops.
- **City on the home planet**: one non-growable colony, source of supplies and people. Visible only as a marker from far; a top-down patch fades in at extreme zoom, at the same tile scale as everything else.

## Decisions (agreed 2026-11-05)
- **One world map** (user's call, over the separate-maps proposal). Station, dock, outpost and ship all live in one shared coordinate space; no per-place portals.
- **Synchronous orbit:** station orbits the home planet once per 24h, planet spins once per 24h, so the city stays below the station.
- **Trains in and out:** new followers arrive by train at the outpost, resigned ones leave on one.
- **First slice:** dock + docked, walkable ship (boarding, cargo). Flight comes next.

## One world, how it stays feasible
A flat grid out to the planet (~900 tiles) would be about a million tiles, so the single world is stored as **sparse chunks** (e.g. 32x32, allocated only where something exists; the void between is empty). Static places (station, outpost) are chunk sets at fixed positions. The ship is a **rigid body**: its interior is its own chunk set with a local-to-world transform, and a character aboard keeps ship-local coordinates (so walking inside a flying ship is stable). Boarding is just stepping across the ramp edge from world coordinates into ship-local ones. Pathing treats the docked ship as part of the walkable world; in flight, it is a closed room.

## Ship (one deck, first design)
Cargo hauler, about a quarter of the station in footprint. Orange with black accents (Supply colours). Reference: the uploaded Lakon Type 6 deck plan (symmetrical, cargo flanking a central spine).
- **Front:** cockpit, pilot seat + nav console. The pilot is an employee with quarters on the station.
- **Just behind the cockpit:** two side boarding doors (left and right) with short boarding corridors; passengers also use them.
- **Middle:** passenger bench seats along the walls, central cargo hold with a grid of crate slots and floor rails.
- **Rear:** huge ramp doors that open on landing (3 panels, ramp tiles are the portal).
- Proposed size: hull ~31 x 46 tiles, interior ~21 x 34. Engines/thrusters are exterior sprites only.

## Ship behaviour
State machine: `Docked(open) -> Closing -> Undock -> Cruise -> Approach -> Land -> Docked(open at outpost)`, then the same way back. Real positions in world space, eased acceleration, nose points along travel. Schedule runs on the 24h clock; the ship loads cargo when the station demands it, plus people. The pilot sits in the cockpit for the whole flight; between flights he lives a normal shift/sleep life.

## Dock (station side)
A hangar slot on the hull edge: landing pad, big door onto a dock hall, gangways for the side doors, cargo lift/loading lane to the Cargo bay. First thing we build.

## Cargo
Crates are items with a type and quantity. Supply crew carry them between the Cargo bay and the hold (existing carry animation). Station demand (food, parts, medical) creates orders; the city stock answers them. Resource model for the station is still to be defined.

## People flow
- **Arrival:** new follower appears at the outpost (train arrives), walks to the pad, boards the next ship, flies to the station.
- **Resignation:** unfollow -> label "Resigned" -> character goes to the dock, boards the next ship, flies to the outpost, walks to the railway, waits for a train, leaves on it. Train is the exit from the game.
- Characters never vanish or spawn on the station map.

## Open questions
1. Resource model: which supplies the station consumes and how demand is measured.
2. Chunk size and how the baked canvases are split (per chunk) so the renderer stays smooth.
3. Train schedule and how follower events map to arrivals (batching).
