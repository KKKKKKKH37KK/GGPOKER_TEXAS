import { GLOSSARY, STAT_DEFS, type StatKey } from '../stats/definitions';
import type { GroupRow } from '../stats/types';
import { int, signed, tone } from './format';
import { RatioCell } from './RatioCell';
import { benchFor, type Settings } from './settings';
import { defText } from './StatsTable';
import { Bb100, Term } from './Term';

const COLS: StatKey[] = ['vpip', 'pfr', 'rfi', 'threeBet', 'foldTo3Bet', 'foldToSteal', 'sawFlop', 'wtsd', 'wsd', 'flopCbet'];

interface Props {
  title: string;
  rows: { key: string; label: string; zh?: string; row: GroupRow; bench?: Partial<Record<StatKey, StatKey | null>> }[];
  settings: Settings;
  note?: string;
}

/** F5 (by position) and F9 (by stack depth) */
export function GroupTable({ title, rows, settings, note }: Props) {
  return (
    <section className="card">
      <h2>
        {title}
        {note && <span className="h-note">{note}</span>}
      </h2>
      <div className="scroll-x">
        <table className="stats group">
          <thead>
            <tr>
              <th />
              <th>
                <Term en="Hands" zh={GLOSSARY.Hands} />
              </th>
              <th>
                <Term en="Net bb" zh="淨盈虧" />
              </th>
              <th title="Σ heroNetBB / 手數 × 100（含 walk）；± 為 95% 信賴區間">
                <Term en="bb/100" zh="± 95% 區間" />
              </th>
              {COLS.map((k) => (
                <th key={k} title={defText(k)}>
                  <Term en={STAT_DEFS[k].label} zh={STAT_DEFS[k].zh} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, zh, row, bench }) => (
              <tr key={key}>
                <th scope="row">
                  <Term en={label} zh={zh} />
                </th>
                <td>{int(row.hands)}</td>
                <td className={tone(row.netBB)}>{signed(row.netBB, 1)}</td>
                <td>
                  <Bb100 v={row.bb100} se={row.bb100Se} />
                </td>
                {COLS.map((k) => (
                  <td key={k}>
                    {/* A row can point a column at a more specific reference (RFI → RFI BTN on the BTN row) or drop it (null). */}
                    <RatioCell
                      r={row.stats[k]}
                      def={defText(k)}
                      bench={bench && k in bench ? (bench[k] ? benchFor(settings, bench[k]!) : undefined) : benchFor(settings, k)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
