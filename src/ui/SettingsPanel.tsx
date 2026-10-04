import { AF_DEF, POST_TABLE, PRE_TABLE, STAT_DEFS, type StatKey } from '../stats/definitions';
import { benchFor, defaultBench, type Benchmark, type BenchKey, type Settings } from './settings';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

/** F9 stack-depth boundaries and F14 target ranges. Stored in this browser only. */
export function SettingsPanel({ settings, onChange, onClose }: Props) {
  // Editing a row stores an override seeded from the current (default) range.
  const setBench = (k: BenchKey, patch: Benchmark) => {
    const next = { ...benchFor(settings, k), ...patch };
    onChange({ ...settings, benchmarks: { ...settings.benchmarks, [k]: next } });
  };
  const resetOne = (k: BenchKey) => {
    const rest = { ...settings.benchmarks };
    delete rest[k];
    onChange({ ...settings, benchmarks: rest });
  };
  const rows: { key: BenchKey; label: string; zh: string; unit: string }[] = [
    ...PRE_TABLE.map((k: StatKey) => ({ key: k, label: STAT_DEFS[k].label, zh: STAT_DEFS[k].zh, unit: '%' })),
    { key: 'af', label: 'AF', zh: AF_DEF.zh, unit: '' },
    ...POST_TABLE.map((k: StatKey) => ({ key: k, label: STAT_DEFS[k].label, zh: STAT_DEFS[k].zh, unit: '%' })),
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="設定">
        <header>
          <h2>設定</h2>
          <button className="link" onClick={onClose}>
            關閉
          </button>
        </header>

        <h3>資料保存</h3>
        <label className="check">
          <input type="checkbox" checked={settings.persist} onChange={(e) => onChange({ ...settings, persist: e.target.checked })} />
          在這台電腦的瀏覽器保存上傳的檔案，下次打開自動載入
        </label>
        <p className="muted small">
          檔案只存在這個瀏覽器（IndexedDB），不會上傳到任何地方。關閉這個選項會立即刪除已保存的檔案；共用電腦建議關閉。
        </p>

        <h3>打法診斷</h3>
        <div className="bounds">
          <label>
            至少
            <input
              type="number"
              min={500}
              step={500}
              value={settings.minHands}
              onChange={(e) => onChange({ ...settings, minHands: Math.max(0, Number(e.target.value) || 0) })}
            />
            手才分析
          </label>
          <span className="muted small">每條規則另外要求該統計至少 100 次機會；建議不要低於 3,000 手</span>
        </div>

        <h3>籌碼深度分組（bb）</h3>
        <div className="bounds">
          <label>
            依據
            <select
              value={settings.bounds.basis ?? 'effective'}
              onChange={(e) =>
                onChange({ ...settings, bounds: { ...settings.bounds, basis: e.target.value as 'effective' | 'hero' } })
              }
            >
              <option value="effective">有效籌碼（vs 最深對手）</option>
              <option value="hero">Hero 起始籌碼</option>
            </select>
          </label>
          <label>
            100bb 組 ≤
            <input
              type="number"
              value={settings.bounds.low}
              min={1}
              onChange={(e) => onChange({ ...settings, bounds: { ...settings.bounds, low: Number(e.target.value) || 0 } })}
            />
          </label>
          <label>
            200bb+ 組 &gt;
            <input
              type="number"
              value={settings.bounds.high}
              min={1}
              onChange={(e) => onChange({ ...settings, bounds: { ...settings.bounds, high: Number(e.target.value) || 0 } })}
            />
          </label>
          <button className="link" onClick={() => onChange({ ...settings, bounds: { ...settings.bounds, low: 125, high: 175 } })}>
            還原 125 / 175
          </button>
        </div>

        <h3>
          參考範圍
          <span className="h-note">
            預設值是 6-max NL 約 100bb 贏家常見範圍的近似值（經驗值，非 solver 解），請依自己的 GTO 研究調整。
            低於 = 藍、高於 = 紅；深色 = 95% 區間整個在範圍外（偏離可信），淺色 = 只有點估計超出（可能是雜訊）。
          </span>
        </h3>
        <div className="bench-list">
          {rows.map((r) => {
            const b = benchFor(settings, r.key) ?? {};
            const d = defaultBench(r.key);
            const overridden = r.key in settings.benchmarks;
            return (
              <div key={r.key} className="bench-row">
                <span>
                  {r.label} <span className="muted small">{r.zh}</span>
                </span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="min"
                  value={b.min ?? ''}
                  onChange={(e) => setBench(r.key, { min: num(e.target.value) })}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="max"
                  value={b.max ?? ''}
                  onChange={(e) => setBench(r.key, { max: num(e.target.value) })}
                />
                <span className="muted">{r.unit}</span>
                {overridden ? (
                  <button className="link small" onClick={() => resetOne(r.key)} title={d ? `預設 ${d.min}–${d.max}` : '預設無範圍'}>
                    預設
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
        <button className="link" onClick={() => onChange({ ...settings, benchmarks: {} })}>
          全部還原為預設範圍
        </button>
      </div>
    </div>
  );
}
