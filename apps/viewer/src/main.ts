import { Application, Container, Graphics, Sprite } from "pixi.js";
import { STATION_NAME, type ServerMsg, type SimTransport } from "@wc/protocol";
import { createWorkerTransport } from "./transport/worker";
import { Camera } from "./render/camera";
import { Tracks } from "./render/interp";
import { CharLayer } from "./render/characters";
import { buildTileCanvas, canvasTexture, characterTextures, TILE } from "./render/tiles";
import { DevPanel } from "./ui/devpanel";
import { zoomLevel } from "./render/lod";

const BUILD = (import.meta as unknown as { env: Record<string, string> }).env.VITE_BUILD?.slice(0, 7) ?? "dev";

async function boot() {
  const app = new Application();
  await app.init({ resizeTo: window, background: "#07080b", antialias: false, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
  document.getElementById("app")!.appendChild(app.canvas);

  const world = new Container();
  const mapLayer = new Container();
  const chars = new CharLayer();
  world.addChild(mapLayer, chars.root);
  app.stage.addChild(world);

  chars.textures = characterTextures();
  const marker = new Graphics().rect(0, 0, TILE, TILE).stroke({ color: 0x4de1ff, width: 1 });
  marker.visible = false; world.addChild(marker);
  const cam = new Camera(8), tracks = new Tracks();
  let selected: number | null = null, follow = false;
  let fitted = false, mapW = 60, mapH = 40, renderTick = 0, latestTick = 0, speed = 1, paused = false, crew = 0;
  const hud = document.getElementById("hud")!, footer = document.getElementById("footer")!;
  footer.textContent = `${STATION_NAME} · build ${BUILD}`;

  const transport: SimTransport = createWorkerTransport();
  const select = (id: number | null) => {
    selected = id; follow = id !== null; marker.visible = id !== null;
    if (id !== null && cam.scale < 16) cam.zoomAt(app.screen.width / 2, app.screen.height / 2, 16 / cam.scale);
    panel.select(id); transport.send({ t: "inspect", id });
  };
  const panel = new DevPanel({ send: (m) => transport.send(m), onSelect: (id) => select(id) });
  transport.onMessage((m: ServerMsg) => {
    if (m.t === "snapshot") {
      mapLayer.removeChildren();
      mapLayer.addChild(new Sprite(canvasTexture(buildTileCanvas(m.w, m.h, m.tiles, m.rooms))));
      mapW = m.w; mapH = m.h; crew = m.chars.length;
      chars.reset(m.chars); tracks.reset(m.chars); panel.setChars(m.chars); if (selected !== null) select(null);
      renderTick = latestTick = m.tick;
      if (!fitted) { cam.fit(mapW, mapH, app.screen.width, app.screen.height); fitted = true; }
    } else if (m.t === "delta") {
      tracks.apply(m.moves); tracks.prune(m.tick - 120); latestTick = m.tick; speed = m.clock.speed; paused = m.clock.paused;
      panel.updateStates(m.states); panel.setClock(paused);
    } else if (m.id === selected) panel.setInspect(m.lines);
  });
  transport.send({ t: "subscribe", viewport: { x: 0, y: 0, w: mapW, h: mapH, zoom: 3 } });

  // input: wheel zoom, drag pan, pinch zoom
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const cv = app.canvas;
  cv.addEventListener("wheel", (e) => { e.preventDefault(); cam.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  let down = { x: 0, y: 0, moved: 0 };
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); pinch = 0; down = { x: e.offsetX, y: e.offsetY, moved: 0 }; });
  cv.addEventListener("pointerup", (e) => {
    ptrs.delete(e.pointerId); pinch = 0;
    if (down.moved < 5 && ptrs.size === 0) {
      const w = cam.screenToWorld(e.offsetX, e.offsetY); let best: number | null = null, bd = 1.2;
      for (let id = 0; id < crew; id++) { const p = tracks.positionAt(id, renderTick); if (!p) continue; const d = Math.hypot(p.x + 0.5 - w.x, p.y + 0.5 - w.y); if (d < bd) { bd = d; best = id; } }
      select(best);
    }
  });
  cv.addEventListener("pointercancel", (e) => { ptrs.delete(e.pointerId); pinch = 0; });
  cv.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) { cam.pan(e.offsetX - p.x, e.offsetY - p.y); down.moved += Math.abs(e.offsetX - p.x) + Math.abs(e.offsetY - p.y); if (down.moved >= 5) follow = false; }
    p.x = e.offsetX; p.y = e.offsetY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
      pinch = d;
    }
  });

  app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS / 1000, 0.1);
    if (!paused) renderTick += dt * speed;
    const lag = latestTick - renderTick;
    if (lag > 60) renderTick = latestTick - 1; else if (lag > 3) renderTick += (lag - 2) * 0.1;
    renderTick = Math.min(renderTick, latestTick);
    if (follow && selected !== null) { const p = tracks.positionAt(selected, renderTick); if (p) cam.centerOn(p.x + 0.5, p.y + 0.5, app.screen.width, app.screen.height); }
    cam.clamp(mapW, mapH, app.screen.width, app.screen.height);
    world.scale.set(cam.scale / TILE); world.position.set(Math.round(cam.tx), Math.round(cam.ty));
    if (selected !== null) { const p = tracks.positionAt(selected, renderTick); if (p) marker.position.set(p.x * TILE, p.y * TILE); }
    chars.update(dt, renderTick, tracks, cam, app.screen.width, app.screen.height);
    const d = Math.floor((latestTick + 21600) / 86400) + 1, h = Math.floor(((latestTick / 3600) + 6) % 24), m = Math.floor((latestTick / 60) % 60);
    hud.innerHTML = `<b>${STATION_NAME}</b> · day ${d} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · crew ${crew} · Z${zoomLevel(cam.scale)}${paused ? " · paused" : ""}${speed !== 1 ? ` · ${speed}x` : ""}`;
  });
  (window as unknown as { __wc: unknown }).__wc = { cam, transport };
}
boot();
