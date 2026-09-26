import type { Warning } from '../parser/types';
import type { HandFacts } from '../stats/types';

export interface InputFile {
  name: string;
  data: ArrayBuffer;
}

export type ToWorker =
  | { type: 'load'; files: InputFile[] }
  | { type: 'exportHands'; ids: string[] | null };

export interface LoadSummary {
  fileCount: number;
  skipped: Record<string, number>;
  errorCount: number;
  duplicates: number;
  warnings: Warning[];
  /** Hero net (cents) of the skipped non-Hold'em hands, for the "whole zip" total */
  otherGamesNetCents: number;
  elapsedMs: number;
}

export type FromWorker =
  | { type: 'progress'; phase: 'read' | 'unzip' | 'parse' | 'stats' | 'ev'; done: number; total: number }
  | { type: 'loaded'; facts: HandFacts[]; summary: LoadSummary }
  | { type: 'ev'; ev: Record<string, number>; elapsedMs: number }
  | { type: 'exported'; json: string }
  | { type: 'error'; message: string };
