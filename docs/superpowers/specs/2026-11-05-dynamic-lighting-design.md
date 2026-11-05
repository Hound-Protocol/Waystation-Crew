# Dynamic lighting and power

## Decisions (TrueMan)
- **Dynamic means:** lights change state (on/off/dim/flicker/colour), lights move (ship), star and time-of-day light, events and effects.
- **Shadows:** full 2D shadows. **Everything solid** blocks light (walls, closed doors, all solid furniture). Open doors and windows let light through.
- **Look:** quantized brightness bands (six steps, as today); soft edges when zoomed in close, banded when zoomed out.
- **State owner:** the sim. All viewers see the same lighting; it can affect gameplay.
- **Sources:** point, spot (cone), area/strip, directional star light.
- **Authoring:** a kinds table (fixture kind -> light) plus room defaults (ceiling lights from the room template). Grown stations light themselves.
- **Power:** real grid: generators supply a total; rooms demand power; shortage sheds the lowest-priority rooms first.
- **Shortage effects:** dimming and red emergency lighting; work stops at unpowered workstations; doors and gates fail; characters react.
- **Characters:** lit by the local light and cast shadows.
- **Ship and star:** the ship carries its own lights; windows let starlight in; the ship lights the pad and the berth; the planet has a night side.
- **Target:** desktop first (GPU shader). Phones get a reduced mode: fewer lights, shadows only for the lights nearest the view.
- **Order:** engine first, then light state and per-room circuits, then ship and star light, then the power grid's gameplay effects and event effects.

## Model
```
LightSource { id; kind: "point" | "spot" | "area" | "sun"; x, y (world tiles); radius; colour; intensity;
              dir, cone (spot); w, h or a segment (area); flicker?; circuit?: roomId }
```
- **Static set, derived in the viewer** from the station snapshot: fixture kinds table (console = cool cyan, lamp = warm, reactor = orange, ...) plus room defaults (one ceiling light per N tiles of floor). It is recomputed when the station grows. Nothing about it is sent over the wire.
- **Dynamic state, sent by the sim:** per-room circuit level (`full | dim | off | emergency`), generator output, and event flashes. A light's final intensity is `base * circuitFactor * flicker * (day factor for windows)`.
- **Occluders** are tiles and furniture footprints (`solid`), taken from the same map the sim paths on. A door is solid while closed.
- **Moving lights:** the ship's lights are authored in the ship chunk's local tile coordinates and transformed by the ship's drawn placement every frame; its occluders move with it.

## Rendering (viewer, GPU)
- A light buffer at tile-relative resolution: for each visible light, build a 1D shadow map by casting rays against an occluder texture (tile grid), then accumulate colour and intensity into the buffer.
- The final pass quantizes the buffer into six steps and blends the step edges with a soft transition that grows with zoom. Emissive pixels are never darkened (as today). Sprites (characters, ship) sample the same buffer; characters also contribute occluders (small).
- A per-device budget caps visible lights; reduced mode lowers the cap and shadow quality. Lights outside the view are culled.
- The baked lighting in `tiles.ts` goes away once the engine is in.

## Sim: power and circuits (slice 2)
- Each room is a **circuit** with a demand and a priority; generators (the reactor, later others) provide a supply. Per tick: if demand exceeds supply, shed the lowest-priority rooms first (`full -> dim -> off`), with `emergency` as the lit-red state of an unpowered room. Hysteresis stops flicker between levels.
- Events (generator damage, schedule dim at night) change supply or force levels; everything is deterministic and part of the world hash.

## Slices
1. **Engine:** light sources and kinds table, GPU lights with full shadows, quantized soft look, lit characters, reduced mode; replaces the baked lighting. Visual checks at several zoom levels and device budgets.
2. **Light state and circuits:** sim circuits and power levels, protocol field, viewer follows, dev controls to cut a room and a generator.
3. **Ship and star light:** ship's own lights, window starlight by orbit and time of day, planet night side, ship lighting the pad and berth.
4. **Power effects and events:** work stops, doors and gates fail, characters react; one-off flashes and effects.

## Risks
- Everything-solid shadows are busy and can make rooms dark and hard to read; keep a floor on the ambient and a minimum light around characters, and tune with screenshots.
- Per-frame shadow cost grows with the number of lights; the budget and culling are part of slice 1, not later.
- Casting through a moving ship needs the occluder texture to be updated for the ship body every frame; measure early.
