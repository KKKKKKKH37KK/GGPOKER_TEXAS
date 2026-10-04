/// <reference lib="webworker" />
import { allInEv } from '../equity/allinEv';
import { parseFiles, readZip, type SourceFile } from '../parser/parseZip';
import type { Hand } from '../parser/types';
import { heroNet } from '../stats/accounting';
import { analyzeHand } from '../stats/facts';
import { buildReplay } from '../stats/replay';
import type { FromWorker, InputFile, ToWorker } from './protocol';
import { clearFiles, fileKey, getAllFiles, putFiles, type StoredFile } from './store';

declare const self: DedicatedWorkerGlobalScope;

let hands: Hand[] = [];
/** Every source file currently loaded (also persisted to IndexedDB when enabled) */
let files: StoredFile[] = [];
let loadToken = 0;

const post = (msg: FromWorker) => self.postMessage(msg);

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    if (msg.type === 'restore') await restore();
    else if (msg.type === 'load') await add(msg.files, msg.persist);
    else if (msg.type === 'clear') {
      loadToken++;
      files = [];
      hands = [];
      await clearFiles();
      post({ type: 'cleared' });
    } else if (msg.type === 'setPersist') {
      if (msg.persist) await putFiles(files);
      else await clearFiles();
    } else if (msg.type === 'getReplay') {
      const hand = hands.find((h) => h.id === msg.id);
      post({ type: 'replay', id: msg.id, replay: hand ? buildReplay(hand) : null });
    } else if (msg.type === 'exportHands') {
      const set = msg.ids ? new Set(msg.ids) : null;
      post({ type: 'exported', json: JSON.stringify(set ? hands.filter((h) => set.has(h.id)) : hands, null, 1) });
    }
  } catch (err) {
    post({ type: 'error', message: (err as Error).message ?? String(err) });
  }
};

async function restore() {
  const stored = await getAllFiles();
  if (stored.length === 0) {
    post({ type: 'empty' });
    return;
  }
  files = stored.sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1));
  await analyze(0);
}

/** Merges new uploads into the current set (same name + size = same export, skipped) and re-analyses everything. */
async function add(incoming: InputFile[], persist: boolean) {
  const known = new Set(files.map((f) => f.key));
  const now = new Date().toISOString();
  const fresh: StoredFile[] = [];
  for (const f of incoming) {
    const key = fileKey(f.name, f.data);
    if (known.has(key)) continue;
    known.add(key);
    fresh.push({ key, name: f.name, data: f.data, addedAt: now });
  }
  files = [...files, ...fresh];
  if (persist && fresh.length) await putFiles(fresh);
  await analyze(fresh.length);
}

async function analyze(newFiles: number) {
  const token = ++loadToken;
  const t0 = performance.now();
  const sources: SourceFile[] = [];
  const decoder = new TextDecoder('utf-8');
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (/\.zip$/i.test(f.name)) {
      sources.push(...(await readZip(f.data, (_p, d, t) => post({ type: 'progress', phase: 'unzip', done: d, total: t }))));
    } else if (/\.txt$/i.test(f.name)) {
      sources.push({ name: f.name, text: decoder.decode(f.data) });
    }
    post({ type: 'progress', phase: 'read', done: i + 1, total: files.length });
  }
  if (sources.length === 0) throw new Error('沒有找到任何 .txt 手牌檔（請拖入 GG 匯出的 .zip 或 .txt）');

  const result = parseFiles(sources, (_p, d, t) => post({ type: 'progress', phase: 'parse', done: d, total: t }));
  hands = result.hands;

  const facts = hands.map((h, i) => {
    if (i % 2000 === 0) post({ type: 'progress', phase: 'stats', done: i, total: hands.length });
    return analyzeHand(h);
  });
  post({
    type: 'loaded',
    facts,
    summary: {
      fileCount: result.fileCount,
      sourceFiles: files.map((f) => ({ name: f.name, addedAt: f.addedAt, bytes: f.data.byteLength })),
      newFiles,
      skipped: result.skipped,
      errorCount: result.errorCount,
      duplicates: result.duplicates,
      warnings: result.warnings,
      otherGamesNetCents: result.otherGames.reduce((a, h) => a + heroNet(h), 0),
      elapsedMs: performance.now() - t0,
    },
  });

  // All-in EV (P1) is slower; stream it after the report is on screen.
  const t1 = performance.now();
  const ev: Record<string, number> = {};
  const evPreRake: Record<string, number> = {};
  const evSd: Record<string, number> = {};
  for (let i = 0; i < hands.length; i++) {
    const v = allInEv(hands[i]);
    if (v !== null) {
      ev[hands[i].id] = v.net;
      evPreRake[hands[i].id] = v.preRakeNet;
      evSd[hands[i].id] = v.sd;
    }
    if (i % 2000 === 0) {
      post({ type: 'progress', phase: 'ev', done: i, total: hands.length });
      await new Promise((r) => setTimeout(r)); // let a newer load or export request in
      if (token !== loadToken) return;
    }
  }
  post({ type: 'ev', ev, evPreRake, evSd, elapsedMs: performance.now() - t1 });
}