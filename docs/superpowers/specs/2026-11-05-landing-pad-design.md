# Landing pad + test flight (concept, decisions from TrueMan)

Goal: a real place for the cargo ship to fly to, so we can test the full cycle (doors close, bars lock, burn, fly, land, doors open) before the outpost exists.

## Decisions
- **Site:** on the home planet surface, as a small chunk of the one world map (sparse chunks, rigid-body ship). The outpost grows around it later; the flight path is the real station-to-planet path, so nothing is redone.
- **Pad contents (for now):** ship-sized hazard-marked pad, approach lights/beacons, a loading apron with slot markings matching the hold, and a gate stub where the outpost will attach.
- **Trigger:** both. A dev-panel "call a ship" button for testing, plus an automatic round-trip schedule once it works.

## Proposed slices (each tested + deployed)
1. Pad chunk on the planet surface (sim-core data + viewer render, visible when zoomed in on the planet).
2. Ship as a flying rigid body: undock (gates close, bars lock, burn), flight path with easing, landing on the pad, gates open. Replaces the stand-in 30-minute routine in `render/shipstate.ts` with real state from the sim.
3. Dev panel "call a ship" + automatic schedule.
4. Cargo/people loading at the pad (later, with the outpost).

## Open for discussion
- Flight duration vs the 24h-per-orbit time scale (a flight should be minutes of sim time, not hours).
- Whether the station keeps the ship's dock slot reserved while it is away (empty berth visuals).
