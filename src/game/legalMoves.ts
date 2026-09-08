import { CardId, Suit, cardOrder, suitOf } from './cards';
import { RoundState } from './gameState';
import { RuleSettings } from './settings';
import { hasAceMarriage, marriageSuits } from './marriages';

/**
 * Разрешённые карты для хода.
 * — есть масть первого хода → обязан ходить в масть;
 * — иначе, если объявлен козырь и он есть на руке → обязан положить козырь;
 * — иначе любая карта.
 * При ходе первым действует ограничение «нельзя ходить с чужих козырей» (если включено).
 */
export function legalCards(
  hand: CardId[],
  round: RoundState,
  player: number,
  rules: RuleSettings,
): CardId[] {
  const trick = round.currentTrick;
  if (!trick || trick.cards.length === 0) {
    // ход первым
    if (rules.noLeadForeignTrump && round.trump && round.trumpOwner !== null && round.trumpOwner !== player) {
      const nonTrump = hand.filter((c) => suitOf(c) !== round.trump);
      if (nonTrump.length > 0) return nonTrump;
    }
    return [...hand];
  }

  const leadSuit = suitOf(trick.cards[0].card);
  const ofSuit = hand.filter((c) => suitOf(c) === leadSuit);
  if (ofSuit.length > 0) return ofSuit;

  if (round.trump) {
    const trumps = hand.filter((c) => suitOf(c) === round.trump);
    if (trumps.length > 0) return trumps;
  }
  return [...hand];
}

/** Победитель взятки: старший козырь, иначе старшая карта масти первого хода. */
export function trickWinner(cards: { player: number; card: CardId }[], trump: Suit | null): number {
  const leadSuit = suitOf(cards[0].card);
  let best = cards[0];
  for (let i = 1; i < cards.length; i++) {
    const c = cards[i];
    if (beats(c.card, best.card, leadSuit, trump)) best = c;
  }
  return best.player;
}

/** Бьёт ли карта a карту b (b — текущая старшая во взятке). */
export function beats(a: CardId, b: CardId, leadSuit: Suit, trump: Suit | null): boolean {
  const sa = suitOf(a);
  const sb = suitOf(b);
  const aTrump = trump !== null && sa === trump;
  const bTrump = trump !== null && sb === trump;
  if (aTrump && !bTrump) return true;
  if (!aTrump && bTrump) return false;
  if (aTrump && bTrump) return cardOrder(a) > cardOrder(b);
  // оба не козыри
  if (sa !== leadSuit) return false;
  if (sb !== leadSuit) return true;
  return cardOrder(a) > cardOrder(b);
}

/**
 * Может ли игрок объявить марьяж этой картой.
 * Условия: ход первым во взятке, карта — K или Q, на руке есть парная карта,
 * и (взята хотя бы одна взятка ИЛИ разрешено хвалить с первого хода).
 */
export function canDeclareMarriage(
  hand: CardId[],
  card: CardId,
  round: RoundState,
  player: number,
  rules: RuleSettings,
): Suit | null {
  const trick = round.currentTrick;
  if (trick && trick.cards.length > 0) return null;
  const r = card[0];
  if (r !== 'K' && r !== 'Q') return null;
  const s = suitOf(card);
  if (!marriageSuits(hand).includes(s)) return null;
  if (round.marriages.some((m) => m.player === player && m.suit === s)) return null;
  if (!rules.marriageFromFirstMove && (round.tricksWon[player] || 0) === 0) return null;
  return s;
}

/** Может ли игрок объявить тузовый марьяж этой картой. */
export function canDeclareAceMarriage(
  hand: CardId[],
  card: CardId,
  round: RoundState,
  player: number,
  rules: RuleSettings,
): boolean {
  if (!rules.aceMarriage) return false;
  const trick = round.currentTrick;
  if (trick && trick.cards.length > 0) return false;
  if (card[0] !== 'A') return false;
  if (!hasAceMarriage(hand)) return false;
  if (round.marriages.some((m) => m.player === player && m.suit === null)) return false;
  if (!rules.marriageFromFirstMove && (round.tricksWon[player] || 0) === 0) return false;
  return true;
}

/** Масти, марьяж которых игрок ещё может объявить при своём ходе. */
export function declarableMarriageSuits(
  hand: CardId[],
  round: RoundState,
  player: number,
  rules: RuleSettings,
): Suit[] {
  const trick = round.currentTrick;
  if (trick && trick.cards.length > 0) return [];
  if (!rules.marriageFromFirstMove && (round.tricksWon[player] || 0) === 0) return [];
  return marriageSuits(hand).filter(
    (s) => !round.marriages.some((m) => m.player === player && m.suit === s),
  );
}
