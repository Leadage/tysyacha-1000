import { CardId, RANKS, SUITS, makeCard, rankOf } from './cards';
import { Rng } from './rng';

/** Полная колода из 24 карт. */
export function fullDeck(): CardId[] {
  const d: CardId[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push(makeCard(r, s));
  return d;
}

export interface DealResult {
  hands: CardId[][]; // по 7 карт каждому из трёх участников
  talon: CardId[]; // 3 карты прикупа
}

/**
 * Раздача на трёх участников: 7 + 7 + 7 + 3 = 24.
 */
export function deal(rng: Rng): DealResult {
  const deck = rng.shuffle(fullDeck());
  const hands: CardId[][] = [deck.slice(0, 7), deck.slice(7, 14), deck.slice(14, 21)];
  const talon = deck.slice(21, 24);
  return { hands, talon };
}

/** Количество девяток в наборе. */
export function countNines(cards: CardId[]): number {
  return cards.filter((c) => rankOf(c) === '9').length;
}
