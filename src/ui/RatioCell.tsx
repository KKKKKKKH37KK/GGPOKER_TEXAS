import type { Ratio } from '../stats/types';
import { MIN_SAMPLE, pctText, wilson } from './format';
import { benchFlag, benchText, type Benchmark } from './settings';

interface Props {
  r: Ratio;
  /** Definition text shown on hover */
  def?: string;
  bench?: Benchmark;
  compact?: boolean;
}

const FLAG_TEXT = {
  low: '低於參考範圍（95% 區間整個在範圍外，偏離可信）',
  high: '高於參考範圍（95% 區間整個在範圍外，偏離可信）',
  'low-weak': '點估計低於參考範圍，但 95% 區間仍與範圍重疊（可能只是雜訊）',
  'high-weak': '點估計高於參考範圍，但 95% 區間仍與範圍重疊（可能只是雜訊）',
};

export function ratioTooltip(r: Ratio, def?: string, bench?: Benchmark): string {
  const ci = wilson(r);
  const flag = benchFlag(r, bench);
  const lines = [def, `樣本 ${r.num} / ${r.den}`];
  if (ci) lines.push(`95% Wilson 區間：${ci[0].toFixed(1)}% – ${ci[1].toFixed(1)}%`);
  if (bench && benchText(bench)) lines.push(`參考範圍（近似）：${benchText(bench)}`);
  if (flag) lines.push(FLAG_TEXT[flag]);
  if (r.den > 0 && r.den < MIN_SAMPLE) lines.push(`樣本 < ${MIN_SAMPLE}，僅供參考`);
  return lines.filter(Boolean).join('\n');
}

export function RatioCell({ r, def, bench, compact }: Props) {
  const flag = benchFlag(r, bench);
  const cls = ['ratio', r.den < MIN_SAMPLE ? 'low-n' : '', flag ? `bench-${flag}` : ''].filter(Boolean).join(' ');
  return (
    <span className={cls} title={ratioTooltip(r, def, bench)}>
      <span className="pct">{pctText(r)}</span>
      {r.den > 0 &&
        (compact ? (
          <span className="xn">n={r.den}</span>
        ) : (
          <span className="xn">
            {r.num}/{r.den}
          </span>
        ))}
    </span>
  );
}
