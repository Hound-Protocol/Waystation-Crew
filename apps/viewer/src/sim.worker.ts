import { SimHost } from "./simhost";
import type { ClientMsg } from "@wc/protocol";

const host = new SimHost({ seed: 1, population: 60 });
const post = (m: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);
self.onmessage = (e: MessageEvent<ClientMsg>) => { for (const out of host.handle(e.data)) post(out); };
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const d = host.advanceReal((now - last) / 1000);
  last = now;
  if (d) post(d);
  const i = host.inspectMsg(); if (i) post(i);
}, 100);
