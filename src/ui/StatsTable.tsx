import { AF_DEF, POST_TABLE, PRE_TABLE, RESULT_DEFS, STAT_DEFS, STAT_KEYS, type StatKey } from '../stats/definitions';
import type { SplitKey, StatsResult } from '../stats/types';
import { dollars, signed, tone } from './format';
import { RatioCell } from './RatioCell';
import { outOfRange, type Benchmark, type Settings } from './settings';

export const defText = (k: StatKey) => `${STAT_DEFS[k].label}\n分母：${STAT_DEFS[k].den}\n分子：${STAT_DEFS[k].num}`;

const SPLITS: SplitKey[] = ['IP', 'OOP', 'SRP', '3BP', '4BP+', 'HU', 'MW'];

function benchText(b: Benchmark | undefined) {
  if (!b || (b.min === undefined && b.max === undefined)) return '';
  return `${b.min ?? ''}–${b.max ?? ''}`;
}

function Rows({ keys, r, settings }: { keys: StatKey[]; r: StatsResult; settings: Settings }) {
  return (
    <>
      {keys.map((k) => (
        <tr key={k} className={k.endsWith('SB') || k.endsWith('BB') ? 'sub-row' : ''}>
          <th scope="row" title={defText(k)}>
            {STAT_DEFS[k].label}
          </th>
          <td>
            <RatioCell r={r.stats[k]} def={defText(k)} bench={settings.benchmarks[k]} />
          </td>
          <td className="bench">{benchText(settings.benchmarks[k])}</td>
        </tr>
      ))}
    </>
  );
}

export function StatsTable({ r, settings, evReady }: { r: StatsResult; settings: Settings; evReady: boolean }) {
  const af = r.af.den ? r.af.num / r.af.den : null;
  const afFlag = outOfRange(af, settings.benchmarks.af);
  const sd = r.graph[r.graph.length - 1];
  return (
    <section className="stats-grid">
      <div className="card">
        <h2>Preflop</h2>
        <table className="stats">
          <tbody>
            <Rows keys={PRE_TABLE} r={r} settings={settings} />
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Postflop</h2>
        <table className="stats">
          <tbody>
            <tr>
              <th scope="row" title={`AF\n${AF_DEF.num} / ${AF_DEF.den}`}>AF</th>
              <td>
                <span
                  className={`ratio${r.af.den < 30 ? ' low-n' : ''}${afFlag ? ` bench-${afFlag}` : ''}`}
                  title={`${AF_DEF.num} / ${AF_DEF.den}\n${r.af.num} / ${r.af.den}`}
                >
                  <span className="pct">{af === null ? '—' : af.toFixed(2)}</span>
                  <span className="xn">
                    {r.af.num}/{r.af.den}
                  </span>
                </span>
              </td>
              <td className="bench">{benchText(settings.benchmarks.af)}</td>
            </tr>
            <Rows keys={POST_TABLE} r={r} settings={settings} />
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Results</h2>
        <table className="stats">
          <tbody>
            <tr title={RESULT_DEFS.netWon}>
              <th scope="row">Net won</th>
              <td className={tone(r.netCents)}>
                {dollars(r.netCents)} <span className="muted">/ {signed(r.netBB, 1)} bb</span>
              </td>
            </tr>
            <tr title={RESULT_DEFS.bb100}>
              <th scope="row">bb/100</th>
              <td className={tone(r.bb100)}>{r.bb100 === null ? '—' : signed(r.bb100)}</td>
            </tr>
            <tr title={RESULT_DEFS.showdown}>
              <th scope="row">
                <i className="dot sd" /> Showdown
              </th>
              <td className={tone(sd?.showdown ?? 0)}>{signed(sd?.showdown ?? 0, 1)} bb</td>
            </tr>
            <tr title={RESULT_DEFS.nonShowdown}>
              <th scope="row">
                <i className="dot nsd" /> Non-showdown
              </th>
              <td className={tone(sd?.nonShowdown ?? 0)}>{signed(sd?.nonShowdown ?? 0, 1)} bb</td>
            </tr>
            <tr title={RESULT_DEFS.allInEv}>
              <th scope="row">
                <i className="dot ev" /> All-in EV
              </th>
              <td className={evReady ? tone(r.evNetBB) : ''}>
                {evReady ? (
                  <>
                    {signed(r.evNetBB, 1)} bb{' '}
                    <span className="muted">
                      ({r.hands ? signed((r.evNetBB / r.hands) * 100) : '—'} bb/100 · {r.evHands} 手 all-in)
                    </span>
                  </>
                ) : (
                  <span className="muted">計算中…</span>
                )}
              </td>
            </tr>
            <tr title="All-in EV 與實際結果的差（正 = 運氣好）">
              <th scope="row">Luck</th>
              <td className={evReady ? tone(r.netBB - r.evNetBB) : ''}>
                {evReady ? `${signed(r.netBB - r.evNetBB, 1)} bb` : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt">CBet 切分</h2>
        <div className="scroll-x">
          <table className="stats splits">
            <thead>
              <tr>
                <th />
                {SPLITS.map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAT_KEYS.filter((k) => STAT_DEFS[k].splittable).map((k) => (
                <tr key={k}>
                  <th scope="row" title={defText(k)}>
                    {STAT_DEFS[k].label}
                  </th>
                  {SPLITS.map((s) => {
                    const cell = r.splits[k]?.[s] ?? { num: 0, den: 0 };
                    return (
                      <td key={s}>
                        <RatioCell r={cell} def={`${defText(k)}\n切分：${s}`} compact />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
