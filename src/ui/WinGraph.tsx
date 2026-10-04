import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GraphPoint } from '../stats/types';
import { int, signed } from './format';

const SERIES = [
  { key: 'total', name: '總盈虧', color: 'var(--c-total)' },
  { key: 'showdown', name: 'Showdown 攤牌', color: 'var(--c-sd)' },
  { key: 'nonShowdown', name: 'Non-showdown 非攤牌', color: 'var(--c-nsd)' },
  { key: 'ev', name: 'All-in EV 期望值', color: 'var(--c-ev)' },
] as const;

/** F6 + F11: cumulative winnings in bb */
export function WinGraph({ data, evReady }: { data: GraphPoint[]; evReady: boolean }) {
  const series = evReady ? SERIES : SERIES.filter((s) => s.key !== 'ev');
  return (
    <section className="card">
      <h2>累積盈虧（bb）</h2>
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
