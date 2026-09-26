import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allInEvNet } from '../src/equity/allinEv';
import { parseZip } from '../src/parser/parseZip';
import { aggregate } from '../src/stats/aggregate';
import { analyzeHand } from '../src/stats/facts';
import { hasZip, ZIP_PATH } from './helpers';

// PRD §8: 10k hands parse + stats < 2 s. Node is a fair stand-in for the worker.
describe.skipIf(!hasZip)('performance', () => {
  it('unzip + parse + stats of the reference zip in < 2 s', async () => {
    const buf = new Uint8Array(fs.readFileSync(ZIP_PATH)).buffer;
    const t0 = performance.now();
    const r = await parseZip(buf);
    const facts = r.hands.map(analyzeHand);
    aggregate(facts);
    const ms = performance.now() - t0;
    console.info(`parse+stats: ${ms.toFixed(0)} ms for ${r.hands.length} hands`);
    expect(ms).toBeLessThan(2000);
  });

  it('all-in EV at full precision (200k trials preflop)', async () => {
    const buf = new Uint8Array(fs.readFileSync(ZIP_PATH)).buffer;
    const { hands } = await parseZip(buf);
    const t0 = performance.now();
    let n = 0;
    for (const h of hands) if (allInEvNet(h) !== null) n++;
    const ms = performance.now() - t0;
    console.info(`all-in EV: ${ms.toFixed(0)} ms for ${n} spots`);
    expect(n).toBe(30);
  });
});
