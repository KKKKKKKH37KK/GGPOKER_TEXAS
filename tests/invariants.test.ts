import { describe, expect, it } from 'vitest';
import { hasZip, loadZip } from './helpers';

describe.skipIf(!hasZip)('reference zip — parser invariants (PRD §4.3)', () => {
  it('parses every hand with zero warnings and zero invariant failures', async () => {
    const r = await loadZip();
    expect(r.fileCount).toBe(92);
    expect(r.hands.length + r.otherGames.length).toBe(7882);
    expect(r.hands).toHaveLength(7880);
    expect(r.skipped).toEqual({ PLO: 2 });
    expect(r.duplicates).toBe(0);
    expect(r.errorCount).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it('hands are sorted by (timestamp, id)', async () => {
    const { hands } = await loadZip();
    for (let i = 1; i < hands.length; i++) {
      const a = hands[i - 1];
      const b = hands[i];
      expect(a.timestamp < b.timestamp || (a.timestamp === b.timestamp && a.id < b.id)).toBe(true);
    }
  });
});
