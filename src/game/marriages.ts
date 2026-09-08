import {
  ACE_MARRIAGE_VALUE,
  CardId,
  MARRIAGE_VALUE,
  SUITS,
  Suit,
  rankOf,
  suitOf,
} from './cards';

/** Масти, по которым в наборе есть полный марьяж (K + Q). */
export function marriageSuits(cards: CardId[]): Suit[] {
  const res: Suit[] = [];
  for (const s of SUITS) {
    const hasK = cards.some((c) => suitOf(c) === s && rankOf(c) === 'K');
    const hasQ = cards.some((c) => suitOf(c) === s && rankOf(c) === 'Q');
    if (hasK && hasQ) res.push(s);
  }
  return res;
}

/** Суммарная стоимость всех марьяжей в наборе. */
export function marriagesValue(cards: CardId[]): number {
  return marriageSuits(cards).reduce((a, s) => a + MARRIAGE_VALUE[s], 0);
}

/** Есть ли все четыре туза (тузовый марьяж). */
export function hasAceMarriage(cards: CardId[]): boolean {
  return SUITS.every((s) => cards.includes('A' + s));
}

/** Половинки марьяжей: масти, где есть только K или только Q. */
export function halfMarriageSuits(cards: CardId[]): Suit[] {
  const res: Suit[] = [];
  for (const s of SUITS) {
    const hasK = cards.some((c) => suitOf(c) === s && rankOf(c) === 'K');
    const hasQ = cards.some((c) => suitOf(c) === s && rankOf(c) === 'Q');
    if (hasK !== hasQ) res.push(s);
  }
  return res;
}

/** Бонус сидящего на прикупе при игре вчетвером. */
export function talonSitterBonus(
  talon: CardId[],
  withMarriage: boolean,
  withHalfMarriage: boolean,
): number {
  let bonus = 0;
  if (withMarriage) {
    for (const s of marriageSuits(talon)) bonus += MARRIAGE_VALUE[s];
  }
  if (withHalfMarriage) {
    for (const s of halfMarriageSuits(talon)) bonus += Math.round(MARRIAGE_VALUE[s] / 2);
  }
  return bonus;
}

/**
 * Максимально допустимый заказ по классическому ограничению:
 * 120 + стоимость марьяжей на руке.
 */
export function maxBidByMarriages(cards: CardId[]): number {
  return 120 + marriagesValue(cards);
}

export { MARRIAGE_VALUE, ACE_MARRIAGE_VALUE };
