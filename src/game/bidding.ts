import { CardId } from './cards';
import { PlayerState, RoundState } from './gameState';
import { maxBidByMarriages } from './marriages';
import { RuleSettings } from './settings';

export const MIN_BID = 100;
export const BID_STEP = 5;

/** Верхняя граница заказа для игрока с учётом договорённостей. */
export function maxBidFor(hand: CardId[], rules: RuleSettings): number {
  if (rules.bidAbove120WithoutMarriage) return 400;
  return Math.min(400, maxBidByMarriages(hand));
}

/** Обязан ли игрок молчать (большой минус). */
export function mustBeSilent(player: PlayerState, rules: RuleSettings): boolean {
  return rules.silenceEnabled && player.total < rules.silenceThreshold;
}

/** Список допустимых ставок для игрока (без учёта паса). */
export function legalBids(
  round: RoundState,
  player: number,
  hand: CardId[],
  players: PlayerState[],
  rules: RuleSettings,
): number[] {
  if (round.golden && !rules.goldenCanRaise) return [];
  if (mustBeSilent(players[player], rules)) return [];

  const base = round.highestBid;
  const from = base + BID_STEP;
  const cap = maxBidFor(hand, rules);
  if (from > cap) return [];
  if (rules.noJumpBids) return [from];

  const res: number[] = [];
  for (let v = from; v <= cap; v += BID_STEP) res.push(v);
  return res;
}

/** Может ли игрок объявить тёмную. */
export function canDeclareDark(
  round: RoundState,
  player: number,
  players: PlayerState[],
  rules: RuleSettings,
): boolean {
  if (!rules.darkEnabled) return false;
  if (round.golden) return false;
  if (round.mandatoryBidder !== player) return false;
  if (round.bids.length > 0) return false;
  if (players[player].total < rules.darkMinScore) return false;
  if (!rules.darkWhenBarrel && players.some((p) => p.onBarrel)) return false;
  return true;
}

/** Окончательный заказ не может быть меньше выигранной ставки. */
export function legalFinalContracts(round: RoundState, hand: CardId[], rules: RuleSettings): number[] {
  if (round.golden && !rules.goldenCanRaise) return [round.highestBid];
  const cap = Math.max(round.highestBid, maxBidFor(hand, rules));
  const res: number[] = [];
  for (let v = round.highestBid; v <= cap; v += BID_STEP) res.push(v);
  return res;
}
