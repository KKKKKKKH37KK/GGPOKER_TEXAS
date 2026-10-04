import type { Position } from '../parser/types';
import { POSITIONS, STACK_GROUPS } from '../stats/aggregate';
import type { Filter, PotType, StackBounds, StackGroup } from '../stats/types';

const POT_TYPES: { key: PotType; label: string }[] = [
  { key: 'UNOPENED', label: 'Limped' },
  { key: 'SRP', label: 'SRP' },
  { key: '3BP', label: '3BP' },
  { key: '4BP+', label: '4BP+' },
];

export function stackLabel(g: StackGroup, b: StackBounds) {
  return g === 'S100' ? `≤${b.low}bb` : g === 'S150' ? `${b.low}–${b.high}bb` : `>${b.high}bb`;
}

function toggle<T>(list: T[] | undefined, v: T): T[] {
  const cur = list ?? [];
  return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
}

interface Props {
  filter: Filter;
  onChange: (f: Filter) => void;
  bounds: StackBounds;
  dateRange: [string, string];
}

/** F8: every report recalculates live from these filters. An empty group means "all". */
export function Filters({ filter, onChange, bounds, dateRange }: Props) {
  const active =
    !!filter.dateFrom || !!filter.dateTo || !!filter.positions?.length || !!filter.stackGroups?.length || !!filter.potTypes?.length;
  return (
    <section className="filters">
      <label className="f-date">
        <span>日期</span>
        <input
          type="date"
          value={filter.dateFrom ?? ''}
          min={dateRange[0]}
          max={dateRange[1]}
          onChange={(e) => onChange({ ...filter, dateFrom: e.target.value || undefined })}
        />
        <span>–</span>
        <input
          type="date"
          value={filter.dateTo ?? ''}
          min={dateRange[0]}
          max={dateRange[1]}
          onChange={(e) => onChange({ ...filter, dateTo: e.target.value || undefined })}
        />
      </label>
      <div className="chips" role="group" aria-label="位置">
        {POSITIONS.map((p: Position) => (
          <button
            key={p}
            className={filter.positions?.includes(p) ? 'on' : ''}
            onClick={() => onChange({ ...filter, positions: toggle(filter.positions, p) })}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="籌碼深度">
        {STACK_GROUPS.map((g) => (
          <button
            key={g}
            className={filter.stackGroups?.includes(g) ? 'on' : ''}
            onClick={() => onChange({ ...filter, stackGroups: toggle(filter.stackGroups, g) })}
          >
            {stackLabel(g, bounds)}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Pot type" title="Pot type 篩選只含 Hero 看到 flop 的手（翻前統計在此篩選下沒有意義）">
        {POT_TYPES.map((t) => (
          <button
            key={t.key}
            className={filter.potTypes?.includes(t.key) ? 'on' : ''}
            onClick={() => onChange({ ...filter, potTypes: toggle(filter.potTypes, t.key) })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active && (
        <button className="link" onClick={() => onChange({})}>
          清除篩選
        </button>
      )}
    </section>
  );
}
