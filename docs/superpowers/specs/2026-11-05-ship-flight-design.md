# Ship flight: the ship as a real flying body (slice 2 of the landing pad)

Parent: `2026-11-05-landing-pad-design.md` (rules, timetable, boarding, descent, pilots). Ship art: `2026-11-05-ship-refit-design.md`.

## Decisions (TrueMan)
- The ship deck becomes its **own chunk and a rigid body**; the station berth is empty while it is away.
- **Pilots physically walk aboard and ride along** (two Flight-dept pilots, shift-based).
- **Fixed hourly schedule in the sim**; the dev "call a ship" button follows in slice 3.
- Split in two slices: **2a** empty flight, **2b** pilots, portals, riding along.

## Model
- **Ship state is sim state** (hashed, deterministic). A phase timeline replaces the viewer stand-in `render/shipstate.ts` (30-minute cycle).
- **Timeline** (1 tick = 1 sim second), one round trip per sim hour, all constants tunable:
  prep at the station 360 (gate closes 60, bars restrain 60, locked 120, burn 60, release 60) → flight 600 → touchdown, gate opens 60, **pad wait 300** (timer starts at touchdown) → prep at the pad 360 → return flight 600 → docking, gate opens → station dwell for the rest of the hour (about 1380, doors open the whole time). First prep starts at tick 1200 of each hour.
- **Pose** is a pure function of the timeline: position eases (ease in/out, zero speed at both ends) along the straight line from the station berth to the pad berth; heading is nose-west at both berths and turns toward the travel direction for the middle of the flight and back before landing. Gates and bars follow the phase, as in the refit.
- **Ship chunk:** the 21×34 deck (everything from the refit: seats, slots, ramp, canopy, thrusters) is a separate map in local coordinates. The station map keeps only an **empty berth** and its 1×9 Arrivals gate column. While no ship is docked, the gate cells are not walkable (gate closed, void beyond).
- **Streaming:** the snapshot carries the ship chunk once; deltas carry a small `ShipSnap` (timeline origin + slip). The viewer evaluates the pose at its interpolated render tick, so motion is smooth and nothing pops.
- **Pad berth:** the pad chunk already has the berth, gate stub and apron; the ship chunk is drawn over it while landed and the stub gate follows the same phase.

## Slice 2a (empty flight)
1. `sim-core/ship/timeline.ts`: pure `shipPhase(tick)` and constants.
2. `sim-core/ship/pose.ts`: pure `shipPose(tick)` → position, heading, thrust, bars, gate openness.
3. `buildShipChunk()`: the deck blueprint becomes its own chunk; `dock.ts` stamps only the berth and keeps the Arrivals gate; adapt `ship/dock/kit` tests.
4. Protocol: ship chunk in the snapshot, `ShipSnap` in deltas; world hash includes ship state.
5. Viewer: ShipLayer renders the chunk with the pose transform (baked separately); stand-in `shipstate.ts` replaced; gates at the station, ship stern and pad stub driven by phase; dev panel "follow ship" glide.
Tests: timeline sums and cadence (600-tick legs, 300 wait, one trip per hour), pose (endpoints exact, monotonic, zero end speed, heading returns to nose-west), station map has no interior while away, ship chunk keeps every refit fixture, gate not walkable when no ship, determinism (hash equal on replay), viewer fade/ease checks. Visual check at several ticks.

## Slice 2b (pilots)
- Frames (station / ship / pad) and local coordinates for characters; **portals** link gate cells of two frames only while the ship is docked with doors open; path stitching across a portal.
- Flight dept shifts (pilot + co-pilot); job "fly": walk aboard before prep, sit in the flight-deck seats, ride the whole trip, stay seated through the pad wait.
- No pilots on shift: ship stays docked, schedule slips (`slip` in `ShipSnap`), PDA shows it.
- Viewer draws characters aboard through the ship transform.

## Risks and rulings
- Ruling: rotation of a baked pixel-art chunk shimmers at some angles; keep the turn small (about 47 degrees) and accept; revisit if ugly.
- Ruling: schedule is stateless in 2a; in 2b only the departure delay (`slip`) becomes state.
- Risk: moving frames touch pathing; contained by keeping characters out of the ship chunk until 2b.

## Out of scope
Passenger boarding and cargo (slice 4), call-a-ship button and any manual trigger (slice 3), planet surface detail along the descent.
