import {
  AF_DEF, GLOSSARY, POST_TABLE, PRE_TABLE, RESULT_DEFS, STAT_DEFS, STAT_KEYS, SUB_ROWS, type StatKey,
} from '../stats/definitions';
import type { SplitKey, StatsResult } from '../stats/types';
import { dollars, signed, tone } from './format';
import { RatioCell } from './RatioCell';
import { benchFor, benchText, valueFlag, type Settings } from './settings';
import { Bb100, Term } from './Term';

export const defText = (k: StatKey) =>
  `${STAT_DEFS[k].label}（${STAT_DEFS[k].zh}）\n分母：${STAT_DEFS[k].den}\n分子：${STAT_DEFS[k].num}`;

const SPLITS: SplitKey[] = ['IP', 'OOP', 'SRP', '3BP', '4BP+', 'HU', 'MW'];

function Rows({ keys, r, settings }: { keys: StatKey[]; r: StatsResult; settings: Settings }) {
  return (
    <>
      {keys.map((k) => {
        const bench = benchFor(settings, k);
        return (
          <tr key={k} className={SUB_ROWS.has(k) ? 'sub-row' : ''}>
            <th scope="row" title={defText(k)}>
              <Term en={STAT_DEFS[k].label} zh={STAT_DEFS[k].zh} />
            </th>
            <td>
              <RatioCell r={r.stats[k]} def={defText(k)} bench={bench} />
            </td>
            <td className="bench" title="參考範圍（近似值，可在設定中修改）">
              {benchText(bench)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function ResultRow({ label, title, children, dot }: { label: string; title: string; children: React.ReactNode; dot?: string }) {
  return (
    <tr title={title}>
      <th scope="row">
        {dot && <i className={`dot ${dot}`} />}
        <Term en={label} zh={GLOSSARY[label]} />
      </th>
      <td>{children}</td>
    </tr>
  );
}

export function StatsTable({ r, settings, evReady }: { r: StatsResult; settings: Settings; evReady: boolean }) {
  const af = r.af.den ? r.af.num / r.af.den : null;
  const afBench = benchFor(settings, 'af');
  const afFlag = valueFlag(af, afBench);
  const last = r.graph[r.graph.length - 1];
  return (
    <>
    <section className="stats-grid">
      <div className="card">
        <h2>
          Preflop <span className="h-note">翻前</span>
        </h2>
        <table className="stats">
          <thead>
            <tr>
              <th />
              <th>數值 · 樣本</th>
              <th>參考範圍</th>
            </tr>
          </thead>
          <tbody>
            <Rows keys={PRE_TABLE} r={r} settings={settings} />
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>
          Postflop <span className="h-note">翻後</span>
        </h2>
        <table className="stats">
          <thead>
            <tr>
              <th />
              <th>數值 · 樣本</th>
              <th>參考範圍</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" title={`AF（${AF_DEF.zh}）\n${AF_DEF.num} / ${AF_DEF.den}`}>
                <Term en="AF" zh={AF_DEF.zh} />
              </th>
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
              <td className="bench">{benchText(afBench, '')}</td>
            </tr>
            <Rows keys={POST_TABLE} r={r} settings={settings} />
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>
          Results <span className="h-note">盈虧</span>
        </h2>
        <table className="stats">
          <tbody>
            <ResultRow label="Net won" title={RESULT_DEFS.netWon}>
              <span className={tone(r.netCents)}>{dollars(r.netCents)}</span>{' '}
              <span className="muted">/ {signed(r.netBB, 1)} bb</span>
            </ResultRow>
            <ResultRow label="bb/100" title={RESULT_DEFS.bb100}>
              <Bb100 v={r.bb100} se={r.bb100Se} />
            </ResultRow>
            <ResultRow label="Showdown" title={RESULT_DEFS.showdown} dot="sd">
              <span className={tone(last?.showdown ?? 0)}>{signed(last?.showdown ?? 0, 1)} bb</span>
            </ResultRow>
            <ResultRow label="Non-showdown" title={RESULT_DEFS.nonShowdown} dot="nsd">
              <span className={tone(last?.nonShowdown ?? 0)}>{signed(last?.nonShowdown ?? 0, 1)} bb</span>
            </ResultRow>
            <ResultRow label="All-in EV" title={RESULT_DEFS.allInEv} dot="ev">
              {evReady ? (
                <>
                  {signed(r.evNetBB, 1)} bb <span className="muted">· </span>
                  <Bb100 v={r.evBb100} se={r.evBb100Se} /> <span className="muted">bb/100 · {r.evHands} 手 all-in</span>
                </>
              ) : (
                <span className="muted">計算中…</span>
              )}
            </ResultRow>
            <ResultRow label="Luck" title="實際盈虧 − All-in EV（正 = 運氣好）">
              {evReady ? <span className={tone(r.netBB - r.evNetBB)}>{signed(r.netBB - r.evNetBB, 1)} bb</span> : '—'}
            </ResultRow>
          </tbody>
        </table>
      </div>
    </section>
    <section className="card">
        <h2>
          CBet 切分 <span className="h-note">持續下注依情境拆開（格內 n = 樣本數）</span>
        </h2>
        <div className="scroll-x">
          <table className="stats splits">
            <thead>
              <tr>
                <th />
                {SPLITS.map((s) => (
                  <th key={s}>
                    <Term en={s} zh={GLOSSARY[s]} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAT_KEYS.filter((k) => STAT_DEFS[k].splittable).map((k) => (
                <tr key={k}>
                  <th scope="row" title={defText(k)}>
                    <Term en={STAT_DEFS[k].label} zh={STAT_DEFS[k].zh} />
                  </th>
                  {SPLITS.map((s) => {
                    const cell = r.splits[k]?.[s] ?? { num: 0, den: 0 };
                    return (
                      <td key={s}>
                        <RatioCell r={cell} def={`${defText(k)}\n切分：${s}（${GLOSSARY[s]}）`} compact />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </section>
    </>
  );
}
