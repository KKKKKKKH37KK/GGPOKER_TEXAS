import type { Warning } from '../parser/types';
import type { Replay } from '../stats/replay';
import type { HandFacts } from '../stats/types';

export interface InputFile {
  name: string;
  data: ArrayBuffer;
}

export type ToWorker =
  | { type: 'restore' }
  | { type: 'load'; files: InputFile[]; persist: boolean }
  | { type: 'clear' }
  | { type: 'setPersist'; persist: boolean }
  | { type: 'exportHands'; ids: string[] | null }
  | { type: 'getReplay'; id: string };

export interface LoadSummary {
  /** .txt hand-history files parsed (after unzipping) */
  fileCount: number;
  /** Uploaded source files (zip / txt) in the current data set */
  sourceFiles: { name: string; addedAt: string; bytes: number }[];
  /** How many of them were added by the latest upload */
  newFiles: number;
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
  | { type: 'replay'; id: string; replay: Replay | null }
  | { type: 'empty' }
  | { type: 'cleared' }
  | { type: 'error'; message: string };
