// Line grammar for GG Poker hand histories (PRD §3.3). Player names are Hero or 8-hex hashes,
// so `(.+?)` before ": " is unambiguous.
const AMT = '\\$([\\d,]+(?:\\.\\d+)?)';

export const RE = {
  header: new RegExp(
    `^Poker Hand #(\\S+): (.+?) \\(${AMT}/${AMT}\\) - (\\d{4})/(\\d{2})/(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2})$`,
  ),
  table: /^Table '(.+)' (\d+)-max Seat #(\d+) is the button$/,
  seat: new RegExp(`^Seat (\\d+): (.+?) \\(${AMT} in chips\\)(.*)$`),
  street: /^\*\*\* (?:(FIRST|SECOND) )?(HOLE CARDS|FLOP|TURN|RIVER|SHOWDOWN|SUMMARY) \*\*\*(.*)$/,
  post: new RegExp(`^(.+?): posts (small blind|big blind|the ante|ante|straddle|missed blind|dead blind)s? ${AMT}( and is all-in)?$`),
  action: new RegExp(
    `^(.+?): (folds|checks|calls ${AMT}|bets ${AMT}|raises ${AMT} to ${AMT})( and is all-in)?$`,
  ),
  dealt: /^Dealt to (\S+)(?: \[([^\]]+)\])?$/,
  uncalled: new RegExp(`^Uncalled bet \\(${AMT}\\) returned to (.+)$`),
  shows: /^(.+?): shows \[([^\]]+)\](?: \(.*\))?$/,
  collected: new RegExp(`^(.+?) collected ${AMT} from pot$`),
  cashDrop: new RegExp(`^Cash Drop to Pot : total ${AMT}$`),
  evChoose: /^(.+?): Chooses to EV Cashout$/,
  evRisk: new RegExp(`^(.+?): Pays Cashout Risk \\(${AMT}\\)$`),
  evReceive: new RegExp(`^(.+?): Receives Cashout \\(${AMT}\\)$`),
  totalPot: new RegExp(
    `^Total pot ${AMT} \\| Rake ${AMT} \\| Jackpot ${AMT} \\| Bingo ${AMT} \\| Fortune ${AMT} \\| Tax ${AMT}$`,
  ),
  board: /^(?:(FIRST|SECOND) )?Board \[([^\]]*)\]$/,
  runTwice: /^Hand was run two times$/,
  summarySeat: /^Seat (\d+): (.+)$/,
  cards: /\[([^\]]*)\]/g,
};

export function cardsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(RE.cards)) {
    for (const c of m[1].trim().split(/\s+/)) if (c) out.push(c);
  }
  return out;
}
