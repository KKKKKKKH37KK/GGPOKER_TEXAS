import type { Ratio } from '../stats/types';
import { MIN_SAMPLE, pctText, pctValue, wilson } from './format';
import { outOfRange, type Benchmark } from './settings';

interface Props {
  r: Ratio;
  /** Definition text shown on hover */
  def?: string;
  bench?: Benchmark;
  compact?: boolean;
}

export function ratioTooltip(r: Ratio, def?: string): string {
  const ci = wilson(r);
  const lines = [def, `樣本 ${r.num} / ${r.den}`];
  if (ci) lines.push(`95% Wilson 區間：${ci[0].toFixed(1)}% – ${ci[1].toFixed(1)}%`);
  if (r.den > 0 && r.den < MIN_SAMPLE) lines.push(`樣本 < ${MIN_SAMPLE}，僅供參考`);
  return lines.filter(Boolean).join('\n');
}

export function RatioCell({ r, def, bench, compact }: Props) {
  const flag = outOfRange(pctValue(r), bench);
  const cls = ['ratio', r.den < MIN_SAMPLE ? 'low-n' : '', flag ? `bench-${flag}` : ''].filter(Boolean).join(' ');
  return (
    <span className={cls} title={ratioTooltip(r, def)}>
      <span className="pct">{pctText(r)}</span>
      {!compact && r.den > 0 && (
        <span className="xn">
          {r.num}/{r.den}
        </span>
      )}
    </span>
  );
}
