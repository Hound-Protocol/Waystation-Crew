# Landing pad + test flight (concept, decisions from TrueMan)

Goal: a real place for the cargo ship to fly to, so we can test the full cycle (doors close, bars lock, burn, fly, land, doors open) before the outpost exists.

## Decisions
- **Site:** on the home planet surface, as a small chunk of the one world map (sparse chunks, rigid-body ship). The outpost grows around it later; the flight path is the real station-to-planet path, so nothing is redone.
- **Pad contents (for now):** ship-sized hazard-marked pad, approach lights/beacons, a loading apron with slot markings matching the hold, and a gate stub where the outpost will attach.
- **Trigger:** both. A dev-panel "call a ship" button for testing, plus an automatic round-trip schedule once it works.

## Flight and schedule rules (TrueMan)
- Destination: the blue home planet beside the station (needs a surface at the pad). One leg = 10 real minutes (600 ticks at 1x).
- On landing the ship starts a 5-minute timer; it leaves early only when full (pilots close the doors and go).
- It sticks to its schedule even half empty.
- The game tracks whether each would-be passenger is in the boarding process (next to the ship / on the pad). If departure time arrives, anyone too far away and not on the pad is left behind; pilots take off on schedule.

## Answers to the open questions (TrueMan)
- **Timetable:** fixed round trip: station departure at fixed times, 10 min flight, 5 min planet wait, 10 min back, then a station dwell; one round trip per sim hour (tunable constant).
- **Boarding:** a person counts as boarding when on the pad or within ~12 tiles of it heading to the ship. At departure anyone outside is left behind and re-queues for the next ship (never popped in or out).
- **Descent:** real-scale flight on the true 600-tick path in map space; the planet gains tile-level surface detail near the pad as the camera follows the ship down (surface fades in, no pop).
- **Pilots:** two Flight-department pilots (pilot + co-pilot), shift-based. With nobody on shift the ship stays docked and the schedule slips, shown in the PDA.

## Proposed slices (each tested + deployed)
1. Pad chunk on the planet surface (sim-core data + viewer render, visible when zoomed in on the planet).
2. Ship as a flying rigid body (design: `2026-11-05-ship-flight-design.md`, split 2a empty flight / 2b pilots): undock (gates close, bars lock, burn), flight path with easing, landing on the pad, gates open. Replaces the stand-in 30-minute routine in `render/shipstate.ts` with real state from the sim.
3. Dev panel "call a ship" + automatic schedule.
4. Cargo/people loading at the pad (later, with the outpost).

## Open for discussion
- Flight duration vs the 24h-per-orbit time scale (a flight should be minutes of sim time, not hours).
- Whether the station keeps the ship's dock slot reserved while it is away (empty berth visuals).
