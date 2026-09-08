/**
 * Компьютерные игроки.
 *
 * Принципиальное ограничение: AI получает на вход только объект Knowledge,
 * который строится из информации, доступной этому игроку по правилам:
 * своя рука, объявленные ставки, сыгранные карты, прикуп (если он раскрыт)
 * и полученная при сносе карта. Чужие руки и закрытый прикуп недоступны.
 */

import {
  ACE_MARRIAGE_VALUE,
  CardId,
  MARRIAGE_VALUE,
  RANK_VALUE,
  SUITS,
  Suit,
  cardOrder,
  cardValue,
  cardsOfSuit,
  handValue,
  rankOf,
  suitOf,
} from './cards';
import { fullDeck, countNines } from './deck';
import { AiLevel, GameState, RoundState } from './gameState';
import { hasAceMarriage, marriageSuits } from './marriages';
import { beats, declarableMarriageSuits, legalCards } from './legalMoves';
import { legalBids, legalFinalContracts, maxBidFor } from './bidding';
import { Action, currentPlayerToMove, minBarrelContract } from './gameEngine';
import { Rng } from './rng';
import { roundToFive } from './scoring';

export interface Knowledge {
  me: number;
  level: AiLevel;
  hand: CardId[];
  /** карты, вышедшие из игры (сыграны во взятках) */
  played: CardId[];
  /** карты в текущей незаконченной взятке */
  onTable: CardId[];
  /** прикуп, если он был показан */
  knownTalon: CardId[];
  /** карта, полученная при сносе (я её видел) */
  receivedCard: CardId | null;
  /** карты, местонахождение которых мне неизвестно */
  unknown: CardId[];
  trump: Suit | null;
  trumpOwner: number | null;
  contractPlayer: number;
  contract: number;
  participants: number[];
  tricksWon: Record<number, number>;
  cardPoints: Record<number, number>;
  marriagePoints: Record<number, number>;
}

export function buildKnowledge(s: GameState, me: number): Knowledge {
  const r = s.round!;
  const hand = [...(r.hands[me] || [])];
  const played: CardId[] = [];
  for (const t of r.tricks) for (const c of t.cards) played.push(c.card);
  const onTable: CardId[] = r.currentTrick ? r.currentTrick.cards.map((c) => c.card) : [];

  const isCp = me === r.contractPlayer;
  const knownTalon: CardId[] = r.talonRevealed || isCp ? [...r.talon] : [];

  const receivedCard = r.seenDiscard[me] ?? null;

  const known = new Set<CardId>([...hand, ...played, ...onTable, ...knownTalon]);
  if (receivedCard) known.add(receivedCard);
  if (!s.rules.blindDiscard) {
    // снос открытый — все видят, кому что ушло
    for (const k of Object.keys(r.discardedTo)) known.add(r.discardedTo[Number(k)]);
  }
  const unknown = fullDeck().filter((c) => !known.has(c));

  return {
    me,
    level: s.players[me].aiLevel,
    hand,
    played,
    onTable,
    knownTalon,
    receivedCard,
    unknown,
    trump: r.trump,
    trumpOwner: r.trumpOwner,
    contractPlayer: r.contractPlayer,
    contract: r.contract,
    participants: r.participants,
    tricksWon: r.tricksWon,
    cardPoints: r.cardPoints,
    marriagePoints: r.marriagePoints,
  };
}

// ------------------------------------------------------------ оценка руки

function longestSuit(hand: CardId[]): Suit {
  let best: Suit = 'S';
  let bestN = -1;
  for (const s of SUITS) {
    const n = cardsOfSuit(hand, s).length;
    if (n > bestN) {
      bestN = n;
      best = s;
    }
  }
  return best;
}

function pickTrump(hand: CardId[]): Suit {
  const ms = marriageSuits(hand);
  if (ms.length > 0) {
    return ms.reduce((a, b) => (MARRIAGE_VALUE[b] > MARRIAGE_VALUE[a] ? b : a));
  }
  return longestSuit(hand);
}

/** Вероятность, что карта возьмёт взятку (грубая модель). */
function winProb(card: CardId, hand: CardId[], trump: Suit | null): number {
  const s = suitOf(card);
  const r = rankOf(card);
  const isTrump = trump !== null && s === trump;
  const suitLen = cardsOfSuit(hand, s).length;
  const hasAce = hand.includes('A' + s);
  const hasTen = hand.includes('T' + s);

  if (r === 'A') return isTrump ? 0.95 : 0.85;
  if (r === 'T') {
    if (isTrump) return hasAce ? 0.9 : 0.55;
    return hasAce ? 0.7 : 0.28;
  }
  if (r === 'K') {
    if (isTrump) return hasAce && hasTen ? 0.75 : 0.45;
    return hasAce && hasTen ? 0.35 : 0.1;
  }
  if (r === 'Q') return isTrump ? 0.35 : 0.06;
  if (r === 'J') return isTrump ? 0.25 : 0.03;
  // 9
  return isTrump ? 0.12 + Math.max(0, suitLen - 4) * 0.1 : 0.0;
}

/**
 * Оценка количества очков, которые игрок наберёт этой рукой.
 * hasTalon — учитывать ли будущее усиление от прикупа и сноса.
 */
export function estimatePoints(hand: CardId[], hasTalon: boolean, forcedTrump?: Suit | null): number {
  const trump = forcedTrump !== undefined ? forcedTrump : pickTrump(hand);
  const ms = marriageSuits(hand);
  let marriage = 0;
  for (const s of ms) marriage += MARRIAGE_VALUE[s];
  // объявить марьяж удаётся не всегда — нужно взять взятку
  const marriageConf = ms.length > 0 ? 0.85 : 0;
  let pts = marriage * marriageConf;

  if (hasAceMarriage(hand)) pts += ACE_MARRIAGE_VALUE * 0.8;

  for (const c of hand) {
    const p = winProb(c, hand, trump);
    pts += p * (cardValue(c) + 9);
  }

  if (trump) {
    const len = cardsOfSuit(hand, trump).length;
    if (len >= 4) pts += (len - 3) * 8;
  }

  if (hasTalon) {
    // 3 карты прикупа + возможность сноса двух худших
    pts += 20;
    // шанс докупить половинку марьяжа
    const halves = SUITS.filter((s) => {
      const hasK = hand.includes('K' + s);
      const hasQ = hand.includes('Q' + s);
      return hasK !== hasQ;
    });
    for (const s of halves) pts += MARRIAGE_VALUE[s] * 0.14;
  }

  return pts;
}

// ------------------------------------------------------------ решения

function noise(rng: Rng, level: AiLevel): number {
  if (level === 'novice') return (rng.next() - 0.5) * 40;
  if (level === 'medium') return (rng.next() - 0.5) * 16;
  return (rng.next() - 0.5) * 6;
}

function safetyMargin(level: AiLevel): number {
  if (level === 'novice') return 10;
  if (level === 'medium') return 24;
  return 32;
}

/** Ставка бота в торговле. null — пас. */
export function aiChooseBid(s: GameState, me: number, rng: Rng): number | null {
  const r = s.round!;
  const hand = r.hands[me];
  const allowed = legalBids(r, me, hand, s.players, s.rules);
  if (allowed.length === 0) return null;

  const level = s.players[me].aiLevel;
  const est = estimatePoints(hand, true) + noise(rng, level) - safetyMargin(level);
  let target = Math.floor(est / 5) * 5;

  // на бочке имеет смысл заказывать только достаточный контракт
  const p = s.players[me];
  if (p.onBarrel) {
    const need = minBarrelContract(s);
    if (target < need) {
      // рискнуть, если рука хотя бы приличная
      target = est > need - 35 ? need : 0;
    }
  }

  // если общий счёт сильно отстаёт — играем агрессивнее
  const maxOther = Math.max(...s.players.filter((x) => x.index !== me).map((x) => x.total));
  if (maxOther - p.total > 300) target += 10;

  const cap = maxBidFor(hand, s.rules);
  target = Math.min(target, cap);

  const options = allowed.filter((v) => v <= target);
  if (options.length === 0) return null;
  return options[options.length - 1];
}

export function aiDecideDark(s: GameState, me: number, rng: Rng): boolean {
  const p = s.players[me];
  if (p.total < s.rules.darkMinScore) return false;
  const level = p.aiLevel;
  const base = level === 'novice' ? 0.2 : level === 'medium' ? 0.12 : 0.08;
  // если сильно отстаём — темним чаще
  const maxOther = Math.max(...s.players.filter((x) => x.index !== me).map((x) => x.total));
  const bonus = maxOther - p.total > 250 ? 0.25 : 0;
  return rng.next() < base + bonus;
}

export function aiDecideRedeal(s: GameState, me: number): boolean {
  const r = s.round!;
  const hand = r.hands[me];
  if (s.rules.redealFourNines && countNines(hand) === 4) return true;
  if (s.rules.redealLowHand && handValue(hand) < s.rules.redealLowHandValue) return true;
  return false;
}

export function aiDecideTalonRedeal(s: GameState): boolean {
  const r = s.round!;
  if (s.rules.redealTwoNinesTalon && countNines(r.talon) >= 2) return true;
  if (s.rules.redealWeakTalon && handValue(r.talon) < s.rules.redealWeakTalonValue) return true;
  return false;
}

/** Снос: две карты, по одной каждому сопернику. */
export function aiChooseDiscard(s: GameState, me: number): { card: CardId; to: number }[] {
  const r = s.round!;
  const hand = [...r.hands[me]];
  const opponents = r.participants.filter((p) => p !== me);
  const trump = pickTrump(hand);

  const scored = hand.map((c) => ({ card: c, keep: keepScore(c, hand, trump) }));
  scored.sort((a, b) => a.keep - b.keep);

  const out: CardId[] = [];
  for (const it of scored) {
    if (out.length >= 2) break;
    // не разбиваем марьяж
    const s2 = suitOf(it.card);
    const rk = rankOf(it.card);
    if ((rk === 'K' || rk === 'Q') && marriageSuits(hand).includes(s2)) continue;
    out.push(it.card);
  }
  while (out.length < 2) {
    const extra = scored.find((x) => !out.includes(x.card));
    if (!extra) break;
    out.push(extra.card);
  }

  return [
    { card: out[0], to: opponents[0] },
    { card: out[1], to: opponents[1] },
  ];
}

function keepScore(card: CardId, hand: CardId[], trump: Suit): number {
  const s = suitOf(card);
  const r = rankOf(card);
  const isTrump = s === trump;
  const len = cardsOfSuit(hand, s).length;
  let v = RANK_VALUE[r] * 1.5;
  if (isTrump) v += 25;
  if (r === 'A') v += 30;
  if (r === 'T') v += 18;
  if ((r === 'K' || r === 'Q') && marriageSuits(hand).includes(s)) v += 60;
  // короткие масти лучше сносить целиком
  if (!isTrump && len <= 2) v -= 8;
  return v;
}

/** Окончательный заказ. */
export function aiChooseContract(s: GameState, me: number, rng: Rng): number {
  const r = s.round!;
  const hand = r.hands[me];
  const allowed = legalFinalContracts(r, hand, s.rules);
  if (allowed.length <= 1) return r.highestBid;

  const level = s.players[me].aiLevel;
  const est = estimatePoints(hand, false) + noise(rng, level) - safetyMargin(level);
  let target = Math.floor(est / 5) * 5;

  const p = s.players[me];
  if (p.onBarrel) {
    const need = minBarrelContract(s);
    if (est >= need - 25) target = Math.max(target, need);
  }

  const ok = allowed.filter((v) => v <= Math.max(target, r.highestBid));
  return ok.length > 0 ? ok[ok.length - 1] : r.highestBid;
}

export function aiDecideRospis(s: GameState, me: number): boolean {
  const r = s.round!;
  const hand = r.hands[me];
  const est = estimatePoints(hand, false);
  const gap = r.contract - est;
  if (s.rules.rospisNoDeduct) return gap > 30;
  return gap > 75;
}

// ------------------------------------------------------------ розыгрыш

interface PlayChoice {
  card: CardId;
  declare: 'marriage' | 'ace' | 'none';
}

/** Какие карты масти ещё не вышли и не у меня. */
function outstanding(k: Knowledge, suit: Suit): CardId[] {
  const seen = new Set([...k.hand, ...k.played, ...k.onTable]);
  return fullDeck().filter((c) => suitOf(c) === suit && !seen.has(c));
}

/** Является ли карта старшей из оставшихся в своей масти. */
function isTopOfSuit(k: Knowledge, card: CardId): boolean {
  const out = outstanding(k, suitOf(card));
  return out.every((c) => cardOrder(c) < cardOrder(card));
}

/** Сколько козырей ещё гуляет у соперников. */
function trumpsOutstanding(k: Knowledge): number {
  if (!k.trump) return 0;
  return outstanding(k, k.trump).length;
}

export function aiChooseCard(s: GameState, me: number, rng: Rng): PlayChoice {
  const r = s.round!;
  const k = buildKnowledge(s, me);
  const hand = r.hands[me];
  const legal = legalCards(hand, r, me, s.rules);
  const trick = r.currentTrick!;
  const level = s.players[me].aiLevel;

  if (trick.cards.length === 0) {
    return chooseLead(s, r, k, me, legal, level, rng);
  }
  return { card: chooseFollow(s, r, k, me, legal, level, rng), declare: 'none' };
}

function chooseLead(
  s: GameState,
  r: RoundState,
  k: Knowledge,
  me: number,
  legal: CardId[],
  level: AiLevel,
  rng: Rng,
): PlayChoice {
  const hand = k.hand;

  // 1. Тузовый марьяж — 200 очков
  if (s.rules.aceMarriage && hasAceMarriage(hand) && !r.marriages.some((m) => m.player === me && m.suit === null)) {
    if (s.rules.marriageFromFirstMove || (r.tricksWon[me] || 0) > 0) {
      const ace = legal.find((c) => rankOf(c) === 'A');
      if (ace) return { card: ace, declare: 'ace' };
    }
  }

  // 2. Обычный марьяж — объявляем самый дорогой из доступных
  const declarable = declarableMarriageSuits(hand, r, me, s.rules).filter((suit) =>
    legal.some((c) => suitOf(c) === suit && (rankOf(c) === 'K' || rankOf(c) === 'Q')),
  );
  if (declarable.length > 0) {
    const suit = declarable.reduce((a, b) => (MARRIAGE_VALUE[b] > MARRIAGE_VALUE[a] ? b : a));
    // новичок иногда «забывает» объявить
    if (!(level === 'novice' && rng.next() < 0.2)) {
      const king = legal.find((c) => c === 'K' + suit);
      const queen = legal.find((c) => c === 'Q' + suit);
      const card = king || queen!;
      return { card, declare: 'marriage' };
    }
  }

  // 3. Выбить козыри, если мы играющий и козырь наш
  const isCp = me === k.contractPlayer;
  if (k.trump && isCp && k.trumpOwner === me) {
    const myTrumps = legal.filter((c) => suitOf(c) === k.trump);
    const out = trumpsOutstanding(k);
    if (myTrumps.length >= 2 && out > 0) {
      const top = myTrumps.reduce((a, b) => (cardOrder(b) > cardOrder(a) ? b : a));
      if (isTopOfSuit(k, top) || level === 'novice') return { card: top, declare: 'none' };
    }
  }

  // 4. Верная взятка: старшая оставшаяся карта масти
  const sure = legal
    .filter((c) => isTopOfSuit(k, c))
    .filter((c) => k.trump === null || suitOf(c) === k.trump || trumpsOutstanding(k) === 0 || cardValue(c) >= 10)
    .sort((a, b) => cardValue(b) - cardValue(a));
  if (sure.length > 0 && !(level === 'novice' && rng.next() < 0.25)) {
    return { card: sure[0], declare: 'none' };
  }

  // 5. Иначе — младшая карта короткой некозырной масти
  const nonTrump = legal.filter((c) => k.trump === null || suitOf(c) !== k.trump);
  const pool = nonTrump.length > 0 ? nonTrump : legal;
  const sorted = [...pool].sort((a, b) => {
    const va = cardValue(a) + cardsOfSuit(k.hand, suitOf(a)).length * 2;
    const vb = cardValue(b) + cardsOfSuit(k.hand, suitOf(b)).length * 2;
    return va - vb;
  });
  return { card: sorted[0], declare: 'none' };
}

function chooseFollow(
  s: GameState,
  r: RoundState,
  k: Knowledge,
  me: number,
  legal: CardId[],
  level: AiLevel,
  rng: Rng,
): CardId {
  const trick = r.currentTrick!;
  const leadSuit = suitOf(trick.cards[0].card);
  let bestCard = trick.cards[0].card;
  let bestPlayer = trick.cards[0].player;
  for (const tc of trick.cards.slice(1)) {
    if (beats(tc.card, bestCard, leadSuit, k.trump)) {
      bestCard = tc.card;
      bestPlayer = tc.player;
    }
  }

  const trickValue = trick.cards.reduce((a, c) => a + cardValue(c.card), 0);
  const isLast = trick.cards.length === r.participants.length - 1;
  const cp = k.contractPlayer;
  const iAmDeclarer = me === cp;
  /** союзник — второй соперник играющего */
  const allyWinning = !iAmDeclarer && bestPlayer !== cp && bestPlayer !== me;

  const winners = legal.filter((c) => beats(c, bestCard, leadSuit, k.trump));
  const losers = legal.filter((c) => !winners.includes(c));

  const byValueAsc = (a: CardId, b: CardId) => cardValue(a) - cardValue(b) || cardOrder(a) - cardOrder(b);
  const byValueDesc = (a: CardId, b: CardId) => cardValue(b) - cardValue(a) || cardOrder(b) - cardOrder(a);

  // Новичок иногда играет случайно
  if (level === 'novice' && rng.next() < 0.18) {
    return legal[rng.int(legal.length)];
  }

  if (allyWinning && isLast) {
    // подкидываем союзнику очки
    const pool = losers.length > 0 ? losers : legal;
    return [...pool].sort(byValueDesc)[0];
  }

  if (winners.length > 0) {
    const gain = trickValue;
    const cheapest = [...winners].sort((a, b) => {
      // выигрываем самой дешёвой достаточной картой
      const ta = suitOf(a) === k.trump ? 1 : 0;
      const tb = suitOf(b) === k.trump ? 1 : 0;
      if (ta !== tb) return ta - tb;
      return cardOrder(a) - cardOrder(b);
    })[0];

    const worthIt =
      isLast ||
      gain >= 10 ||
      cardValue(cheapest) <= 4 ||
      iAmDeclarer ||
      isTopOfSuit(k, cheapest);

    if (worthIt) {
      if (!isLast && level === 'strong' && gain < 6 && cardValue(cheapest) >= 10 && losers.length > 0) {
        return [...losers].sort(byValueAsc)[0];
      }
      return cheapest;
    }
  }

  const pool = losers.length > 0 ? losers : legal;
  if (allyWinning) return [...pool].sort(byValueDesc)[0];
  return [...pool].sort(byValueAsc)[0];
}

// ------------------------------------------------------------ выбор действия

/** Действие бота в текущем состоянии игры. */
export function aiAct(s: GameState, rng: Rng): Action | null {
  const r = s.round;
  if (!r) return null;
  switch (s.phase) {
    case 'REDEAL_DECISION': {
      const p = s.pendingRedeal!;
      return aiDecideRedeal(s, p) ? { type: 'REDEAL' } : { type: 'NO_REDEAL' };
    }
    case 'TALON_REDEAL_DECISION':
      return aiDecideTalonRedeal(s) ? { type: 'TALON_REDEAL' } : { type: 'NO_REDEAL' };
    case 'DARK_GAME_DECISION':
      return aiDecideDark(s, r.mandatoryBidder, rng) ? { type: 'DECLARE_DARK' } : { type: 'SKIP_DARK' };
    case 'BIDDING':
      return { type: 'BID', value: aiChooseBid(s, r.currentBidder, rng) };
    case 'TALON_REVEAL':
      return { type: 'TALON_CONTINUE' };
    case 'DISCARDING': {
      const me = r.contractPlayer;
      if (aiDecideRospis(s, me) && canRospisSafe(s)) return { type: 'ROSPIS' };
      const picks = aiChooseDiscard(s, me);
      const done = Object.keys(r.discardedTo).map(Number);
      const pick = picks.find((x) => !done.includes(x.to) && r.hands[me].includes(x.card));
      if (!pick) {
        // страховка: отдаём первую доступную карту первому свободному сопернику
        const opp = r.participants.filter((p) => p !== me && r.discardedTo[p] === undefined)[0];
        return { type: 'DISCARD', card: r.hands[me][0], to: opp };
      }
      return { type: 'DISCARD', card: pick.card, to: pick.to };
    }
    case 'FINAL_CONTRACT':
      return { type: 'SET_CONTRACT', value: aiChooseContract(s, r.contractPlayer, rng) };
    case 'PLAYING_TRICK': {
      const me = currentPlayerToMove(s);
      if (me === null) return null;
      const choice = aiChooseCard(s, me, rng);
      return { type: 'PLAY', card: choice.card, declare: choice.declare };
    }
    default:
      return null;
  }
}

function canRospisSafe(s: GameState): boolean {
  // импорт по значению вызвал бы цикл; дублируем проверку договорённостей
  const r = s.round!;
  const rules = s.rules;
  if (rules.rospisLimit3 && s.players[r.contractPlayer].rospisCount >= 3) return false;
  if (!rules.rospisWhenBarrel && s.players.some((p) => p.onBarrel)) return false;
  if (!rules.rospisWhenGolden && r.golden) return false;
  if (!rules.rospisWhenDark && r.darkActive) return false;
  return true;
}

export { roundToFive };
