const SUIT: Record<string, { sym: string; cls: string }> = {
  s: { sym: '♠', cls: 'suit-s' },
  h: { sym: '♥', cls: 'suit-h' },
  d: { sym: '♦', cls: 'suit-d' },
  c: { sym: '♣', cls: 'suit-c' },
};

/** Four-colour deck rendering: ♠ dark, ♥ red, ♦ blue, ♣ green */
export function Cards({ cards, empty = '' }: { cards: string[] | null | undefined; empty?: string }) {
  if (!cards || cards.length === 0) return <span className="muted">{empty}</span>;
  return (
    <span className="cards">
      {cards.map((c, i) => {
        const s = SUIT[c[1]?.toLowerCase()] ?? { sym: c[1], cls: '' };
        return (
          <span key={i} className={`card ${s.cls}`}>
            {c[0] === 'T' ? '10' : c[0]}
            {s.sym}
          </span>
        );
      })}
    </span>
  );
}
