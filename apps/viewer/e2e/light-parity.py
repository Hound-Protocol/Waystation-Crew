"""GPU light pass vs the CPU reference model, at device pixel ratio 1 and 2 (the 2x run once exposed a misplaced-lighting bug).
Needs `vite preview` on :4173 and Chrome. Software rendering at 2x is slow (the first-load fade takes many seconds), hence the long waits.
Usage: python3 e2e/light-parity.py"""
import json, sys
from playwright.sync_api import sync_playwright
JS = """(async(settle)=>{const c=__wc.cam;c.zoomAt(640,300,40/c.scale);const out={};await new Promise(r=>setTimeout(r,settle));
for(const n of [48,8,0]){__wc.lightPass.cap=n;await new Promise(r=>setTimeout(r,settle/2));const r=await __wc.lightProbe(200);out[n]=[r.bad,r.tot]}return out})"""
failed = False
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"])
    for dpr, settle in ((1, 4000), (2, 16000)):
        p = b.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=dpr); p.goto("http://localhost:4173/"); p.wait_for_timeout(5000 * dpr)
        r = p.evaluate(JS + f"({settle})"); p.close(); print(dpr, json.dumps(r))
        failed |= any(x > 0.04 * t for x, t in r.values())
    b.close()
sys.exit(1 if failed else 0)
