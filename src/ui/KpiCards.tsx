import { GLOSSARY, RESULT_DEFS, STAT_DEFS, type StatKey } from '../stats/definitions';
import type { StatsResult } from '../stats/types';
import { dollars, int, signed, tone } from './format';
import { RatioCell } from './RatioCell';
import { benchFor, type Settings } from './settings';
import type { Drill } from './drill';
import { defText, statDrill } from './StatsTable';
import { Bb100, Term } from './Term';
import { LuckMeter } from './LuckMeter';

const KPI_STATS: StatKey[] = ['vpip', 'pfr', 'threeBet', 'wtsd', 'wsd'];

export function KpiCards({ r, settings, evReady, onDrill }: { r: StatsResult; settings: Settings; evReady: boolean; onDrill: (d: Drill) => void }) {
  return (
    <section className="kpis">
      <div className="kpi clickable" onClick={() => onDrill({ title: '全部手牌', match: () => true })} title="點擊列出全部手牌">
        <div className="kpi-label">
          <Term en="Hands" zh={GLOSSARY.Hands} />
        </div>
        <div className="kpi-value">{int(r.hands)}</div>
        <div className="kpi-sub" title="walk：大盲時其他人全棄牌，Hero 沒有決策；N = 有決策的手數">
          walks {int(r.walks)} · N {int(r.n)}
        </div>
      </div>
      <div className="kpi" title={RESULT_DEFS.netWon}>
        <div className="kpi-label">
          <Term en="Net" zh={GLOSSARY.Net} />
        </div>
        <div className={`kpi-value ${tone(r.netCents)}`}>{dollars(r.netCents)}</div>
        <div className="kpi-sub">{signed(r.netBB, 1)} bb</div>
      </div>
      <div className="kpi" title={RESULT_DEFS.bb100}>
        <div className="kpi-label">
          <Term en="bb/100" zh={GLOSSARY['bb/100']} />
        </div>
        <div className="kpi-value">
          <Bb100 v={r.bb100} se={r.bb100Se} />
        </div>
        <div className="kpi-sub" title={RESULT_DEFS.allInEv}>
          {evReady ? (
            <>
              All-in EV <Bb100 v={r.evBb100} se={r.evBb100Se} /> bb/100
            </>
          ) : (
            'All-in EV 計算中…'
          )}
        </div>
      </div>
      <div className="kpi kpi-wide">
        <div className="kpi-label">
          <Term en="Luck" zh="運氣等級（all-in）" />
        </div>
        {evReady ? <LuckMeter luck={r.luck} /> : <div className="kpi-sub">All-in EV 計算中…</div>}
      </div>
      {KPI_STATS.map((k) => (
        <div className="kpi" key={k}>
          <div className="kpi-label">
            <Term en={STAT_DEFS[k].label} zh={STAT_DEFS[k].zh} />
          </div>
          <div className="kpi-value">
            <RatioCell r={r.stats[k]} def={defText(k)} bench={benchFor(settings, k)} onClick={() => onDrill(statDrill(k))} />
          </div>
        </div>
      ))}
    </section>
  );
}
