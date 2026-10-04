import { useEffect } from 'react';
import { GLOSSARY } from '../stats/definitions';
import type { Replay } from '../stats/replay';
import { Cards } from './Cards';
import { signed, tone } from './format';

const STREET_LABEL = { PRE: '翻前 Preflop', FLOP: '翻牌 Flop', TURN: '轉牌 Turn', RIVER: '河牌 River' };
const bbText = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0$/, '')}bb`;

interface Props {
  replay: Replay | null;
  loading: boolean;
  position: { index: number; total: number } | null;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

/** Street-by-street text replay of one hand, amounts in bb with the running pot. */
export function HandReplay({ replay, loading, position, onPrev, onNext, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev, onNext, onClose]);

  const posOf = (name: string) => replay?.players.find((p) => p.name === name)?.position ?? '';

  return (
    <div className="modal-backdrop top" onClick={onClose}>
      <div className="modal replay" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="手牌重播">
        <header>
          <h2>
            {replay ? replay.id : '載入中…'}
            {replay && (
              <span className="h-note">
                {replay.timestamp} · {replay.stakes} · {replay.tableName}
              </span>
            )}
          </h2>
          <span className="replay-nav">
            {position && (
              <>
                <button onClick={onPrev} disabled={position.index === 0} title="上一手（←）">
                  ←
                </button>
                <span className="muted small">
                  {position.index + 1} / {position.total}
                </span>
                <button onClick={onNext} disabled={position.index >= position.total - 1} title="下一手（→）">
                  →
                </button>
              </>
            )}
            <button className="link" onClick={onClose}>
              關閉
            </button>
          </span>
        </header>

        {loading && !replay && <p className="muted">載入中…</p>}
        {replay && (
          <>
            <table className="stats seats">
              <tbody>
                {replay.players.map((p) => (
                  <tr key={p.seat} className={p.isHero ? 'hero-row' : ''}>
                    <td className="muted">Seat {p.seat}</td>
                    <td title={GLOSSARY[p.position]}>{p.position}</td>
                    <td>{p.isHero ? <b>Hero</b> : <span className="mono">{p.name}</span>}</td>
                    <td>{bbText(Math.round(p.stackBB * 10) / 10)}</td>
                    <td>
                      <Cards cards={p.cards} empty="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {replay.cashDropBB > 0 && <p className="small muted">Cash Drop 放入底池 {bbText(replay.cashDropBB)}</p>}

            {replay.streets.map((s) => (
              <div key={s.street} className="street">
                <div className="street-head">
                  <b>{STREET_LABEL[s.street]}</b>
                  {s.board.length > 0 && <Cards cards={s.board} />}
                  <span className="muted small">底池 {bbText(Math.round(s.potStartBB * 100) / 100)}</span>
                </div>
                {s.actions.length === 0 && s.street !== 'PRE' && <div className="muted small dealt-note">（已 all-in，直接發牌）</div>}
                {s.actions.map((a, i) => (
                  <div key={i} className={`act${a.isHero ? ' hero' : ''}`}>
                    <span className="act-pos">{a.position}</span>
                    <span className="act-name">{a.isHero ? 'Hero' : a.player}</span>
                    <span>
                      {a.verb}
                      {a.amountBB !== undefined && ` ${bbText(Math.round(a.amountBB * 100) / 100)}`}
                      {a.allIn && <b className="neg"> all-in</b>}
                    </span>
                    <span className="muted small act-pot">pot {bbText(Math.round(a.potBB * 100) / 100)}</span>
                  </div>
                ))}
              </div>
            ))}

            {replay.runItTwice &&
              replay.boards.slice(1).map((b, i) => (
                <div className="street" key={i}>
                  <div className="street-head">
                    <b>{i === 0 ? '第二次發牌（Run it twice）' : '第三次發牌（Run it three times）'}</b>
                    <Cards cards={b} />
                  </div>
                </div>
              ))}

            <div className="street result">
              {replay.uncalled.map((u) => (
                <div key={u.player} className="small muted">
                  未被跟注退回 {u.player === 'Hero' ? 'Hero' : `${posOf(u.player)} ${u.player}`}：{bbText(Math.round(u.bb * 100) / 100)}
                </div>
              ))}
              {replay.collected.map((c) => (
                <div key={c.player}>
                  {c.position} {c.player === 'Hero' ? <b>Hero</b> : c.player} 贏得 {bbText(Math.round(c.bb * 100) / 100)}
                </div>
              ))}
              <div className="small muted">
                總底池 {bbText(Math.round(replay.totalPotBB * 100) / 100)} · 抽水 {bbText(Math.round(replay.rakeBB * 100) / 100)}
              </div>
              <div>
                Hero 淨盈虧 <b className={tone(replay.heroNetBB)}>{signed(replay.heroNetBB, 2)} bb</b>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
