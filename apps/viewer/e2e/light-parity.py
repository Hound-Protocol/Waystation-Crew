"""GPU light pass vs the CPU reference model. Needs `vite preview` on :4173 and Chrome. Usage: python3 e2e/light-parity.py"""
import json, sys
from playwright.sync_api import sync_playwright
JS = """(async()=>{const c=__wc.cam;c.zoomAt(640,300,40/c.scale);const out={};
for(const n of [0,8,48]){__wc.lightPass.budget.maxLights=n;await new Promise(r=>setTimeout(r,1200));const r=await __wc.lightProbe(200);out[n]=[r.bad,r.tot]}return out})()"""
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"])
    p = b.new_page(viewport={"width": 1280, "height": 720}); p.goto("http://localhost:4173/"); p.wait_for_timeout(5000)
    r = p.evaluate(JS); b.close()
print(json.dumps(r)); bad = [k for k, (x, t) in r.items() if x > 0.02 * t]
sys.exit(1 if bad else 0)
