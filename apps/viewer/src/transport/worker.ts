import type { ClientMsg, ServerMsg, SimTransport } from "@wc/protocol";

export interface WorkerLike {
  postMessage(m: unknown): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  terminate(): void;
}

export function createWorkerTransport(worker?: WorkerLike): SimTransport {
  const w: WorkerLike = worker ?? (new Worker(new URL("../sim.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike);
  const listeners: Array<(m: ServerMsg) => void> = [];
  w.onmessage = (e) => { for (const l of listeners) l(e.data as ServerMsg); };
  return {
    send: (m: ClientMsg) => w.postMessage(m),
    onMessage: (cb) => { listeners.push(cb); },
    close: () => w.terminate(),
  };
}
