import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GraphPoint } from '../stats/types';
import { int, signed } from './format';

const SERIES = [
  { key: 'total', name: '總盈虧', color: 'var(--c-total)' },
  { key: 'showdown', name: 'Showdown 攤牌', color: 'var(--c-sd)' },
  { key: 'nonShowdown', name: 'Non-showdown 非攤牌', color: 'var(--c-nsd)' },
  { key: 'ev', name: 'All-in EV 期望值', color: 'var(--c-ev)' },
  { key: 'preRake', name: '扣抽水前（實際）', color: 'var(--c-total)', dashed: true },
  { key: 'evPreRake', name: '扣抽水前 All-in EV', color: 'var(--c-ev)', dashed: true },
] as const;

/** F6 + F11: cumulative winnings in bb */
const PREF_KEY = 'hh-stats-viewer.showPreRake';

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function WinGraph({ data, evReady }: { data: GraphPoint[]; evReady: boolean }) {
  // Pre-rake lines are opt-in; the choice is remembered in this browser only.
  const [showPreRake, setShowPreRake] = useState(readPref);
  const toggle = (on: boolean) => {
    setShowPreRake(on);
    try {
      localStorage.setItem(PREF_KEY, on ? '1' : '0');
    } catch {
      // storage unavailable: the choice lasts for this session
    }
  };
  const series = SERIES.filter(
    (s) => (evReady || (s.key !== 'ev' && s.key !== 'evPreRake')) && (showPreRake || !('dashed' in s)),
  );
  return (
    <section className="card">
      <h2>
        累積盈虧（bb）
        <span className="h-note">
          已扣抽水（= 帳戶實際增減）{showPreRake && '；虛線是扣抽水前，可和 GG PokerCraft 官方圖對照'}
        </span>
        <label className="check graph-toggle">
          <input type="checkbox" checked={showPreRake} onChange={(e) => toggle(e.target.checked)} />
          顯示扣抽水前（實際、All-in EV）
        </label>
      </h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="hand"
              type="number"
              domain={[0, 'dataMax']}
              tickFormatter={int}
              stroke="var(--muted)"
              tick={{ fontSize: 12 }}
            />
            <YAxis stroke="var(--muted)" tick={{ fontSize: 12 }} width={56} tickFormatter={(v: number) => v.toFixed(0)} />
            <ReferenceLine y={0} stroke="var(--muted)" />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              labelFormatter={(v) => `第 ${int(Number(v))} 手`}
              formatter={(v) => `${signed(Number(v), 1)} bb`}
            />
            <Legend />
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.key === 'total' ? 2 : 1.5}
                strokeDasharray={'dashed' in s && s.dashed ? '6 3' : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
