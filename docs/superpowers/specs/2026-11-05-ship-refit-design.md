# Cargo ship refit (implemented)

Goal: give the docked hauler personality. Same footprint (21x34 deck, hold dimensions kept).

## Elite Dangerous principles we borrow
- Three thruster classes: **main** (rear, forward push), **retro** (opposes main, braking), **RCS / manoeuvring** (flanks, lateral + vertical + yaw).
- Flight assist is a software layer over Newtonian motion: on = ship damps drift and flies "like a plane"; off = momentum conserved, RCS does the rotating.
- Boost = short burst beyond cruise thrust. Thrust is on/off at full power for lateral jets.
- Landing: lateral/vertical jets matter most when gear is down.

## Mapping to Waystation
- **4 main thrusters** at the stern: pairs, each a nozzle with a plume sprite. States: cold (docked), pilot-light glow (pre-departure), burn (flying), boost flare (undock/launch).
- **Retro** = small forward-facing nozzles on the nose flanks, fire when braking into dock/landing.
- **RCS** = tiny jets on the flanks, puff during undock/landing nudges (later, with flight).
- Flight assist: ship flight uses assist-ON model (auto-damped, predictable) so the 24/7 sim stays deterministic.

## Interior zones (front to back)
1. **Flight deck** (own room, bulkhead door): pilot seat, co-pilot seat, instrument consoles, canopy windows.
2. **Passenger line**: one continuous row of animated seats running to the stern; shoulder restraint bars: open -> lowering -> locked before departure, raise after landing.
3. **Cargo hold** (the red-boxed middle/rear area): hazard-striped perimeter, slot grid for small / medium / large cargo, loader lane.

## Window types
- **Canopy** (wide, flight deck front), **viewport** (rectangular side), **porthole** (round, small), **blast shutter** (closed during burn/landing).

## Decisions (TrueMan)
- Seats: two rows down both hulls, centre aisle, to the very back (36 seats).
- Restraints: driven by ship state (idle -> bars lower -> locked -> burn -> bars raise). `render/shipstate.ts` is a stand-in 30-min cycle until real flights drive it.
- Cargo: S/M/L slots (8 large 2x2, 8 medium 2x1, 12 small), hazard-striped frame, loader lane down the middle.
- Thrusters: four visible stern nozzles with animated plumes and heat glow; flight deck with 3 stations + instrument racks; windows: canopy, viewport, porthole, shutter (+ nozzle mouth).
- Note: sprites aren't rotated with blueprints, so the docked ship's seat/thruster art assumes stern = east (dock.ts flips the far-hull seats).
