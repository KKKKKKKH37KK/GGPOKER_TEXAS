import { LUCK_GRADES, MIN_LUCK_HANDS, type Luck } from '../stats/luck';
import { signed } from './format';

export const LUCK_HELP =
  '運氣只看 all-in 且雙方亮牌的手（其他手看不到對手的牌，無法客觀判斷）。\n' +
  'z =（實際結果 − All-in EV）總和 ÷ 這些 all-in 預期的標準差（由所有可能的發牌結果算出）。\n' +
  '⛈️ 極差 z ≤ −1.5 · 🌧️ 偏差 −1.5~−0.5 · ☁️ 正常 −0.5~+0.5 · 🌤️ 偏好 +0.5~+1.5 · ☀️ 極好 ≥ +1.5';

function describe(l: Luck): string {
  if (l.z === null) return `all-in 只有 ${l.n} 手，至少 ${MIN_LUCK_HANDS} 手才評等`;
  const worse = Math.round((l.percentile ?? 0) * 100);
  return `z = ${signed(l.z, 2)}：所有可能的發牌結果中，約 ${worse}% 比這次更倒楣、${100 - worse}% 比這次更幸運`;
}

/** Standalone card: the luck meter alone, nothing else beside it. */
export function LuckCard({ luck, evReady }: { luck: Luck; evReady: boolean }) {
  return (
    <section className="card luck-card">
      <h2>
        運氣等級
      </h2>
      {evReady ? <LuckMeter luck={luck} /> : <p className="muted">All-in EV 計算中…</p>}
    </section>
  );
}

/** Five-level luck meter with weather icons. */
export function LuckMeter({ luck }: { luck: Luck }) {
  const title = `${LUCK_HELP}\n\n${luck.n} 手 all-in · 運氣 ${signed(luck.luckBB, 1)} bb · 預期波動 ±${luck.sdBB.toFixed(1)} bb\n${describe(luck)}`;
  return (
    <div className="luck-meter" title={title}>
      <div className="luck-steps" role="img" aria-label={luck.grade ? `運氣${luck.grade.label}` : '運氣樣本不足'}>
        {LUCK_GRADES.map((g) => (
          <span key={g.level} className={`luck-step${luck.grade?.level === g.level ? ' on' : ''}`}>
            <span className="luck-icon">{g.icon}</span>
            <span className="luck-label">{g.label}</span>
          </span>
        ))}
      </div>
      {!luck.grade && <div className="kpi-sub">{describe(luck)}</div>}
    </div>
  );
}
