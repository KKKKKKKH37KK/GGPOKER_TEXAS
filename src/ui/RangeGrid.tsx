import { useState } from 'react';
import type { GridCell } from '../stats/types';
import { signed } from './format';

const RANKS = 'AKQJT98765432';
type Metric = 'rfi' | 'vpip' | 'pfr' | 'netBB' | 'dealt';
const METRICS: { key: Metric; label: string; title: string }[] = [
  { key: 'rfi', label: 'RFI% 開池', title: '只看前面全部棄牌（未開池）時的 raise 頻率，可直接對照 GTO open range' },
  { key: 'vpip', label: 'VPIP% 入池', title: '主動入池率（含跟注、3Bet）' },
  { key: 'pfr', label: 'PFR% 加注', title: '翻前加注率（含 open、3Bet、4Bet）' },
  { key: 'netBB', label: '平均 bb', title: '每手平均盈虧（大盲）' },
  { key: 'dealt', label: '次數', title: '發到次數（不含 walk）' },
];

function label(i: number, j: number) {
  if (i === j) return RANKS[i] + RANKS[j];
  return i < j ? RANKS[i] + RANKS[j] + 's' : RANKS[j] + RANKS[i] + 'o';
}

/** F10: 13×13 starting-hand grid. Suited above the diagonal, offsuit below. Respects the global filters. */
export function RangeGrid({ grid, onCell }: { grid: Record<string, GridCell>; onCell: (combo: string) => void }) {
  const [metric, setMetric] = useState<Metric>('rfi');
  const maxDealt = Math.max(1, ...Object.values(grid).map((c) => c.dealt));

  const frac = (c: GridCell): number | null => {
    if (metric === 'rfi') return c.rfiOpp ? c.rfi / c.rfiOpp : null;
    if (metric === 'vpip') return c.vpip / c.dealt;
    if (metric === 'pfr') return c.pfr / c.dealt;
    return null;
  };

  const cellStyle = (c: GridCell | undefined): React.CSSProperties => {
    if (!c || c.dealt === 0) return {};
    let a = 0;
    let hue = 'var(--heat)';
    if (metric === 'dealt') a = c.dealt / maxDealt;
    else if (metric === 'netBB') {
      const avg = c.netBB / c.dealt;
      a = Math.min(1, Math.abs(avg) / 10);
      hue = avg >= 0 ? 'var(--heat-pos)' : 'var(--heat-neg)';
    } else a = frac(c) ?? 0;
    return { background: `color-mix(in srgb, ${hue} ${Math.round(a * 85)}%, transparent)` };
  };

  const value = (c: GridCell | undefined) => {
    if (!c || c.dealt === 0) return '';
    if (metric === 'dealt') return String(c.dealt);
    if (metric === 'netBB') return signed(c.netBB / c.dealt, 1);
    const f = frac(c);
    return f === null ? '—' : `${Math.round(f * 100)}`;
  };

  return (
    <section className="card">
      <h2>
        起手牌格 <span className="h-note">右上 = 同花（s），左下 = 不同花（o），對角線 = 對子</span>
        <span className="seg">
          {METRICS.map((m) => (
            <button key={m.key} className={metric === m.key ? 'on' : ''} onClick={() => setMetric(m.key)} title={m.title}>
              {m.label}
            </button>
          ))}
        </span>
      </h2>
      {metric === 'rfi' && <p className="muted small">RFI 不含 BB（BB 不會有未開池的開池機會）；用上方位置篩選可看單一位置的 open range。</p>}
      <div className="range-grid">
        {RANKS.split('').map((_, i) =>
          RANKS.split('').map((_, j) => {
            const l = label(i, j);
            const c = grid[l];
            const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}% (${n}/${d})` : '—');
            const tip = c
              ? `${l}\n發到 ${c.dealt} 次\nRFI 開池 ${pct(c.rfi, c.rfiOpp)}\nVPIP 入池 ${pct(c.vpip, c.dealt)}\nPFR 加注 ${pct(c.pfr, c.dealt)}\n平均 ${signed(c.netBB / c.dealt, 2)} bb · 合計 ${signed(c.netBB, 1)} bb`
              : `${l}\n未發到`;
            return (
              <div
                key={l}
                className={`rg-cell${i === j ? ' pair' : ''}${c ? ' clickable' : ' empty'}`}
                style={cellStyle(c)}
                title={c ? `${tip}\n（點擊查看這些手牌）` : tip}
                onClick={c ? () => onCell(l) : undefined}
              >
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
