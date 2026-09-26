import { STAT_DEFS, type StatKey } from '../stats/definitions';
import type { GroupRow } from '../stats/types';
import { int, signed, tone } from './format';
import { RatioCell } from './RatioCell';
import type { Settings } from './settings';
import { defText } from './StatsTable';

const COLS: StatKey[] = ['vpip', 'pfr', 'threeBet', 'ats', 'foldTo3Bet', 'foldToSteal', 'sawFlop', 'wtsd', 'wsd', 'flopCbet'];

interface Props {
  title: string;
  rows: { key: string; label: string; row: GroupRow }[];
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
              <th>Hands</th>
              <th>Net bb</th>
              <th title="Σ heroNetBB / 手數 × 100（含 walk）">bb/100</th>
              {COLS.map((k) => (
                <th key={k} title={defText(k)}>
                  {STAT_DEFS[k].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, row }) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{int(row.hands)}</td>
                <td className={tone(row.netBB)}>{signed(row.netBB, 1)}</td>
                <td className={tone(row.bb100)}>{row.bb100 === null ? '—' : signed(row.bb100)}</td>
                {COLS.map((k) => (
                  <td key={k}>
                    <RatioCell r={row.stats[k]} def={defText(k)} bench={settings.benchmarks[k]} />
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
