import { useMemo, useState } from 'react';
import { GLOSSARY, STAT_DEFS } from '../stats/definitions';
import type { HandFacts } from '../stats/types';
import { Cards } from './Cards';
import { type Drill, statValue } from './drill';
import { int, signed, tone } from './format';

type Mode = 'all' | 'made' | 'notMade';
type Sort = 'timeAsc' | 'timeDesc' | 'netAsc' | 'netDesc';
const PAGE = 100;

const POT_LABEL: Record<string, string> = { UNOPENED: 'Limped', SRP: 'SRP', '3BP': '3BP', '4BP+': '4BP+' };

interface Props {
  drill: Drill;
  facts: HandFacts[];
  onOpen: (ids: string[], index: number) => void;
  onClose: () => void;
}

/** Lists the hands behind any number on the page (feature: drill-down). */
export function HandList({ drill, facts, onOpen, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('all');
  const [sort, setSort] = useState<Sort>('netAsc');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    let list = facts.filter(drill.match);
    if (drill.statKey && mode !== 'all') {
      const want = mode === 'made' ? 1 : 0;
      list = list.filter((f) => statValue(f, drill.statKey!) === want);
    }
    const net = (f: HandFacts) => f.netCents / f.bb;
    const cmp: Record<Sort, (a: HandFacts, b: HandFacts) => number> = {
      timeAsc: (a, b) => (a.timestamp < b.timestamp ? -1 : 1),
      timeDesc: (a, b) => (a.timestamp < b.timestamp ? 1 : -1),
      netAsc: (a, b) => net(a) - net(b),
      netDesc: (a, b) => net(b) - net(a),
    };
    return [...list].sort(cmp[sort]);
  }, [facts, drill, mode, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, (page + 1) * PAGE);
  const totalBB = rows.reduce((a, f) => a + f.netCents / f.bb, 0);
  const ids = rows.map((f) => f.id);
  const def = drill.statKey ? STAT_DEFS[drill.statKey] : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="手牌列表">
        <header>
          <h2>
            {drill.title} <span className="h-note">{int(rows.length)} 手 · 合計 {signed(totalBB, 1)} bb</span>
          </h2>
          <button className="link" onClick={onClose}>
            關閉
          </button>
        </header>
        <div className="list-controls">
          {def && (
            <span className="seg">
              {(
                [
                  ['all', `全部機會（分母）`],
                  ['made', `有做 ${def.num}（分子）`],
                  ['notMade', '沒做'],
                ] as [Mode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  className={mode === m ? 'on' : ''}
                  onClick={() => {
                    setMode(m);
                    setPage(0);
                  }}
                >
                  {label}
                </button>
              ))}
            </span>
          )}
          <label>
            排序
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="netAsc">輸最多在前</option>
              <option value="netDesc">贏最多在前</option>
              <option value="timeAsc">時間（舊→新）</option>
              <option value="timeDesc">時間（新→舊）</option>
            </select>
          </label>
          <span className="muted small">點一列看逐街重播</span>
        </div>
        <div className="scroll-x">
          <table className="stats hand-list">
            <thead>
              <tr>
                <th>時間</th>
                <th>位置</th>
                <th>手牌</th>
                <th>牌面</th>
                <th title="Pot type">底池</th>
                <th title="有效籌碼">有效 bb</th>
                <th>淨 bb</th>
                <th title="All-in 期望值（只有 all-in 的手才有）">EV bb</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f, i) => {
                const net = f.netCents / f.bb;
                const ev = f.evNetCents === undefined ? null : f.evNetCents / f.bb;
                return (
                  <tr key={f.id} className="clickable" onClick={() => onOpen(ids, page * PAGE + i)} title={f.id}>
                    <td className="muted">{f.timestamp.slice(5, 16).replace('T', ' ')}</td>
                    <td title={GLOSSARY[f.position]}>{f.position}</td>
                    <td>
                      <Cards cards={f.heroCards} />
                    </td>
                    <td>
                      <Cards cards={f.board} empty="—" />
                    </td>
                    <td>{f.walk ? 'Walk' : f.sawFlop ? POT_LABEL[f.potType] : <span className="muted">翻前結束</span>}</td>
                    <td>{f.effStackBB.toFixed(0)}</td>
                    <td className={tone(net)}>{signed(net, 1)}</td>
                    <td className={ev === null ? 'muted' : tone(ev)}>{ev === null ? '' : signed(ev, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="pager">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>
              上一頁
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              下一頁
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
