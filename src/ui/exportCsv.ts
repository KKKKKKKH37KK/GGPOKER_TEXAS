import { POSITIONS, STACK_GROUPS } from '../stats/aggregate';
import { STAT_DEFS, STAT_KEYS } from '../stats/definitions';
import type { GroupRow, StackBounds, StatsResult } from '../stats/types';
import { stackLabel } from './Filters';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pct = (num: number, den: number) => (den ? ((num / den) * 100).toFixed(2) : '');

/** F13: the stats table (overall + per position + per stack group) as CSV. */
export function statsToCsv(r: StatsResult, bounds: StackBounds): string {
  const rows: (string | number)[][] = [['scope', 'group', 'stat', 'num', 'den', 'pct']];
  const add = (scope: string, group: string, stats: GroupRow['stats']) => {
    for (const k of STAT_KEYS) {
      const s = stats[k];
      rows.push([scope, group, STAT_DEFS[k].label, s.num, s.den, pct(s.num, s.den)]);
    }
  };
  add('overall', 'all', r.stats);
  rows.push(['overall', 'all', 'AF', r.af.num, r.af.den, r.af.den ? (r.af.num / r.af.den).toFixed(3) : '']);
  rows.push(['overall', 'all', 'hands', r.hands, '', '']);
  rows.push(['overall', 'all', 'walks', r.walks, '', '']);
  rows.push(['overall', 'all', 'net_cents', r.netCents, '', '']);
  rows.push(['overall', 'all', 'net_bb', r.netBB.toFixed(2), '', '']);
  rows.push(['overall', 'all', 'bb_per_100', r.bb100?.toFixed(2) ?? '', '', '']);
  const group = (scope: string, key: string, g: GroupRow) => {
    rows.push([scope, key, 'hands', g.hands, '', '']);
    rows.push([scope, key, 'net_bb', g.netBB.toFixed(2), '', '']);
    rows.push([scope, key, 'bb_per_100', g.bb100?.toFixed(2) ?? '', '', '']);
    add(scope, key, g.stats);
  };
  for (const p of POSITIONS) group('position', p, r.byPosition[p]);
  for (const s of STACK_GROUPS) group('stack', stackLabel(s, bounds), r.byStack[s]);
  return '﻿' + rows.map((row) => row.map(esc).join(',')).join('\r\n');
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
