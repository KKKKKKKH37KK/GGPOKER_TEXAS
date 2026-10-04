import { POST_TABLE, PRE_TABLE, STAT_DEFS, type StatKey } from '../stats/definitions';
import type { Benchmark, Settings } from './settings';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

/** F9 stack-depth boundaries and F14 target ranges. Stored in this browser only. */
export function SettingsPanel({ settings, onChange, onClose }: Props) {
  const setBench = (k: StatKey | 'af', patch: Benchmark) => {
    const next = { ...settings.benchmarks[k], ...patch };
    onChange({ ...settings, benchmarks: { ...settings.benchmarks, [k]: next } });
  };
  const rows: { key: StatKey | 'af'; label: string; unit: string }[] = [
    ...PRE_TABLE.map((k) => ({ key: k, label: STAT_DEFS[k].label, unit: '%' })),
    { key: 'af', label: 'AF', unit: '' },
    ...POST_TABLE.map((k) => ({ key: k, label: STAT_DEFS[k].label, unit: '%' })),
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
          基準區間
          <span className="h-note">超出區間的格子會標色（低於 = 藍、高於 = 紅）</span>
        </h3>
        <div className="bench-list">
          {rows.map((r) => {
            const b = settings.benchmarks[r.key] ?? {};
            return (
              <div key={r.key} className="bench-row">
                <span>{r.label}</span>
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
              </div>
            );
          })}
        </div>
        <button className="link" onClick={() => onChange({ ...settings, benchmarks: {} })}>
          清除所有基準
        </button>
      </div>
    </div>
  );
}
