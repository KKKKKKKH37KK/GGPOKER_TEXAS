import { signed } from './format';

/** English term with its plain-language Chinese name underneath / beside it */
export function Term({ en, zh, title }: { en: string; zh?: string; title?: string }) {
  return (
    <span className="term" title={title}>
      <span className="term-en">{en}</span>
      {zh && <span className="term-zh">{zh}</span>}
    </span>
  );
}

/**
 * bb/100 with its 95% confidence half-width. Coloured green/red only when the interval excludes zero;
 * otherwise neutral, because the sign is not distinguishable from variance.
 */
export function Bb100({ v, se }: { v: number | null; se: number | null }) {
  if (v === null) return <span>—</span>;
  const half = se === null ? null : 1.96 * se;
  const significant = half !== null && Math.abs(v) > half;
  const cls = significant ? (v > 0 ? 'pos' : 'neg') : 'insig';
  const title =
    half === null
      ? '樣本太少，無法估計誤差'
      : `95% 信賴區間：${signed(v - half)} ~ ${signed(v + half)} bb/100\n${significant ? '區間不含 0：盈虧方向可信' : '區間包含 0：目前無法和運氣區分'}`;
  return (
    <span className={`bb100 ${cls}`} title={title}>
      {signed(v)}
      {half !== null && <span className="ci">±{half.toFixed(1)}</span>}
    </span>
  );
}
