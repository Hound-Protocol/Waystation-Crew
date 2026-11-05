# Reticle and overview card

- A faint reticle (square + dot, 70% transparent) sits at the screen centre. Its zone is a circle with a diameter of 20% of the screen height.
- Only at zoom levels 1-2 (characters in full detail): the reticle fades in, and whatever the zone covers gets an eased outline and a 16:9 summary card at the bottom. At other levels both stay hidden.
- Priority: ship, station, planets, sun. Targets are shapes, not boxes: the station and the ship are tile footprints (`Grid`), so modular, grown or holed stations outline themselves (`footprintEdges` merges tile-edge runs). Planets and the sun are discs.
- Card: Station (crew, time, ship), Cargo ship (status, lift-off or arrival countdown, aboard, delay), Planet/Star (distance). It lingers 0.35 s after the zone leaves, and cross-fades between targets.
- `ShipStatus` gained `aboard` (crew locked aboard).

## Ship schedule change (same session)
- The station sits twice as far from the home planet (offset 1400,-1040, about 1740 tiles). Flights take 5 minutes each way (`FLIGHT = 300`), the cycle is `CYCLE = 3000` ticks (50 min); the dwell is unchanged (1380). This replaces the hourly cadence in the ship-flight spec.
