/** "$1,234.5" / "1234.56" / "0.1" → integer cents. Never goes through floating point. */
export function toCents(raw: string): number {
  const s = raw.replace(/[$,\s]/g, '');
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[1] === '' && m[2] === undefined)) throw new Error(`Bad amount: "${raw}"`);
  const whole = m[1] === '' ? 0 : parseInt(m[1], 10);
  const frac = m[2] === undefined ? 0 : parseInt(m[2].padEnd(2, '0'), 10);
  return whole * 100 + frac;
}

export function formatDollars(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
