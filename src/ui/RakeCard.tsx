import type { StatsResult } from '../stats/types';
import { dollars, signed } from './format';
import type { Settings } from './settings';
import { Term } from './Term';

interface Props {
  r: StatsResult;
  settings: Settings;
  onRakeback: (pct: number) => void;
}

/** Rake paid, pre-rake win rate, Cash Drop income and a rakeback estimate. All in bb and bb/100. */
export function RakeCard({ r, settings, onRakeback }: Props) {
  if (r.hands === 0) return null;
  const per100 = (bb: number) => (bb / r.hands) * 100;
  const k = r.rakeBB;
  const c = r.rakeCents;
  const rb = settings.rakebackPct / 100;
  const rows: { en: string; zh: string; bb: number; cents: number; title: string; strong?: boolean }[] = [
    { en: 'Rake paid', zh: '繳納抽水', bb: -k.rakeContrib, cents: -c.rakeContrib, title: '每手 rake × Hero 投入占比（依投入比例分攤，多數網站算 rakeback 的方式）' },
    { en: 'Jackpot fee', zh: 'Jackpot 費用', bb: -k.jackpotContrib, cents: -c.jackpotContrib, title: 'Jackpot / Bingo / Fortune / Tax，同樣依投入比例分攤' },
    {
      en: 'Pre-rake', zh: '扣抽水前盈虧', strong: true,
      bb: r.netBB + k.rakeContrib + k.jackpotContrib,
      cents: r.netCents + c.rakeContrib + c.jackpotContrib,
      title: '實際盈虧 + 繳納的 rake 與 jackpot：衡量牌技本身，不受抽水影響',
    },
    { en: 'Cash Drop', zh: '平台贈送彩池', bb: k.cashDropWon, cents: c.cashDropWon, title: '從 Cash Drop 底池分到的促銷獎金（已含在實際盈虧中）' },
    { en: 'Net (actual)', zh: '實際盈虧（已扣抽水）', bb: r.netBB, cents: r.netCents, title: '與帳戶餘額變化一致', strong: true },
  ];
  if (rb > 0) {
    rows.push({ en: 'Rakeback', zh: `返水估算（${settings.rakebackPct}%）`, bb: k.rakeContrib * rb, cents: c.rakeContrib * rb, title: '繳納的 rake × 返水 %（jackpot 費用通常不返）' });
    rows.push({ en: 'Net + rakeback', zh: '含返水盈虧', bb: r.netBB + k.rakeContrib * rb, cents: r.netCents + c.rakeContrib * rb, title: '實際盈虧 + 返水估算', strong: true });
  }
  return (
    <section className="card">
      <h2>
        Rake <span className="h-note">抽水分析 · 網站其他盈虧數字都已扣掉抽水</span>
        <label className="rb-input" title="GG 的 rakeback（Fish Buffet 等）實際算法請以官方說明為準">
          返水 %
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={settings.rakebackPct}
            onChange={(e) => onRakeback(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </label>
      </h2>
      <div className="scroll-x">
        <table className="stats">
          <thead>
            <tr>
              <th />
              <th>bb</th>
              <th>bb/100</th>
              <th>$</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.en} title={row.title} className={row.strong ? 'strong-row' : ''}>
                <th scope="row">
                  <Term en={row.en} zh={row.zh} />
                </th>
                <td className={row.bb > 0 ? 'pos' : row.bb < 0 ? 'neg' : ''}>{signed(row.bb, 1)}</td>
                <td className={row.bb > 0 ? 'pos' : row.bb < 0 ? 'neg' : ''}>{signed(per100(row.bb))}</td>
                <td className="muted">{dollars(Math.round(row.cents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        另一種分攤法（只算從你贏的底池中被扣掉的部分）：{signed(-k.takeWon, 1)} bb（{signed(per100(-k.takeWon))} bb/100）。
        rake 屬於確定的成本，不是雜訊；pre-rake 勝率仍有和 bb/100 相同的誤差範圍。
      </p>
    </section>
  );
}

