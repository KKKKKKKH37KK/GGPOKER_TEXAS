import { RESULT_DEFS, STAT_DEFS, type StatKey } from '../stats/definitions';
import type { StatsResult } from '../stats/types';
import { dollars, int, signed, tone } from './format';
import { RatioCell } from './RatioCell';
import type { Settings } from './settings';

const KPI_STATS: StatKey[] = ['vpip', 'pfr', 'threeBet', 'wtsd', 'wsd'];

export function KpiCards({ r, settings, evReady }: { r: StatsResult; settings: Settings; evReady: boolean }) {
  return (
    <section className="kpis">
      <div className="kpi">
        <div className="kpi-label">Hands</div>
        <div className="kpi-value">{int(r.hands)}</div>
        <div className="kpi-sub">walks {int(r.walks)} · N {int(r.n)}</div>
      </div>
      <div className="kpi" title={RESULT_DEFS.netWon}>
        <div className="kpi-label">Net</div>
        <div className={`kpi-value ${tone(r.netCents)}`}>{dollars(r.netCents)}</div>
        <div className="kpi-sub">{signed(r.netBB, 1)} bb</div>
      </div>
      <div className="kpi" title={RESULT_DEFS.bb100}>
        <div className="kpi-label">bb/100</div>
        <div className={`kpi-value ${tone(r.bb100)}`}>{r.bb100 === null ? '—' : signed(r.bb100)}</div>
        <div className="kpi-sub" title={RESULT_DEFS.allInEv}>
          {evReady && r.hands ? `All-in EV ${signed((r.evNetBB / r.hands) * 100)}` : 'All-in EV 計算中…'}
        </div>
      </div>
      {KPI_STATS.map((k) => (
        <div className="kpi" key={k}>
          <div className="kpi-label">{STAT_DEFS[k].label}</div>
          <div className="kpi-value">
            <RatioCell r={r.stats[k]} def={`分母：${STAT_DEFS[k].den}\n分子：${STAT_DEFS[k].num}`} bench={settings.benchmarks[k]} />
          </div>
        </div>
      ))}
    </section>
  );
}
