import { useState } from 'react';
import type { GridCell } from '../stats/types';
import { signed } from './format';

const RANKS = 'AKQJT98765432';
type Metric = 'vpip' | 'pfr' | 'netBB' | 'dealt';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'vpip', label: 'VPIP%' },
  { key: 'pfr', label: 'PFR%' },
  { key: 'netBB', label: '平均 bb' },
  { key: 'dealt', label: '發到次數' },
];

function label(i: number, j: number) {
  if (i === j) return RANKS[i] + RANKS[j];
  return i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o';
}

/** F10: 13×13 starting-hand grid. Suited above the diagonal, offsuit below. Respects the global filters. */
export function RangeGrid({ grid }: { grid: Record<string, GridCell> }) {
  const [metric, setMetric] = useState<Metric>('pfr');
  const maxDealt = Math.max(1, ...Object.values(grid).map((c) => c.dealt));

  const cellStyle = (c: GridCell | undefined): React.CSSProperties => {
    if (!c || c.dealt === 0) return {};
    let a = 0;
    let hue = 'var(--heat)';
    if (metric === 'vpip') a = c.vpip / c.dealt;
    else if (metric === 'pfr') a = c.pfr / c.dealt;
    else if (metric === 'dealt') a = c.dealt / maxDealt;
    else {
      const avg = c.netBB / c.dealt;
      a = Math.min(1, Math.abs(avg) / 10);
      hue = avg >= 0 ? 'var(--heat-pos)' : 'var(--heat-neg)';
    }
    return { background: `color-mix(in srgb, ${hue} ${Math.round(a * 85)}%, transparent)` };
  };

  const value = (c: GridCell | undefined) => {
    if (!c || c.dealt === 0) return '';
    if (metric === 'dealt') return String(c.dealt);
    if (metric === 'netBB') return signed(c.netBB / c.dealt, 1);
    return `${Math.round(((metric === 'vpip' ? c.vpip : c.pfr) / c.dealt) * 100)}`;
  };

  return (
    <section className="card">
      <h2>
        起手牌格
        <span className="seg">
          {METRICS.map((m) => (
            <button key={m.key} className={metric === m.key ? 'on' : ''} onClick={() => setMetric(m.key)}>
              {m.label}
            </button>
          ))}
        </span>
      </h2>
      <div className="range-grid">
        {RANKS.split('').map((_, i) =>
          RANKS.split('').map((_, j) => {
            const l = label(i, j);
            const c = grid[l];
            const tip = c
              ? `${l}\n發到 ${c.dealt} 次\nVPIP ${((c.vpip / c.dealt) * 100).toFixed(0)}% (${c.vpip}/${c.dealt})\nPFR ${((c.pfr / c.dealt) * 100).toFixed(0)}% (${c.pfr}/${c.dealt})\n平均 ${signed(c.netBB / c.dealt, 2)} bb · 合計 ${signed(c.netBB, 1)} bb`
              : `${l}\n未發到`;
            return (
              <div key={l} className={`rg-cell${i === j ? ' pair' : ''}${c ? '' : ' empty'}`} style={cellStyle(c)} title={tip}>
                <span className="rg-label">{l}</span>
                <span className="rg-val">{value(c)}</span>
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
