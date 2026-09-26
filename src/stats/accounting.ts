import { HERO, type Hand } from '../parser/types';

/**
 * invested[p] = blinds + calls + bets + raises (raiseTo − already in on this street) − uncalled returned. (PRD §4.2)
 */
export function computeInvested(hand: Hand): Record<string, number> {
  const invested: Record<string, number> = {};
  let street = '';
  let streetIn: Record<string, number> = {};
  for (const a of hand.actions) {
    if (a.street !== street) {
      street = a.street;
      streetIn = {};
    }
    const before = streetIn[a.player] ?? 0;
    let put = 0;
    switch (a.type) {
      case 'postSB':
      case 'postBB':
      case 'call':
      case 'bet':
        put = a.amount;
        break;
      case 'raise':
        put = (a.raiseTo ?? 0) - before;
        break;
      case 'postOther':
        // Antes / dead blinds are dead money: count as investment but not as a live street bet.
        invested[a.player] = (invested[a.player] ?? 0) + a.amount;
        continue;
      default:
        continue;
    }
    streetIn[a.player] = before + put;
    invested[a.player] = (invested[a.player] ?? 0) + put;
  }
  for (const [p, v] of Object.entries(hand.uncalledReturned)) {
    invested[p] = (invested[p] ?? 0) - v;
  }
  return invested;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Returns the list of failed invariants (PRD §4.3); empty when the hand balances. */
export function checkInvariants(hand: Hand, invested = computeInvested(hand)): string[] {
  const s = hand.summary;
  const errors: string[] = [];
  const inv = sum(Object.values(invested));
  if (inv + hand.cashDrop !== s.totalPot) {
    errors.push(`Σinvested (${inv}) + cashDrop (${hand.cashDrop}) ≠ totalPot (${s.totalPot})`);
  }
  const out = sum(Object.values(hand.collected)) + s.rake + s.jackpot + s.bingo + s.fortune + s.tax;
  if (out !== s.totalPot) {
    errors.push(`Σcollected + rake + jackpot + bingo + fortune + tax (${out}) ≠ totalPot (${s.totalPot})`);
  }
  return errors;
}

/** Net result in cents for a player (PRD §4.2). */
export function playerNet(hand: Hand, player: string, invested = computeInvested(hand)): number {
  const co = hand.cashouts[player];
  return (hand.collected[player] ?? 0) + (co?.received ?? 0) - (invested[player] ?? 0) - (co?.riskPaid ?? 0);
}

export function heroNet(hand: Hand, invested = computeInvested(hand)): number {
  return playerNet(hand, HERO, invested);
}
