import { useState } from 'react';
import { coarseLine } from '../stats/aggregate';
import type { StatsResult } from '../stats/types';
import type { Drill } from './drill';
import { int, signed, tone } from './format';

const LINE_HELP: [RegExp, string][] = [
  [/^Fold$/, '翻前第一個決策就棄牌（盲注位置會損失已下的盲注，屬於固定成本）'],
  [/^Walk$/, '大盲時其他人全棄牌'],
  [/^Open/, 'Open = 前面全部棄牌時首位加注開池'],
  [/^Iso-raise/, '前面有人 limp，Hero 加注孤立'],
  [/^BB call/, '大盲跟注一次加注（同一位置直接棄牌是 −1bb，每手比 −1 還差代表跟注在虧錢）'],
  [/^Cold call/, '非大盲位置，第一個決策就跟注一次加注'],
  [/^3Bet/, 'Hero 第一個決策就再加注（前面有 open、沒有 caller）'],
  [/^Squeeze/, 'open 之後已有人跟注，Hero 再加注'],
  [/^Cold 4Bet/, '前面已有 open 和 3Bet，Hero 直接 4Bet'],
  [/limp/, 'Limp = 平跟入池'],
];
const helpFor = (line: string) => LINE_HELP.find(([re]) => re.test(line))?.[1] ?? '';

interface Props {
  r: StatsResult;
  onDrill: (d: Drill) => void;
}

/** Results by preflop action line: where the money is won or lost. */
export function LinesTable({ r, onDrill }: Props) {
  const [coarse, setCoarse] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const rows = coarse ? r.linesCoarse : r.lines;
  const shown = showAll ? rows : rows.slice(0, 15);
  return (
    <section className="card">
      <h2>
        依翻前動作線 <span className="h-note">錢從哪裡漏：每條線的盈虧、每手 bb ± 95% 區間、扣除 all-in 運氣後的每手 bb；可搭配上方位置與深度篩選</span>
        <span className="seg">
          <button className={coarse ? 'on' : ''} onClick={() => setCoarse(true)} title="合併 open 者的位置">
            合併位置
          </button>
          <button className={!coarse ? 'on' : ''} onClick={() => setCoarse(false)} title="依 open 者位置細分（vs UTG / HJ / CO…）">
            細分
          </button>
        </span>
      </h2>
      <div className="scroll-x">
        <table className="stats lines">
          <thead>
            <tr>
              <th>動作線</th>
              <th>手數</th>
              <th>合計 bb</th>
              <th title="每手平均 bb；± 為 95% 信賴區間">每手 bb</th>
              <th title="All-in 的手用 equity 期望值取代實際結果（扣除運氣）">EV 每手 bb</th>
              <th title="這條線對整體 bb/100 的貢獻 = 合計 bb / 總手數 × 100">對 bb/100 貢獻</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const half = l.perHandSe === null ? null : 1.96 * l.perHandSe;
              const significant = half !== null && Math.abs(l.perHand) > half;
              return (
                <tr
                  key={l.line}
                  className="clickable"
                  title={`${helpFor(l.line)}\n（點擊查看這些手牌）`}
                  onClick={() =>
                    onDrill({
                      title: `動作線：${l.line}`,
                      match: (f) => (coarse ? coarseLine(f.line) : f.line) === l.line,
                    })
                  }
                >
                  <th scope="row">{l.line}</th>
                  <td>{int(l.hands)}</td>
                  <td className={tone(l.netBB)}>{signed(l.netBB, 1)}</td>
                  <td className={significant ? tone(l.perHand) : 'insig'}>
                    {signed(l.perHand, 2)}
                    {half !== null && half > 0 && <span className="ci">±{half.toFixed(2)}</span>}
                  </td>
                  <td className={tone(l.evPerHand)}>{signed(l.evPerHand, 2)}</td>
                  <td className={tone(l.netBB)}>{signed((l.netBB / r.hands) * 100, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 15 && (
        <button className="link" onClick={() => setShowAll(!showAll)}>
          {showAll ? '只顯示前 15 條' : `顯示全部 ${rows.length} 條`}
        </button>
      )}
    </section>
  );
}
