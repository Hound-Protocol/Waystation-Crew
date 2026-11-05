# Dock, cargo ship, outpost and colony loop (concept)

Status: concept for discussion. Nothing here is built. Open questions are listed at the end.

## Vision
Everything is tangible. People never pop in on the station: new followers appear in the city/outpost on the home planet, ride a cargo ship to the station, and leave the same way. The ship physically flies station -> planet -> station.

## World layout
- **Solar system** (built): sun + four planets, home planet circles the sun once per sim day.
- **Station orbits the home planet** once per 24h (change from today, where it only rides beside it).
- **Planets are clickable**: camera glides to the body and follows it, an outline marks it, an info card shows details (name, type, radius, orbit, day length, colony). Eased, no pops.
- **City on the home planet**: one non-growable colony, source of supplies and people. Visible only as a marker from far; a top-down patch fades in at extreme zoom, at the same tile scale as everything else.

## Places (the structural change)
Today the sim has one map. We introduce **Places**: each has its own tilemap, furniture, rooms and jobs.
- `Station` (exists), `Ship` (mobile), `Outpost` (city spaceport: landing pad, arrivals hall, railway platform).
- Every character has a `placeId`. A **portal** joins two places at fixed tiles (dock door <-> ship ramp, ship side door <-> dock gangway, outpost pad <-> ramp). Pathing: to the portal, cross, continue.
- Rendering: each place is its own baked canvas. The ship canvas is positioned in world space from the ship's state; docked, it aligns to the dock so the ramp meets the dock floor.

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
1. Places as separate maps with portals (proposed) vs one huge world map.
2. Station orbit and planet spin: synchronous (city always below the station) or not.
3. Do new people arrive by train (mirror of the exit) or appear on the pad.
4. Build order: static docked ship first, then flight, then outpost.
5. Resource model: which supplies the station consumes and how demand is measured.
