import type { FromWorker, InputFile, ToWorker } from './protocol';

export type Listener = (msg: FromWorker) => void;

/** Thin wrapper so the UI only deals with typed messages. */
export function createStatsWorker(listener: Listener) {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<FromWorker>) => listener(e.data);
  worker.onerror = (e) => listener({ type: 'error', message: e.message || 'Worker error' });
  const send = (msg: ToWorker, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);
  return {
    restore() {
      send({ type: 'restore' });
    },
    load(files: InputFile[], persist: boolean) {
      send({ type: 'load', files, persist }, files.map((f) => f.data));
    },
    clear() {
      send({ type: 'clear' });
    },
    setPersist(persist: boolean) {
      send({ type: 'setPersist', persist });
    },
    exportHands(ids: string[] | null) {
      send({ type: 'exportHands', ids });
    },
    getReplay(id: string) {
      send({ type: 'getReplay', id });
    },
    terminate: () => worker.terminate(),
  };
}
