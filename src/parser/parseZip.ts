import JSZip from 'jszip';
import { checkInvariants } from '../stats/accounting';
import { parseHand, splitHands } from './parseHand';
import type { Hand, ParseResult, Warning } from './types';

export interface SourceFile {
  name: string;
  text: string;
}

export type ProgressFn = (phase: 'unzip' | 'parse', done: number, total: number) => void;

/** Reads every .txt in the zip (any folder depth), skipping other files. */
export async function readZip(file: ArrayBuffer, onProgress?: ProgressFn): Promise<SourceFile[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir && /\.txt$/i.test(f.name));
  const out: SourceFile[] = [];
  for (let i = 0; i < entries.length; i++) {
    out.push({ name: entries[i].name, text: await entries[i].async('string') });
    onProgress?.('unzip', i + 1, entries.length);
  }
  return out;
}

const byTime = (a: Hand, b: Hand) =>
  a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function parseFiles(files: SourceFile[], onProgress?: ProgressFn): ParseResult {
  const seen = new Set<string>();
  const hands: Hand[] = [];
  const otherGames: Hand[] = [];
  const skipped: Record<string, number> = {};
  const warnings: Warning[] = [];
  const unknown = new Map<string, { count: number; sampleHandId: string }>();
  let errorCount = 0;
  let duplicates = 0;

  files.forEach((f, fi) => {
    for (const block of splitHands(f.text)) {
      let hand: Hand;
      try {
        hand = parseHand(block);
      } catch (e) {
        errorCount++;
        const id = /^Poker Hand #(\S+):/.exec(block)?.[1] ?? `${f.name}?`;
        warnings.push({ kind: 'parseError', handId: id, message: (e as Error).message });
        continue;
      }
      if (seen.has(hand.id)) {
        duplicates++;
        continue;
      }
      seen.add(hand.id);
      for (const line of hand.warnings) {
        // Group by line shape so "$0.12" vs "$0.13" variants collapse together.
        const key = line.replace(/\$[\d,.]+/g, '$x').replace(/\b[0-9a-f]{6,8}\b/g, '<id>');
        const u = unknown.get(key);
        if (u) u.count++;
        else unknown.set(key, { count: 1, sampleHandId: hand.id });
      }
      if (hand.game !== 'NLHE') {
        skipped[hand.game] = (skipped[hand.game] ?? 0) + 1;
        otherGames.push(hand);
        continue;
      }
      const broken = checkInvariants(hand);
      if (broken.length) {
        errorCount++;
        for (const message of broken) warnings.push({ kind: 'invariant', handId: hand.id, message });
        continue;
      }
      hands.push(hand);
    }
    onProgress?.('parse', fi + 1, files.length);
  });

  for (const [line, u] of unknown) warnings.push({ kind: 'unknownLine', line, ...u });
  hands.sort(byTime);
  otherGames.sort(byTime);
  return { hands, otherGames, skipped, errorCount, duplicates, warnings, fileCount: files.length };
}

export async function parseZip(file: ArrayBuffer, onProgress?: ProgressFn): Promise<ParseResult> {
  return parseFiles(await readZip(file, onProgress), onProgress);
}
