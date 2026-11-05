import { Application, Container, Graphics, Sprite } from "pixi.js";
import { STATION_NAME, type ServerMsg, type SimTransport } from "@wc/protocol";
import { createWorkerTransport } from "./transport/worker";
import { Camera } from "./render/camera";
import { Tracks } from "./render/interp";
import { CharLayer } from "./render/characters";
import { buildTileCanvas, canvasTexture, characterTextures, TILE } from "./render/tiles";
import { DevPanel } from "./ui/devpanel";
import { zoomLevel } from "./render/lod";
import { ClockSync } from "./render/clock";
import { DoorLayer } from "./render/doors";
import { wallIsVertical } from "./render/sprites/orient";
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
  const chars = new CharLayer();
  const texs = characterTextures();
  const doorLayer = new DoorLayer(texs);
  world.addChild(mapLayer, doorLayer.root, chars.root);
  const space = new SpaceLayer();
  app.stage.addChild(space.root, world);
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

  const transport: SimTransport = createWorkerTransport();
  const select = (id: number | null) => {
    selected = id; follow = id !== null; if (id === null) markerPos = null;
    if (id !== null && cam.targetScale < 16) cam.zoomAtSmooth(app.screen.width / 2, app.screen.height / 2, 16 / cam.targetScale);
    panel.select(id); transport.send({ t: "inspect", id });
  };
  const panel = new DevPanel({ send: (m) => transport.send(m), onSelect: (id) => select(id) });
  transport.onMessage((m: ServerMsg) => {
    if (m.t === "snapshot") {
      mapLayer.removeChildren();
      mapLayer.addChild(new Sprite(canvasTexture(buildTileCanvas(m.w, m.h, m.tiles, m.rooms))));
      doorLayer.reset(m.tiles, m.w, m.h, (x, y) => wallIsVertical(m.tiles, m.w, m.h, x, y));
      mapW = m.w; mapH = m.h; crew = m.chars.length;
      chars.reset(m.chars); tracks.reset(m.chars); panel.setChars(m.chars); if (selected !== null) select(null);
      renderTick = latestTick = m.tick; clock.reset(m.tick, speed);
      if (!fitted) {
        cam.fit(mapW, mapH, app.screen.width, app.screen.height);
        if (cam.scale < 10) { cam.zoomAt(app.screen.width / 2, app.screen.height / 2, 10 / cam.scale); cam.centerOn(52, 9, app.screen.width, app.screen.height); }
        fitted = true;
      }
    } else if (m.t === "delta") {
      tracks.apply(m.moves); tracks.prune(m.tick - 120); latestTick = m.tick; speed = m.clock.speed; paused = m.clock.paused;
      panel.updateStates(m.states); panel.setClock(paused);
    } else if (m.id === selected) panel.setInspect(m.lines);
  });
  setTimeout(() => { if (!fitted) showError("The simulation did not start (worker blocked or unsupported browser)."); }, 6000);
  transport.send({ t: "subscribe", viewport: { x: 0, y: 0, w: mapW, h: mapH, zoom: 3 } });

  // input: wheel zoom, drag pan, pinch zoom
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const cv = app.canvas;
  cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.zoomAtSmooth(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  let down = { x: 0, y: 0, moved: 0 }; let vel = { x: 0, y: 0, t: 0 };
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); pinch = 0; down = { x: e.offsetX, y: e.offsetY, moved: 0 }; vel = { x: 0, y: 0, t: 0 }; cam.fling(0, 0); });
  cv.addEventListener("pointerup", (e) => {
    ptrs.delete(e.pointerId); pinch = 0;
    if (down.moved >= 5 && ptrs.size === 0 && performance.now() - vel.t < 80) cam.fling(vel.x, vel.y);
    if (down.moved < 5 && ptrs.size === 0) {
      const w = cam.screenToWorld(e.offsetX, e.offsetY); let best: number | null = null, bd = 1.2;
      for (let id = 0; id < crew; id++) { const p = tracks.positionAt(id, renderTick); if (!p) continue; const d = Math.hypot(p.x + 0.5 - w.x, p.y + 0.5 - w.y); if (d < bd) { bd = d; best = id; } }
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
    if (follow && selected !== null) { const p = tracks.positionAt(selected, renderTick); if (p) cam.followToward(p.x + 0.5, p.y + 0.5, app.screen.width, app.screen.height, dt); }
    cam.clamp(mapW, mapH, app.screen.width, app.screen.height);
    if (fitted) worldA = Math.min(1, worldA + dt / 0.7);
    world.alpha = worldA * worldA * (3 - 2 * worldA);
    world.scale.set(cam.scale / TILE); world.position.set(cam.tx, cam.ty);
    space.update(dt, cam.tx, cam.ty, app.screen.width, app.screen.height);
    if (selected !== null) {
      const p = tracks.positionAt(selected, renderTick);
      if (p) { markerPos = markerPos ? { x: markerPos.x + (p.x - markerPos.x) * (1 - Math.exp(-dt * 20)), y: markerPos.y + (p.y - markerPos.y) * (1 - Math.exp(-dt * 20)) } : { x: p.x, y: p.y }; marker.position.set(markerPos.x * TILE, markerPos.y * TILE); }
    }
    markerA += ((selected !== null ? 1 : 0) - markerA) * (1 - Math.exp(-dt * 14));
    marker.alpha = markerA < 0.01 ? 0 : markerA;
    doorLayer.update(dt, chars.ids, (id) => tracks.positionAt(id, renderTick));
    chars.update(dt, renderTick, tracks, cam, app.screen.width, app.screen.height);
    const d = Math.floor((latestTick + 21600) / 86400) + 1, h = Math.floor(((latestTick / 3600) + 6) % 24), m = Math.floor((latestTick / 60) % 60);
    hud.innerHTML = `<b>${STATION_NAME}</b> · day ${d} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · crew ${crew} · Z${zoomLevel(cam.scale)}${paused ? " · paused" : ""}${speed !== 1 ? ` · ${speed}x` : ""}`;
  });
  (window as unknown as { __wc: unknown }).__wc = { cam, transport };
}
boot().catch((e) => showError(`Could not start the renderer: ${e instanceof Error ? e.message : e}`));
