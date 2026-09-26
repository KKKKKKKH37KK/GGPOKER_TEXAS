// Fast 5–7 card hold'em evaluator. Cards are ints: rank * 4 + suit, rank 0 = deuce … 12 = ace.
// Score = category << 20 | five 4-bit kicker ranks; higher is better.

const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'cdhs';

export function cardToInt(card: string): number {
  const r = RANK_CHARS.indexOf(card[0].toUpperCase());
  const s = SUIT_CHARS.indexOf(card[1].toLowerCase());
  if (r < 0 || s < 0 || card.length !== 2) throw new Error(`Bad card: ${card}`);
  return r * 4 + s;
}

export const CATEGORY = ['High card', 'Pair', 'Two pair', 'Trips', 'Straight', 'Flush', 'Full house', 'Quads', 'Straight flush'];

/** Highest straight rank in a 13-bit rank mask (wheel = 3), or −1 */
function straightHigh(mask: number): number {
  // Shift ranks up one bit and copy the ace into bit 0 so A-2-3-4-5 is a run.
  const withWheel = (mask << 1) | ((mask >> 12) & 1);
  for (let hi = 13; hi >= 4; hi--) {
    const run = 0b11111 << (hi - 4);
    if ((withWheel & run) === run) return hi - 1;
  }
  return -1;
}

function topBits(mask: number, n: number): number {
  let out = 0;
  let taken = 0;
  for (let r = 12; r >= 0 && taken < n; r--) {
    if (mask & (1 << r)) {
      out = (out << 4) | r;
      taken++;
    }
  }
  return out << (4 * (5 - taken));
}

const counts = new Uint8Array(13);
const suitMask = new Int32Array(4);
const suitCount = new Uint8Array(4);

export function evaluate(cards: ArrayLike<number>, len = cards.length): number {
  counts.fill(0);
  suitMask.fill(0);
  suitCount.fill(0);
  let rankMask = 0;
  for (let i = 0; i < len; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    counts[r]++;
    suitMask[s] |= 1 << r;
    suitCount[s]++;
    rankMask |= 1 << r;
  }

  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      const sf = straightHigh(suitMask[s]);
      if (sf >= 0) return (8 << 20) | (sf << 16);
      return (5 << 20) | topBits(suitMask[s], 5);
    }
  }

  let quad = -1;
  let trip1 = -1;
  let trip2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const n = counts[r];
    if (n === 4) quad = r;
    else if (n === 3) {
      if (trip1 < 0) trip1 = r;
      else if (trip2 < 0) trip2 = r;
    } else if (n === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  if (quad >= 0) return (7 << 20) | (quad << 16) | (topBits(rankMask & ~(1 << quad), 1) >> 4);
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    const p = Math.max(trip2, pair1);
    return (6 << 20) | (trip1 << 16) | (p << 12);
  }
  const st = straightHigh(rankMask);
  if (st >= 0) return (4 << 20) | (st << 16);
  if (trip1 >= 0) return (3 << 20) | (trip1 << 16) | (topBits(rankMask & ~(1 << trip1), 2) >> 4);
  if (pair1 >= 0 && pair2 >= 0) {
    const rest = rankMask & ~(1 << pair1) & ~(1 << pair2);
    return (2 << 20) | (pair1 << 16) | (pair2 << 12) | (topBits(rest, 1) >> 8);
  }
  if (pair1 >= 0) return (1 << 20) | (pair1 << 16) | (topBits(rankMask & ~(1 << pair1), 3) >> 4);
  return topBits(rankMask, 5);
}

export const categoryOf = (score: number) => CATEGORY[score >> 20];
