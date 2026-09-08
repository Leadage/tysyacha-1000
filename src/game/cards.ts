/**
 * Карты игры «Тысяча».
 * Колода 24 карты: 9 J Q K 10 A в четырёх мастях.
 */

export type Suit = 'S' | 'C' | 'D' | 'H'; // пики, трефы, бубны, червы
export type Rank = '9' | 'J' | 'Q' | 'K' | 'T' | 'A';

/** Идентификатор карты, например 'AS' — туз пик, 'TH' — десятка червей. */
export type CardId = string;

export const SUITS: Suit[] = ['S', 'C', 'D', 'H'];
export const RANKS: Rank[] = ['9', 'J', 'Q', 'K', 'T', 'A'];

/** Старшинство: 9 < J < Q < K < 10 < A */
export const RANK_ORDER: Record<Rank, number> = {
  '9': 0,
  J: 1,
  Q: 2,
  K: 3,
  T: 4,
  A: 5,
};

/** Номинальная стоимость карты в очках. */
export const RANK_VALUE: Record<Rank, number> = {
  '9': 0,
  J: 2,
  Q: 3,
  K: 4,
  T: 10,
  A: 11,
};

/** Стоимость марьяжа (K+Q одной масти). */
export const MARRIAGE_VALUE: Record<Suit, number> = {
  S: 40,
  C: 60,
  D: 80,
  H: 100,
};

/** Стоимость тузового марьяжа (все четыре туза). */
export const ACE_MARRIAGE_VALUE = 200;

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  C: '♣',
  D: '♦',
  H: '♥',
};

export const SUIT_NAME_RU: Record<Suit, string> = {
  S: 'пики',
  C: 'трефы',
  D: 'бубны',
  H: 'червы',
};

export const SUIT_NAME_RU_ADJ: Record<Suit, string> = {
  S: 'пиковый',
  C: 'трефовый',
  D: 'бубновый',
  H: 'червовый',
};

export const RANK_LABEL: Record<Rank, string> = {
  '9': '9',
  J: 'J',
  Q: 'Q',
  K: 'K',
  T: '10',
  A: 'A',
};

export function isRed(suit: Suit): boolean {
  return suit === 'D' || suit === 'H';
}

export function makeCard(rank: Rank, suit: Suit): CardId {
  return rank + suit;
}

export function rankOf(card: CardId): Rank {
  return card[0] as Rank;
}

export function suitOf(card: CardId): Suit {
  return card[1] as Suit;
}

export function cardValue(card: CardId): number {
  return RANK_VALUE[rankOf(card)];
}

export function cardOrder(card: CardId): number {
  return RANK_ORDER[rankOf(card)];
}

/** Суммарная стоимость набора карт. */
export function handValue(cards: CardId[]): number {
  let sum = 0;
  for (const c of cards) sum += cardValue(c);
  return sum;
}

/** Сравнение карт одной масти: >0 если a старше b. */
export function compareRank(a: CardId, b: CardId): number {
  return cardOrder(a) - cardOrder(b);
}

/** Человекочитаемое имя карты. */
export function cardName(card: CardId): string {
  return RANK_LABEL[rankOf(card)] + SUIT_SYMBOL[suitOf(card)];
}

/** Сортировка руки: по мастям (♠ ♣ ♦ ♥), внутри масти по возрастанию старшинства. */
export function sortHand(cards: CardId[]): CardId[] {
  const suitIdx: Record<Suit, number> = { S: 0, C: 1, D: 2, H: 3 };
  return [...cards].sort((a, b) => {
    const s = suitIdx[suitOf(a)] - suitIdx[suitOf(b)];
    if (s !== 0) return s;
    return cardOrder(a) - cardOrder(b);
  });
}

/** Все карты указанной масти из набора. */
export function cardsOfSuit(cards: CardId[], suit: Suit): CardId[] {
  return cards.filter((c) => suitOf(c) === suit);
}

/** Самая старшая карта набора одной масти (или null). */
export function highestOfSuit(cards: CardId[], suit: Suit): CardId | null {
  let best: CardId | null = null;
  for (const c of cards) {
    if (suitOf(c) !== suit) continue;
    if (best === null || cardOrder(c) > cardOrder(best)) best = c;
  }
  return best;
}
