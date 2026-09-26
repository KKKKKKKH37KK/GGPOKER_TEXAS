import fs from 'node:fs';
import path from 'node:path';
import { parseHand } from '../src/parser/parseHand';
import { parseZip } from '../src/parser/parseZip';
import type { ParseResult } from '../src/parser/types';

export const fixture = (id: string) =>
  parseHand(fs.readFileSync(path.join(__dirname, 'fixtures', `${id}.txt`), 'utf8'));

/** The reference zip is never committed; point HH_ZIP at it, or drop it in the repo root. */
export const ZIP_PATH = process.env.HH_ZIP ?? path.join(__dirname, '..', '260926_test.zip');
export const hasZip = fs.existsSync(ZIP_PATH);

let cached: Promise<ParseResult> | null = null;
export function loadZip(): Promise<ParseResult> {
  cached ??= parseZip(new Uint8Array(fs.readFileSync(ZIP_PATH)).buffer);
  return cached;
}
