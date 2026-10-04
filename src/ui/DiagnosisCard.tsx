import { useState } from 'react';
import { coarseLine } from '../stats/aggregate';
import type { Diagnosis, Finding } from '../stats/diagnose';
import type { Drill } from './drill';
import { int } from './format';
import { statDrill } from './StatsTable';

function toDrill(f: Finding): Drill | null {
  const t = f.target;
  if (!t) return null;
  if (t.type === 'stat') {
    const d = statDrill(t.key);
    return t.position ? { ...d, title: `${d.title} · ${t.position}`, match: (h) => h.position === t.position && d.match(h) } : d;
  }
  if (t.type === 'line') return { title: `動作線：${t.line}`, match: (h) => (t.coarse ? coarseLine(h.line) : h.line) === t.line };
  return { title: `位置 ${t.position}`, match: (h) => h.position === t.position };
}

function Item({ f, onDrill }: { f: Finding; onDrill: (d: Drill) => void }) {
  const drill = toDrill(f);
  return (
    <li className={`finding ${f.kind}`}>
      <div className="finding-head">
        <b>{f.title}</b>
        {drill && (
          <button className="link small" onClick={() => onDrill(drill)}>
            查看手牌
          </button>
        )}
      </div>
      <div className="finding-ev">{f.evidence}</div>
      {f.why && <div className="finding-why">{f.why}</div>}
      {f.fix && (
        <div className="finding-fix">
          <span className="fix-tag">怎麼修</span> {f.fix}
        </div>
      )}
    </li>
  );
}

interface Props {
  d: Diagnosis;
  onDrill: (d: Drill) => void;
  onOpenSettings: () => void;
}

/** Automatic play review: leaks, strengths and a watch list, gated on sample size. */
export function DiagnosisCard({ d, onDrill, onOpenSettings }: Props) {
  const [showAllGood, setShowAllGood] = useState(false);
  if (!d.enoughData) {
    return (
      <section className="card diagnosis">
        <h2>打法診斷</h2>
        <p className="muted">
          目前 {int(d.hands)} 手，未達分析門檻 {int(d.minHands)} 手（樣本太少時頻率的誤差太大，結論不可靠）。累積更多手牌，或在
          <button className="link" onClick={onOpenSettings}>
            設定
          </button>
          調整門檻。篩選條件也會影響手數。
        </p>
      </section>
    );
  }
  const good = showAllGood ? d.strengths : d.strengths.slice(0, 6);
  return (
    <section className="card diagnosis">
      <h2>
        打法診斷
        <span className="h-note">
          依目前篩選的 {int(d.hands)} 手自動產生；只有 95% 區間整個超出參考範圍才列為漏洞。參考範圍是近似經驗值，可在設定修改。
        </span>
      </h2>
      <div className="diag-grid">
        <div>
          <h3 className="neg">需要修正（{d.leaks.length}）</h3>
          {d.leaks.length === 0 ? (
            <p className="muted small">沒有統計上確定的漏洞。</p>
          ) : (
            <ol className="findings">
              {d.leaks.map((f) => (
                <Item key={f.title} f={f} onDrill={onDrill} />
              ))}
            </ol>
          )}
        </div>
        <div>
          <h3 className="pos">打得好（{d.strengths.length}）</h3>
          {d.strengths.length === 0 ? (
            <p className="muted small">還沒有統計上確定的強項。</p>
          ) : (
            <ul className="findings">
              {good.map((f) => (
                <Item key={f.title} f={f} onDrill={onDrill} />
              ))}
            </ul>
          )}
          {d.strengths.length > 6 && (
            <button className="link small" onClick={() => setShowAllGood(!showAllGood)}>
              {showAllGood ? '收起' : `顯示全部 ${d.strengths.length} 項`}
            </button>
          )}
          {d.watch.length > 0 && (
            <>
              <h3>觀察中（{d.watch.length}）</h3>
              <p className="muted small">點估計超出參考範圍，但 95% 區間仍和範圍重疊，可能只是雜訊；累積更多手牌再看。</p>
              <ul className="findings compact">
                {d.watch.map((f) => (
                  <Item key={f.title} f={f} onDrill={onDrill} />
                ))}
              </ul>
            </>
          )}
          {d.info.length > 0 && (
            <>
              <h3>背景</h3>
              <ul className="findings compact">
                {d.info.map((f) => (
                  <Item key={f.title} f={f} onDrill={onDrill} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
