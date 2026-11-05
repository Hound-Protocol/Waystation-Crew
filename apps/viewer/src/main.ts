import { ShipLayer, shipFixtures } from "./render/ship";
import { shipPlacement, aboardPlace, type Rect } from "./render/shipbody";
import { GateLayer } from "./render/gates";
import { PadLayer, padOrigin } from "./render/padlayer";
import type { TileKind } from "@wc/sim-core";
import { PAD, shipPose } from "@wc/sim-core";
import { Application, Container, Graphics, Rectangle, Sprite } from "pixi.js";
import { STATION_NAME, type ServerMsg, type SimTransport, type StatsSnap } from "@wc/protocol";
import { createWorkerTransport } from "./transport/worker";
import { Camera } from "./render/camera";
import { Tracks } from "./render/interp";
import { CharLayer } from "./render/characters";
import { buildTileCanvas, canvasTexture, characterTextures, TILE } from "./render/tiles";
import { nextStop, WheelStepper } from "./render/zoomsteps";
import { LightPass, expectedPixel } from "./render/lights/pass";
import { lightBudget } from "./render/lights/budget";
import { Pda } from "./ui/pda";
import { DevPanel } from "./ui/devpanel";
import { zoomLevel } from "./render/lod";
import { ClockSync } from "./render/clock";
import { DoorLayer } from "./render/doors";
import { doorIsVertical } from "./render/sprites/orient";
import { SolarLayer } from "./render/space/solar";
import { SYSTEM_EXTENT, BODIES, SUN_RADIUS, stationFrame } from "./render/space/system";
import { zoneRadius, outlineWidth, overviewActive, footprintHit, footprintEdges, shipLocal, circleHit, pickTarget, type Grid, type Pt, type Target } from "./render/reticle";
import { Outline, ReticleGlyph } from "./render/reticlelayer";
import { StatusLayer } from "./render/statusicons";
import { OverviewCard, overviewFor, type BodyInfo } from "./ui/overview";
import { StationCard } from "./ui/stationcard";
import { ZoomMarkers } from "./render/zoommarkers";
import { ReactorFx } from "./render/reactorfx";
import { stationView } from "./ui/stationview";
import { CrewTally } from "./ui/crewtally";
import { SpaceLayer } from "./render/space/layer";

const BUILD = (import.meta as unknown as { env: Record<string, string> }).env.VITE_BUILD?.slice(0, 7) ?? "dev";

function showError(msg: string) {
  const el = document.getElementById("hud");
  if (el) el.innerHTML = `<b>${STATION_NAME}</b><br><span style="color:#ff6a6a">${msg}</span>`;
}

async function boot() {
  const app = new Application();
  await app.init({ preference: "webgl", resizeTo: window, background: "#07080b", antialias: false, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
  document.getElementById("app")!.appendChild(app.canvas);

  const world = new Container();
  const mapLayer = new Container();
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;   // phones and tablets get the reduced light budget
  const lightPass = new LightPass(); mapLayer.filters = [lightPass.filter];
  /** the station canvas, left unlit: the light pass lights it on the GPU */
  const stationSprite = (m: { w: number; h: number; tiles: number[]; rooms: any; furniture?: any; deco?: any; floors?: number[] }) => {
    const inp = { w: m.w, h: m.h, tiles: m.tiles, rooms: m.rooms, furniture: m.furniture, deco: m.deco, floors: m.floors };
    const cv = buildTileCanvas(inp, { lit: false }); lightPass.setStation(inp, cv); return new Sprite(canvasTexture(cv));
  };
  const chars = new CharLayer(), status = new StatusLayer();
  // crew aboard the ship stand in its baked-lit deck (in the berth while it is docked or away): no station light applies to them
  chars.light = (x, y) => (berth && x >= berth.x && x < berth.x + berth.w && y >= berth.y && y < berth.y + berth.h ? 1 : lightPass.levelAt(x, y));
  const texs = characterTextures();
  const doorLayer = new DoorLayer(texs);
  const solar = new SolarLayer();
  const shipLayer = new ShipLayer(), gateLayer = new GateLayer(), padLayer = new PadLayer();
  // the ship: its baked deck, its animated parts and its own gates, all in deck-local coordinates, moved and turned as one body
  const shipBody = new Container(), shipBake = new Container(), shipGates = new GateLayer();
  shipBody.addChild(shipBake, shipLayer.root, shipGates.root); shipBody.visible = false;
  const reactorFx = new ReactorFx();
  const reactorSite = (deco?: Array<{ x: number; y: number; sprite: string }>) => reactorFx.setSite(deco?.find((d) => d.sprite === "prop:reactor") ?? null);
  world.addChild(solar.root, padLayer.root, mapLayer, reactorFx.root, gateLayer.root, shipBody, doorLayer.root, chars.root, status.root);
  const space = new SpaceLayer();
  app.stage.addChild(space.root, world);
  const stationOutline = new Outline(), shipOutline = new Outline(), bodyOutline = new Outline(), glyph = new ReticleGlyph();
  world.addChild(stationOutline.g, bodyOutline.g); shipBody.addChild(shipOutline.g); app.stage.addChild(glyph.root);
  const zoomMarkers = new ZoomMarkers(STATION_NAME); app.stage.addChildAt(zoomMarkers.root, app.stage.getChildIndex(glyph.root));
  const card = new OverviewCard(document.body);
  const stationCard = new StationCard(document.body);
  const tally = new CrewTally(); let stats: StatsSnap | null = null; let footprint = 0;
  const countFootprint = (tiles: ArrayLike<number>) => { let n = 0; for (let i = 0; i < tiles.length; i++) if (tiles[i] !== 0) n++; footprint = n; };
  let stationGrid: Grid = { w: 0, h: 0, solid: () => false }, shipGrid: Grid | null = null;
  const gridOf = (w: number, h: number, tiles: ArrayLike<number>): Grid => ({ w, h, solid: (x, y) => x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] !== 0 });
  world.alpha = 0; // fades in with the first snapshot

  chars.textures = texs;
  const marker = new Graphics().rect(0, 0, TILE, TILE).stroke({ color: 0x4de1ff, width: 1 });
  marker.alpha = 0; world.addChild(marker);
  const cam = new Camera(8), tracks = new Tracks();
  let selected: number | null = null, follow = false, markerA = 0, worldA = 0, markerPos: { x: number; y: number } | null = null;
  const clock = new ClockSync(0);
  let fitted = false, mapW = 60, mapH = 40, renderTick = 0, latestTick = 0, speed = 1, paused = false, crew = 0;
  const hud = document.getElementById("hud")!, footer = document.getElementById("footer")!;
  footer.textContent = `${STATION_NAME} · build ${BUILD}`;

  const fades: Sprite[] = [];
  let shipHold: number | null = null;   // dev hook: freeze the ship at a tick of its round trip
  let shipSlip = 0, shipHolding = false, shipAboard = 0;
  let berth: Rect | null = null, followShip = false, shipAt = { x: 0, y: 0 };
  const transport: SimTransport = createWorkerTransport();
  const select = (id: number | null) => {
    selected = id; follow = id !== null; if (id === null) markerPos = null;
    if (id !== null && cam.targetScale < 16) cam.zoomAtSmooth(app.screen.width / 2, app.screen.height / 2, 16 / cam.targetScale);
    if (id === null) pda.hide(); else pda.show();
    panel.select(id); transport.send({ t: "inspect", id });
  };
  const pda = new Pda(() => select(null));
  const panel = new DevPanel({ send: (m) => transport.send(m), onSelect: (id) => select(id), onGoto: (where) => {
    if (selected !== null) select(null);
    if (where === "ship") { followShip = !followShip; if (followShip) cam.zoomAtSmooth(app.screen.width / 2, app.screen.height / 2, 6 / cam.targetScale); return; }
    followShip = false;
    if (where === "pad") cam.glideTo(padOrigin().x + PAD.w / 2, padOrigin().y + PAD.h / 2, 10, app.screen.width, app.screen.height);
    else cam.glideTo(mapW / 2, mapH / 2, 10, app.screen.width, app.screen.height);
  } });
  transport.onMessage((m: ServerMsg) => {
    if (m.t === "snapshot") {
      mapLayer.removeChildren().forEach((c) => c.destroy({ texture: true }));
      mapLayer.addChild(stationSprite(m)); reactorSite(m.deco);
      doorLayer.reset(m.tiles, m.w, m.h, (x, y) => doorIsVertical(m.tiles, m.w, m.h, x, y));
      gateLayer.reset(m.tiles, m.w, m.h);
      stationGrid = gridOf(m.w, m.h, m.tiles); stationOutline.setEdges(footprintEdges(stationGrid));
      if (m.ship) {
        const sh = m.ship;
        shipBake.removeChildren().forEach((c) => c.destroy());
        shipBake.addChild(new Sprite(canvasTexture(buildTileCanvas({ w: sh.w, h: sh.h, tiles: sh.tiles, rooms: sh.rooms, furniture: sh.furniture, deco: sh.deco, floors: sh.floors }))));
        shipLayer.reset(shipFixtures(sh.deco, (x, y) => (x < 0 || y < 0 || x >= sh.w || y >= sh.h ? 0 : sh.tiles[y * sh.w + x]) as TileKind, sh.rooms));
        shipGates.reset(sh.tiles, sh.w, sh.h);
        shipGrid = gridOf(sh.w, sh.h, sh.tiles); shipOutline.setEdges(footprintEdges(shipGrid));
        shipBody.pivot.set((sh.w * TILE) / 2, (sh.h * TILE) / 2); berth = sh.berth; shipBody.visible = true;
      }
      if (m.shipStatus) { shipSlip = m.shipStatus.slip; shipHolding = m.shipStatus.holding; shipAboard = m.shipStatus.aboard; }
      mapW = m.w; mapH = m.h; crew = m.chars.length; tally.reset(m.chars); stats = m.stats ?? null; if (stats) lightPass.setSupply(stats.power.supplyLevel); countFootprint(m.tiles);
      chars.reset(m.chars); status.reset(m.chars); tracks.reset(m.chars); panel.setChars(m.chars); if (selected !== null) select(null);
      renderTick = latestTick = m.tick; clock.reset(m.tick, speed);
      if (!fitted) {
        cam.fit(mapW, mapH, app.screen.width, app.screen.height);
        if (cam.scale < 10) { cam.zoomAt(app.screen.width / 2, app.screen.height / 2, 10 / cam.scale); cam.centerOn(mapW / 2, mapH / 2, app.screen.width, app.screen.height); }
        fitted = true;
      }
    } else if (m.t === "station") {
      // station grew: bake the new map under the old one and cross-fade (no pop-in)
      const next = stationSprite(m); reactorSite(m.deco);
      next.alpha = 0; mapLayer.addChild(next); fades.push(next);
      doorLayer.reset(m.tiles, m.w, m.h, (x, y) => doorIsVertical(m.tiles, m.w, m.h, x, y));
      gateLayer.reset(m.tiles, m.w, m.h);
      stationGrid = gridOf(m.w, m.h, m.tiles); stationOutline.setEdges(footprintEdges(stationGrid));
      mapW = m.w; mapH = m.h; countFootprint(m.tiles);
    } else if (m.t === "delta") {
      if (m.shipStatus) { shipSlip = m.shipStatus.slip; shipHolding = m.shipStatus.holding; shipAboard = m.shipStatus.aboard; }
      for (const tc of m.tasks ?? []) status.setTask(tc.id, tc.task);
      for (const sc of m.states) tally.setState(sc.id, sc.state);
      if (m.stats) { stats = m.stats; lightPass.setSupply(stats.power.supplyLevel); }
      tracks.apply(m.moves); tracks.prune(m.tick - 120); latestTick = m.tick; speed = m.clock.speed; paused = m.clock.paused;
      panel.updateStates(m.states); panel.setClock(paused);
    } else if (m.id === selected) { panel.setInspect(m.lines); if (m.profile) pda.update(m.profile); }
  });
  setTimeout(() => { if (!fitted) showError("The simulation did not start (worker blocked or unsupported browser)."); }, 6000);
  transport.send({ t: "subscribe", viewport: { x: 0, y: 0, w: mapW, h: mapH, zoom: 3 } });

  // input: wheel zoom, drag pan, pinch zoom
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const cv = app.canvas;
  const wheel = new WheelStepper();   // the wheel snaps between the defined zoom stops, aimed at the screen centre (the reticle)
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const dir = wheel.feed(e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY, performance.now()); if (dir) { followShip = false; cam.zoomAtSmooth(app.screen.width / 2, app.screen.height / 2, nextStop(cam.targetScale, dir) / cam.targetScale); } }, { passive: false });
  let down = { x: 0, y: 0, moved: 0 }; let vel = { x: 0, y: 0, t: 0 };
  cv.addEventListener("pointerdown", (e) => { followShip = false; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); pinch = 0; down = { x: e.offsetX, y: e.offsetY, moved: 0 }; vel = { x: 0, y: 0, t: 0 }; cam.fling(0, 0); });
  cv.addEventListener("pointerup", (e) => {
    ptrs.delete(e.pointerId); pinch = 0;
    if (down.moved >= 5 && ptrs.size === 0 && performance.now() - vel.t < 80) cam.fling(vel.x, vel.y);
    if (down.moved < 5 && ptrs.size === 0) {
      const w = cam.screenToWorld(e.offsetX, e.offsetY); let best: number | null = null, bd = 1.2;
      for (let id = 0; id < crew; id++) { const p0 = tracks.positionAt(id, renderTick); if (!p0) continue; const p = chars.place ? chars.place(p0.x, p0.y) : p0; const d = Math.hypot(p.x + 0.5 - w.x, p.y + 0.5 - w.y); if (d < bd) { bd = d; best = id; } }
      select(best);
    }
  });
  cv.addEventListener("pointercancel", (e) => { ptrs.delete(e.pointerId); pinch = 0; });
  cv.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) { const now = performance.now(), dtm = Math.max(1, now - (vel.t || now - 16)); vel = { x: vel.x * 0.5 + ((e.offsetX - p.x) / dtm) * 1000 * 0.5, y: vel.y * 0.5 + ((e.offsetY - p.y) / dtm) * 1000 * 0.5, t: now }; cam.pan(e.offsetX - p.x, e.offsetY - p.y); down.moved += Math.abs(e.offsetX - p.x) + Math.abs(e.offsetY - p.y); if (down.moved >= 5) follow = false; }
    p.x = e.offsetX; p.y = e.offsetY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
      pinch = d;
    }
  });

  app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS / 1000, 0.1);
    renderTick = clock.update(dt, latestTick, speed, paused);
    cam.update(dt);
    if (follow && selected !== null) { const p0 = tracks.positionAt(selected, renderTick), p = p0 && chars.place ? chars.place(p0.x, p0.y) : p0; if (p) cam.followToward(p.x + 0.5, p.y + 0.5, app.screen.width, app.screen.height, dt); }
    cam.clampRect(mapW / 2 - SYSTEM_EXTENT, mapH / 2 - SYSTEM_EXTENT, SYSTEM_EXTENT * 2, SYSTEM_EXTENT * 2, app.screen.width, app.screen.height);
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i]; f.alpha = Math.min(1, f.alpha + dt / 1.2);
      if (f.alpha >= 1) { for (const o of mapLayer.children.slice(0, -1)) if (o !== f) o.destroy({ texture: true }); fades.splice(i, 1); }
    }
    if (fitted) worldA = Math.min(1, worldA + dt / 0.7);
    world.alpha = worldA * worldA * (3 - 2 * worldA);
    world.scale.set(cam.scale / TILE); world.position.set(cam.tx, cam.ty);
    lightPass.budget = lightBudget({ mobile: coarsePointer, scale: cam.scale });
    lightPass.update(dt, cam.tx, cam.ty, cam.scale, app.screen.width, app.screen.height, app.renderer.resolution);
    solar.update(dt, renderTick, cam.scale);
    const time = performance.now() / 1000, pose = shipPose(shipHold ?? renderTick - shipSlip);
    if (berth) {
      const pad = padOrigin(), padBerth = { x: pad.x + PAD.berth.x, y: pad.y + PAD.berth.y, w: PAD.berth.w, h: PAD.berth.h };
      const pl = shipPlacement(pose, berth, padBerth);
      shipBody.position.set(pl.x * TILE, pl.y * TILE); shipBody.rotation = pl.rot; shipAt = pl; chars.place = aboardPlace(berth, pl);
      if (followShip) cam.followToward(pl.x, pl.y, app.screen.width, app.screen.height, dt);
    }
    reactorFx.update(dt, performance.now() / 1000, stats ? stats.power : null);
    zoomMarkers.update(dt, cam, { x: mapW / 2, y: mapH / 2 }, berth ? shipAt : null);
    shipLayer.update(pose, time);
    const aboard = pose.at === "station" ? pose.stationGate : pose.at === "pad" ? pose.padGate : { v: 0, moving: false };   // the ship's gates follow the dock it sits at
    shipGates.update(time, { gate: aboard.v, gateMoving: aboard.moving });
    padLayer.update(time, cam.scale, { gate: pose.padGate.v, gateMoving: pose.padGate.moving });
    space.update(dt, cam.tx, cam.ty, app.screen.width, app.screen.height);
    if (selected !== null) {
      const p0 = tracks.positionAt(selected, renderTick), p = p0 && chars.place ? chars.place(p0.x, p0.y) : p0;
      if (p) { markerPos = markerPos ? { x: markerPos.x + (p.x - markerPos.x) * (1 - Math.exp(-dt * 20)), y: markerPos.y + (p.y - markerPos.y) * (1 - Math.exp(-dt * 20)) } : { x: p.x, y: p.y }; marker.position.set(markerPos.x * TILE, markerPos.y * TILE); }
    }
    markerA += ((selected !== null ? 1 : 0) - markerA) * (1 - Math.exp(-dt * 14));
    marker.alpha = markerA < 0.01 ? 0 : markerA;
    gateLayer.update(time, { gate: pose.stationGate.v, gateMoving: pose.stationGate.moving });
    doorLayer.update(dt, chars.ids, (id) => tracks.positionAt(id, renderTick));
    lightPass.setDoors(doorLayer.model.doors, doorLayer.model.open);
    chars.update(dt, renderTick, tracks, cam, app.screen.width, app.screen.height);
    status.place = chars.place; status.update(dt, renderTick, tracks, cam, app.screen.width, app.screen.height);
    const d = Math.floor((latestTick + 21600) / 86400) + 1, h = Math.floor(((latestTick / 3600) + 6) % 24), m = Math.floor((latestTick / 60) % 60);
    hud.innerHTML = `<b>${STATION_NAME}</b> · day ${d} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · crew ${crew} · Z${zoomLevel(cam.scale)}${paused ? " · paused" : ""}${shipHolding ? " · ship waiting for pilots" : ""}${speed !== 1 ? ` · ${speed}x` : ""}`;
    const level = zoomLevel(cam.scale), active = fitted && overviewActive(level);
    glyph.update(dt, app.screen.width, app.screen.height, active);
    const sview = stationView({ name: STATION_NAME, tick: renderTick, shipTick: shipHold ?? renderTick - shipSlip, slip: shipSlip, holding: shipHolding, aboard: shipAboard, crew, deptCounts: tally.deptCounts(), activity: tally.activity(), footprint, stats });
    stationCard.record(dt, sview);
    let hit: { id: string } | null = null;
    if (active) {
      const zc = cam.screenToWorld(app.screen.width / 2, app.screen.height / 2), zr = zoneRadius(app.screen.height) / cam.scale;
      const frame = stationFrame(renderTick);
      const targets: (Target & { circle?: { c: Pt; r: number } })[] = [];
      if (berth && shipGrid) targets.push({ id: "ship", hit: (c, r) => footprintHit(shipGrid!, shipLocal(c, shipAt as { x: number; y: number; rot: number }, shipGrid!.w, shipGrid!.h), r) });
      targets.push({ id: "station", hit: (c, r) => footprintHit(stationGrid, c, r) });
      for (const b of BODIES) { const p = frame.body(b); targets.push({ id: `body:${b.name}`, circle: { c: p, r: b.radius }, hit: (c, r) => circleHit(p, b.radius, c, r) }); }
      targets.push({ id: "body:Sun", circle: { c: frame.sun, r: SUN_RADIUS }, hit: (c, r) => circleHit(frame.sun, SUN_RADIUS, c, r) });
      const t = pickTarget(zc, zr, targets); hit = t;
      if (t?.circle) bodyOutline.setCircle(t.circle.c, t.circle.r);
      const bodies = new Map<string, BodyInfo>();
      for (const tg of targets) if (tg.circle) { const n = tg.id.slice(5); bodies.set(n, { name: n, kind: n === "Sun" ? "Star" : "Planet", distance: Math.hypot(tg.circle.c.x - frame.station.x, tg.circle.c.y - frame.station.y) }); }
      card.update(dt, t && t.id !== "station" ? overviewFor(t.id, { stationName: STATION_NAME, crew, clock: `day ${d} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, shipTick: shipHold ?? renderTick - shipSlip, slip: shipSlip, holding: shipHolding, aboard: shipAboard, bodies }) : null);
      stationCard.update(dt, t?.id === "station" ? sview : null);
    } else { card.update(dt, null); stationCard.update(dt, null); }
    const ow = outlineWidth(cam.scale); stationOutline.setWidth(ow); shipOutline.setWidth(ow); bodyOutline.setWidth(ow);
    stationOutline.update(dt, hit?.id === "station"); shipOutline.update(dt, hit?.id === "ship"); bodyOutline.update(dt, !!hit && hit.id.startsWith("body:"));
  });
  (window as unknown as { __wc: unknown }).__wc = { lightPass, lightProbe: async (n = 120) => { const sc = cam.scale, W = app.screen.width, H = app.screen.height; let bad = 0, tot = 0; const rows: unknown[] = [];
    const full = app.renderer.extract.pixels({ target: app.stage, frame: new Rectangle(0, 0, W, H), resolution: app.renderer.resolution }).pixels; const res = app.renderer.resolution, RW = Math.round(W * res);   // one full-screen read: the light filter maps pixels relative to the render target, so a 1x1 frame would shift it
    for (let i = 0; i < n; i++) { const sx = 20 + ((i * 97) % (W - 40)), sy = 20 + ((i * 53) % (H - 40)); const t = cam.screenToWorld(sx, sy); const e = expectedPixel(lightPass, t.x, t.y, sc); if (!e) continue;
      const o = (Math.round(sy * res) * RW + Math.round(sx * res)) * 4, px = [full[o], full[o + 1], full[o + 2]]; tot++; const diff = Math.max(Math.abs(px[0] - e[0]), Math.abs(px[1] - e[1]), Math.abs(px[2] - e[2])); if (diff > 14) { bad++; if (rows.length < 40) rows.push({ sx, sy, tx: t.x, ty: t.y, gpu: px, cpu: e.map(Math.round) }); } }
    return { tot, bad, rows }; }, cam, transport, holdShip: (tick: number | null) => { shipHold = tick; }, shipAt: () => shipAt, focus: (kind: number, nth = 0) => { const id = status.find(kind, nth); if (id === null) return null; const p0 = tracks.positionAt(id, renderTick); if (!p0) return null; const p = chars.place ? chars.place(p0.x, p0.y) : p0; cam.centerOn(p.x + 0.5, p.y + 0.5, app.screen.width, app.screen.height); return id; } };
}
boot().catch((e) => showError(`Could not start the renderer: ${e instanceof Error ? e.message : e}`));
