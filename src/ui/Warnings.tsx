import type { Warning } from '../parser/types';

/** F7: unrecognised lines (deduplicated, with counts), parse errors and invariant failures. */
export function Warnings({ warnings }: { warnings: Warning[] }) {
  type Unknown = Extract<Warning, { kind: 'unknownLine' }>;
  const unknown = warnings.filter((w): w is Unknown => w.kind === 'unknownLine');
  const errors = warnings.filter((w): w is Exclude<Warning, Unknown> => w.kind !== 'unknownLine');
  return (
    <section className="card">
      <h2>
        Warnings <span className={`badge${warnings.length ? ' warn' : ' ok'}`}>{warnings.length}</span>
      </h2>
      {warnings.length === 0 && <p className="muted">沒有無法辨識的行，所有手牌的會計不變式都成立。</p>}
      {errors.length > 0 && (
        <>
          <h3>解析錯誤 / 不變式失敗（這些手已排除在統計外）</h3>
          <table className="stats warn-table">
            <tbody>
              {errors.map((w, i) => (
                <tr key={i}>
                  <th scope="row">{w.handId}</th>
                  <td>{w.kind === 'invariant' ? '不變式' : '解析'}</td>
                  <td className="mono">{w.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {unknown.length > 0 && (
        <>
          <h3>無法辨識的行</h3>
          <table className="stats warn-table">
            <thead>
              <tr>
                <th>次數</th>
                <th>行（金額與 ID 已正規化）</th>
                <th>範例手牌</th>
              </tr>
            </thead>
            <tbody>
              {unknown
                .sort((a, b) => b.count - a.count)
                .map((w, i) => (
                  <tr key={i}>
                    <td>{w.count}</td>
                    <td className="mono">{w.line}</td>
                    <td className="mono">{w.sampleHandId}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
