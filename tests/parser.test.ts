import { describe, expect, it } from 'vitest';
import { parseFiles } from '../src/parser/parseZip';
import { toCents } from '../src/parser/money';
import { checkInvariants, computeInvested, heroNet, playerNet } from '../src/stats/accounting';
import { fixture } from './helpers';
import fs from 'node:fs';
import path from 'node:path';

describe('toCents', () => {
  it('converts without floating point', () => {
    expect(toCents('$0.05')).toBe(5);
    expect(toCents('$0.1')).toBe(10);
    expect(toCents('$10')).toBe(1000);
    expect(toCents('$1,234.5')).toBe(123450);
    expect(toCents('19.32')).toBe(1932);
  });
});

describe('fixtures (PRD §7.4)', () => {
  it('RC4772226199 — plain showdown', () => {
    const h = fixture('RC4772226199');
    expect(h.game).toBe('NLHE');
    expect(h.sb).toBe(5);
    expect(h.bb).toBe(10);
    expect(h.timestamp).toBe('2026-09-01T22:25:31');
    expect(h.buttonSeat).toBe(1);
    expect(h.heroCards).toEqual(['Qc', 'Ad']);
    expect(h.players.find((p) => p.name === 'Hero')).toMatchObject({ seat: 4, stack: 1039, position: 'UTG' });
    expect(h.players.map((p) => p.position)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']);
    expect(h.actions[2]).toMatchObject({ player: 'Hero', street: 'PRE', type: 'raise', amount: 12, raiseTo: 22 });
    expect(h.boards).toEqual([['4s', 'Kh', '6h', '6c', 'Qs']]);
    expect(h.showedDown.sort()).toEqual(['Hero', 'd1295ea7']);
    expect(h.shownCards.d1295ea7).toEqual(['As', 'Js']);
    expect(h.warnings).toEqual([]);
    expect(checkInvariants(h)).toEqual([]);
    expect(computeInvested(h).Hero).toBe(39);
    expect(heroNet(h)).toBe(40); // +$0.79 − $0.39
  });

  it('RC4772175885 — Cash Drop is nobody’s investment', () => {
    const h = fixture('RC4772175885');
    expect(h.cashDrop).toBe(100);
    const inv = computeInvested(h);
    expect(Object.values(inv).reduce((a, b) => a + b, 0)).toBe(h.summary.totalPot - 100);
    expect(checkInvariants(h)).toEqual([]);
    expect(inv.Hero).toBe(200);
    expect(heroNet(h)).toBe(-200);
    expect(h.warnings).toEqual([]);
  });

  it('RC4772496598 — EV Cashout risk is deducted from the winner', () => {
    const h = fixture('RC4772496598');
    expect(h.cashouts['8a40bad2']).toEqual({ riskPaid: 78, received: 0 });
    expect(checkInvariants(h)).toEqual([]);
    expect(playerNet(h, '8a40bad2')).toBe(2457 - 1235 - 78);
    expect(heroNet(h)).toBe(0);
    expect(h.warnings).toEqual([]);
  });

  it('RC4772496852 — run it twice', () => {
    const h = fixture('RC4772496852');
    expect(h.runItTwice).toBe(true);
    expect(h.boards).toEqual([
      ['Jd', '9s', '4s', '8d', '3d'],
      ['Jd', '9s', '4s', '8d', '7h'],
    ]);
    expect(h.collected).toEqual({ '183da77a': 954, cacc27d1: 954 });
    const streets = h.actions.filter((a) => a.player === '183da77a').map((a) => `${a.street}:${a.type}`);
    expect(streets).toEqual(['PRE:raise', 'PRE:raise', 'FLOP:bet', 'TURN:bet']);
    expect(h.showedDown.sort()).toEqual(['183da77a', 'cacc27d1']);
    expect(checkInvariants(h)).toEqual([]);
    expect(h.warnings).toEqual([]);
  });

  it('RC917476129 — Omaha is skipped and counted', () => {
    const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'RC917476129.txt'), 'utf8');
    const r = parseFiles([{ name: 'x.txt', text }]);
    expect(r.hands).toHaveLength(0);
    expect(r.skipped).toEqual({ PLO: 1 });
    expect(r.otherGames[0].id).toBe('RC917476129');
    expect(heroNet(r.otherGames[0])).toBe(5);
  });

  it('RC4772225996 — walk', () => {
    const h = fixture('RC4772225996');
    expect(h.players.find((p) => p.name === 'Hero')?.position).toBe('BB');
    expect(h.actions.filter((a) => a.player === 'Hero').map((a) => a.type)).toEqual(['postBB']);
    expect(heroNet(h)).toBe(5);
  });
});

describe('parseFiles robustness', () => {
  const base = fs.readFileSync(path.join(__dirname, 'fixtures', 'RC4772226199.txt'), 'utf8');

  it('tolerates CRLF and BOM, dedups by id, sorts by time', () => {
    const walk = fs.readFileSync(path.join(__dirname, 'fixtures', 'RC4772225996.txt'), 'utf8');
    const crlf = '﻿' + (base + '\n\n' + walk).replace(/\n/g, '\r\n');
    const r = parseFiles([
      { name: 'a.txt', text: crlf },
      { name: 'b.txt', text: base },
    ]);
    expect(r.hands.map((h) => h.id)).toEqual(['RC4772225996', 'RC4772226199']);
    expect(r.duplicates).toBe(1);
    expect(r.errorCount).toBe(0);
  });

  it('records unknown lines as warnings instead of crashing', () => {
    const text = base.replace('*** FLOP ***', 'Hero: does a little dance\n*** FLOP ***');
    const r = parseFiles([{ name: 'a.txt', text }]);
    expect(r.hands).toHaveLength(1);
    expect(r.warnings).toContainEqual(expect.objectContaining({ kind: 'unknownLine', count: 1 }));
  });

  it('skips a hand whose invariant fails and reports it', () => {
    const text = base.replace('Hero collected $0.79', 'Hero collected $0.80');
    const r = parseFiles([{ name: 'a.txt', text }]);
    expect(r.hands).toHaveLength(0);
    expect(r.errorCount).toBe(1);
    expect(r.warnings[0]).toMatchObject({ kind: 'invariant', handId: 'RC4772226199' });
  });

  it('skips a structurally broken hand only', () => {
    const r = parseFiles([{ name: 'a.txt', text: 'Poker Hand #RC1: garbage\n\n' + base }]);
    expect(r.hands).toHaveLength(1);
    expect(r.errorCount).toBe(1);
  });
});
