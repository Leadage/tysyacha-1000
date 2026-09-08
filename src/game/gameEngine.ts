import {
  CardId,
  Suit,
  cardName,
  cardValue,
  handValue,
  rankOf,
  suitOf,
} from './cards';
import { countNines, deal } from './deck';
import { Rng } from './rng';
import {
  BidEntry,
  GameEvent,
  GameState,
  PlayerState,
  Phase,
  RoundState,
  Trick,
  nextParticipant,
  participantsFor,
} from './gameState';
import { ACE_MARRIAGE_VALUE, MARRIAGE_VALUE, hasAceMarriage, marriageSuits } from './marriages';
import { BID_STEP, MIN_BID, canDeclareDark, legalBids, legalFinalContracts, maxBidFor, mustBeSilent } from './bidding';
import { canDeclareAceMarriage, canDeclareMarriage, legalCards, trickWinner } from './legalMoves';
import { finalizeRound, makeHistoryEntry } from './barrel';
import { RuleSettings, UiSettings, normalizeRules } from './settings';
import { minContractFromBarrel } from './scoring';

export type Action =
  | { type: 'START_ROUND' }
  | { type: 'REDEAL' }
  | { type: 'NO_REDEAL' }
  | { type: 'DECLARE_DARK' }
  | { type: 'SKIP_DARK' }
  | { type: 'BID'; value: number | null }
  | { type: 'TALON_CONTINUE' }
  | { type: 'TALON_REDEAL' }
  | { type: 'DISCARD'; card: CardId; to: number }
  | { type: 'SET_CONTRACT'; value: number }
  | { type: 'ROSPIS' }
  | { type: 'PLAY'; card: CardId; declare?: 'marriage' | 'ace' | 'none' }
  | { type: 'ADVANCE' };

export interface NewGameOptions {
  rules: RuleSettings;
  playerName: string;
  botNames: string[];
  seed?: number;
}

const TRICKS_IN_ROUND = 8;

export function createGame(opts: NewGameOptions): GameState {
  const rules = normalizeRules(opts.rules);
  const n = rules.playersCount;
  const players: PlayerState[] = [];
  players.push(makePlayer(0, opts.playerName || 'Игрок', true, rules.aiLevel));
  for (let i = 1; i < n; i++) {
    players.push(makePlayer(i, opts.botNames[i - 1] || `Бот ${i}`, false, rules.aiLevel));
  }
  const seed = opts.seed !== undefined ? opts.seed >>> 0 : (Math.random() * 0xffffffff) >>> 0;

  const state: GameState = {
    phase: 'SETUP',
    rules,
    rng: { seed },
    players,
    dealer: n - 1,
    roundNo: 0,
    round: null,
    history: [],
    winner: null,
    goldenCircle: rules.goldenEnabled,
    goldenRoundsPlayed: 0,
    goldenAnyMade: false,
    message: 'Новая партия',
    eventLog: [],
    lastRoundLog: [],
    lastTrick: null,
    lastTalon: [],
    pendingRedeal: null,
    redealAsked: [],
    seed,
  };
  return startRound(state);
}

function makePlayer(index: number, name: string, isHuman: boolean, aiLevel: RuleSettings['aiLevel']): PlayerState {
  return {
    index,
    name,
    isHuman,
    aiLevel,
    total: 0,
    onBarrel: false,
    barrelAttemptsUsed: 0,
    barrelsFailed: 0,
    boltsStreak: 0,
    boltsTotal: 0,
    boltsMarks: 0,
    rospisCount: 0,
    goldenPlayed: false,
  };
}

// ---------------------------------------------------------------- раздача

export function startRound(state: GameState): GameState {
  const s = clone(state);
  const rules = s.rules;
  const n = rules.playersCount;
  s.roundNo += 1;

  const golden = s.goldenCircle;
  let dealer: number;
  let goldenPlayer: number | null = null;

  if (golden) {
    goldenPlayer = s.goldenRoundsPlayed % n;
    dealer = n === 3 ? goldenPlayer : (goldenPlayer + n - 1) % n;
  } else {
    dealer = (s.dealer + 1) % n;
  }
  s.dealer = dealer;

  const { participants, sitter } = participantsFor(n, dealer);
  const rng = Rng.fromState(s.rng);
  const d = deal(rng);
  s.rng = rng.getState();

  const hands: Record<number, CardId[]> = {};
  participants.forEach((p, i) => {
    hands[p] = d.hands[i];
  });

  const mandatoryBidder = n === 3 ? dealer : participants[0];

  const round: RoundState = {
    no: s.roundNo,
    dealer,
    participants,
    talonSitter: sitter,
    hands,
    talon: d.talon,
    talonRevealed: false,
    mandatoryBidder,
    bids: [],
    currentBidder: mandatoryBidder,
    highestBid: MIN_BID,
    highestBidder: mandatoryBidder,
    passed: [],
    darkPlayer: null,
    darkActive: false,
    raisedAbove100: false,
    contractPlayer: mandatoryBidder,
    contract: MIN_BID,
    discardedTo: {},
    discardSelection: [],
    trump: null,
    trumpOwner: null,
    tricks: [],
    currentTrick: null,
    trickNo: 0,
    tricksWon: {},
    cardPoints: {},
    marriagePoints: {},
    marriages: [],
    rospis: false,
    golden,
    result: null,
    resultMarks: null,
    seenDiscard: {},
  };
  for (const p of participants) {
    round.tricksWon[p] = 0;
    round.cardPoints[p] = 0;
    round.marriagePoints[p] = 0;
    round.seenDiscard[p] = null;
  }

  if (golden && goldenPlayer !== null) {
    round.mandatoryBidder = goldenPlayer;
    round.currentBidder = goldenPlayer;
    round.highestBid = 120;
    round.highestBidder = goldenPlayer;
    round.contractPlayer = goldenPlayer;
    round.contract = 120;
  }

  s.round = round;
  s.phase = 'DEALING';
  s.eventLog = [
    {
      t: 'newRound',
      round: s.roundNo,
      dealer,
      hands: JSON.parse(JSON.stringify(hands)),
      talon: [...d.talon],
      talonSitter: sitter,
      golden,
    },
  ];
  s.pendingRedeal = null;
  s.redealAsked = [];
  s.message = golden ? 'Золотой кон' : 'Раздача';
  return afterDeal(s);
}

/** Кандидаты на пересдачу сразу после раздачи. */
function redealCandidatesAfterDeal(s: GameState): number[] {
  const r = s.round!;
  const res: number[] = [];
  for (const p of r.participants) {
    const h = r.hands[p];
    const low = s.rules.redealLowHand && handValue(h) < s.rules.redealLowHandValue;
    const nines = s.rules.redealFourNines && countNines(h) === 4;
    if (low || nines) res.push(p);
  }
  return res;
}

function afterDeal(state: GameState): GameState {
  const s = state;
  const cands = redealCandidatesAfterDeal(s);
  if (cands.length > 0) {
    s.phase = 'REDEAL_DECISION';
    s.pendingRedeal = cands[0];
    s.message = 'Возможна пересдача';
    return s;
  }
  return toDarkOrBidding(s);
}

function toDarkOrBidding(s: GameState): GameState {
  const r = s.round!;
  if (r.golden) {
    // торговля не проводится; при разрешении можно повысить заказ
    return openTalon(s);
  }
  if (canDeclareDark(r, r.mandatoryBidder, s.players, s.rules)) {
    s.phase = 'DARK_GAME_DECISION';
    r.currentBidder = r.mandatoryBidder;
    s.message = 'Игра втёмную?';
    return s;
  }
  return startBidding(s);
}

function startBidding(s: GameState): GameState {
  const r = s.round!;
  s.phase = 'BIDDING';
  r.bids = [{ player: r.mandatoryBidder, value: MIN_BID }];
  r.highestBid = MIN_BID;
  r.highestBidder = r.mandatoryBidder;
  r.passed = [];
  r.currentBidder = nextParticipant(r, r.mandatoryBidder);
  s.eventLog.push({ t: 'bid', player: r.mandatoryBidder, value: MIN_BID });
  s.message = 'Торговля';
  // игроки, обязанные молчать, пасуют автоматически
  return skipSilent(s);
}

function skipSilent(s: GameState): GameState {
  const r = s.round!;
  let guard = 0;
  while (guard++ < 12) {
    if (s.phase !== 'BIDDING') break;
    const cur = r.currentBidder;
    if (r.passed.includes(cur)) {
      r.currentBidder = nextParticipant(r, cur);
      continue;
    }
    if (mustBeSilent(s.players[cur], s.rules) && cur !== r.mandatoryBidder) {
      return applyBid(s, null);
    }
    break;
  }
  return s;
}

// ---------------------------------------------------------------- торговля

function applyBid(state: GameState, value: number | null): GameState {
  const s = state;
  const r = s.round!;
  const player = r.currentBidder;
  r.bids.push({ player, value });
  s.eventLog.push({ t: 'bid', player, value });

  if (value === null) {
    r.passed.push(player);
  } else {
    r.highestBid = value;
    r.highestBidder = player;
    if (player === r.mandatoryBidder) r.raisedAbove100 = true;
    if (r.darkPlayer !== null && player !== r.darkPlayer) {
      // тёмную перебили — объявивший получает право посмотреть карты
      r.darkActive = false;
      r.darkPlayer = null;
    }
  }

  const active = r.participants.filter((p) => !r.passed.includes(p));
  if (active.length <= 1) {
    const winnerBid = active.length === 1 ? active[0] : r.highestBidder;
    r.contractPlayer = winnerBid;
    r.contract = r.highestBid;
    if (r.darkPlayer === winnerBid) r.darkActive = true;
    return openTalon(s);
  }

  r.currentBidder = nextParticipant(r, player);
  let guard = 0;
  while (r.passed.includes(r.currentBidder) && guard++ < 10) {
    r.currentBidder = nextParticipant(r, r.currentBidder);
  }
  return skipSilent(s);
}

// ---------------------------------------------------------------- прикуп

function openTalon(state: GameState): GameState {
  const s = state;
  const r = s.round!;
  s.phase = 'TALON_REVEAL';

  const hideAt100 = s.rules.hideTalonAt100 && !r.raisedAbove100 && r.contract === MIN_BID;
  const hideDark = s.rules.hideTalonWhenDark && r.darkActive;
  r.talonRevealed = !hideAt100 && !hideDark;
  s.lastTalon = [...r.talon];
  s.eventLog.push({ t: 'talon', cards: [...r.talon], revealed: r.talonRevealed });
  s.message = `Прикуп — ${s.players[r.contractPlayer].name}, заказ ${r.contract}`;
  return s;
}

/** Взять прикуп в руку и перейти к сносу (или предложить пересдачу). */
function takeTalon(state: GameState): GameState {
  const s = state;
  const r = s.round!;
  const cp = r.contractPlayer;
  r.hands[cp] = [...r.hands[cp], ...r.talon];

  const onlyAt100Ok = !s.rules.redealOnlyAt100 || (!r.raisedAbove100 && r.contract === MIN_BID);
  const twoNines = s.rules.redealTwoNinesTalon && countNines(r.talon) >= 2;
  const weak = s.rules.redealWeakTalon && handValue(r.talon) < s.rules.redealWeakTalonValue;
  if (!r.golden && onlyAt100Ok && (twoNines || weak)) {
    s.phase = 'TALON_REDEAL_DECISION';
    s.pendingRedeal = cp;
    s.message = 'Слабый прикуп — пересдача?';
    return s;
  }
  return toDiscarding(s);
}

function toDiscarding(s: GameState): GameState {
  s.phase = 'DISCARDING';
  const r = s.round!;
  r.discardSelection = [];
  s.message = 'Выберите две карты для сноса';
  return s;
}

function applyDiscard(state: GameState, card: CardId, to: number): GameState {
  const s = state;
  const r = s.round!;
  const cp = r.contractPlayer;
  if (!r.hands[cp].includes(card)) return s;
  if (r.discardedTo[to] !== undefined) return s;
  if (to === cp || !r.participants.includes(to)) return s;

  r.hands[cp] = r.hands[cp].filter((c) => c !== card);
  r.hands[to] = [...r.hands[to], card];
  r.discardedTo[to] = card;
  r.seenDiscard[to] = card;
  s.eventLog.push({ t: 'discard', from: cp, to, card });

  const opponents = r.participants.filter((p) => p !== cp);
  if (opponents.every((p) => r.discardedTo[p] !== undefined)) {
    // проверка «пересдача при 4 девятках после сноса»
    if (s.rules.redealFourNinesAfterDiscard) {
      for (const o of opponents) {
        if (countNines(r.hands[o]) === 4) {
          s.phase = 'REDEAL_DECISION';
          s.pendingRedeal = o;
          s.message = 'Четыре девятки после сноса — пересдача?';
          return s;
        }
      }
    }
    return toFinalContract(s);
  }
  return s;
}

function toFinalContract(s: GameState): GameState {
  s.phase = 'FINAL_CONTRACT';
  s.message = 'Окончательный заказ';
  return s;
}

// ---------------------------------------------------------------- розыгрыш

function startPlaying(state: GameState): GameState {
  const s = state;
  const r = s.round!;
  s.phase = 'PLAYING_TRICK';
  r.trickNo = 1;
  r.currentTrick = { leader: r.contractPlayer, cards: [], winner: null };
  s.eventLog.push({ t: 'contract', player: r.contractPlayer, value: r.contract });
  s.message = 'Ход играющего';
  return s;
}

function applyPlay(
  state: GameState,
  card: CardId,
  declare: 'marriage' | 'ace' | 'none' | undefined,
): GameState {
  const s = state;
  const r = s.round!;
  const trick = r.currentTrick!;
  const player = currentPlayerToMove(s)!;
  const hand = r.hands[player];
  if (!hand.includes(card)) return s;
  const legal = legalCards(hand, r, player, s.rules);
  if (!legal.includes(card)) return s;

  let declaredSuit: Suit | null | undefined = undefined;

  if (declare === 'marriage') {
    const suit = canDeclareMarriage(hand, card, r, player, s.rules);
    if (suit) {
      r.marriages.push({ player, suit, value: MARRIAGE_VALUE[suit], trickNo: r.trickNo });
      r.marriagePoints[player] = (r.marriagePoints[player] || 0) + MARRIAGE_VALUE[suit];
      r.trump = suit;
      r.trumpOwner = player;
      declaredSuit = suit;
    }
  } else if (declare === 'ace') {
    if (canDeclareAceMarriage(hand, card, r, player, s.rules)) {
      r.marriages.push({ player, suit: null, value: ACE_MARRIAGE_VALUE, trickNo: r.trickNo });
      r.marriagePoints[player] = (r.marriagePoints[player] || 0) + ACE_MARRIAGE_VALUE;
      declaredSuit = null;
    }
  }

  r.hands[player] = hand.filter((c) => c !== card);
  trick.cards.push({ player, card });
  s.eventLog.push({ t: 'play', player, card, marriage: declaredSuit });

  if (trick.cards.length === r.participants.length) {
    const w = trickWinner(trick.cards, r.trump);
    trick.winner = w;
    r.tricksWon[w] = (r.tricksWon[w] || 0) + 1;
    let pts = 0;
    for (const tc of trick.cards) pts += cardValue(tc.card);
    r.cardPoints[w] = (r.cardPoints[w] || 0) + pts;
    r.tricks.push(trick);
    s.lastTrick = { ...trick, cards: [...trick.cards] };
    s.eventLog.push({ t: 'trick', winner: w, cards: [...trick.cards] });
    s.phase = 'TRICK_RESULT';
    s.message = `Взятку берёт ${s.players[w].name}`;
  } else {
    s.message = 'Ход';
  }
  return s;
}

function advanceAfterTrick(state: GameState): GameState {
  const s = state;
  const r = s.round!;
  const last = r.tricks[r.tricks.length - 1];
  if (r.trickNo >= TRICKS_IN_ROUND) {
    return scoreRound(s);
  }
  r.trickNo += 1;
  r.currentTrick = { leader: last.winner!, cards: [], winner: null };
  s.phase = 'PLAYING_TRICK';
  s.message = 'Ход';
  return s;
}

// ---------------------------------------------------------------- подсчёт

function scoreRound(state: GameState): GameState {
  const s = state;
  const r = s.round!;
  s.phase = 'ROUND_SCORING';
  const outcome = finalizeRound(s);
  r.result = outcome.delta;
  r.resultMarks = outcome.marks;
  s.history.push(makeHistoryEntry(s, outcome));
  s.eventLog.push({ t: 'score', delta: outcome.delta, totals: outcome.totals, marks: outcome.marks });
  s.lastRoundLog = [...s.eventLog];

  if (r.golden) {
    s.goldenRoundsPlayed += 1;
    s.players[r.contractPlayer].goldenPlayed = true;
    if (outcome.contractMade) s.goldenAnyMade = true;
    if (s.goldenRoundsPlayed >= s.rules.playersCount) {
      if (!s.goldenAnyMade && s.rules.goldenResetIfNobody) {
        for (const p of s.players) {
          p.total = 0;
          p.onBarrel = false;
          p.barrelAttemptsUsed = 0;
        }
        s.goldenRoundsPlayed = 0;
        s.goldenAnyMade = false;
        s.message = 'Никто не взял золотой — очки обнулены';
      } else {
        s.goldenCircle = false;
      }
    }
  }

  if (outcome.winner !== null) {
    s.winner = outcome.winner;
    s.phase = 'GAME_OVER';
    s.eventLog.push({ t: 'gameOver', winner: outcome.winner });
    s.message = `Победил ${s.players[outcome.winner].name}!`;
  } else {
    s.phase = 'ROUND_END';
    s.message = 'Кон окончен';
  }
  return s;
}

// ---------------------------------------------------------------- роспись

function applyRospis(state: GameState): GameState {
  const s = state;
  const r = s.round!;
  r.rospis = true;
  s.eventLog.push({ t: 'rospis', player: r.contractPlayer });
  return scoreRound(s);
}

export function canRospis(s: GameState): boolean {
  const r = s.round;
  if (!r) return false;
  if (s.phase !== 'DISCARDING' && s.phase !== 'FINAL_CONTRACT') return false;
  const rules = s.rules;
  if (rules.rospisLimit3 && s.players[r.contractPlayer].rospisCount >= 3) return false;
  if (!rules.rospisWhenBarrel && s.players.some((p) => p.onBarrel)) return false;
  if (!rules.rospisWhenGolden && r.golden) return false;
  if (!rules.rospisWhenDark && r.darkActive) return false;
  return true;
}

// ---------------------------------------------------------------- пересдача

function doRedeal(state: GameState): GameState {
  const s = clone(state);
  s.roundNo -= 1;
  s.dealer = (s.dealer + s.rules.playersCount - 1) % s.rules.playersCount;
  if (s.goldenCircle) {
    // золотой кон переигрывается тем же игроком
  }
  return startRound(s);
}

// ---------------------------------------------------------------- reducer

export function applyAction(state: GameState, action: Action): GameState {
  const s = clone(state);
  switch (action.type) {
    case 'START_ROUND':
      return startRound(s);

    case 'REDEAL': {
      if (s.phase !== 'REDEAL_DECISION' && s.phase !== 'TALON_REDEAL_DECISION') return state;
      s.eventLog.push({ t: 'redeal', player: s.pendingRedeal ?? 0, reason: 'request' });
      return doRedeal(s);
    }

    case 'NO_REDEAL': {
      if (s.phase === 'TALON_REDEAL_DECISION') {
        s.pendingRedeal = null;
        return toDiscarding(s);
      }
      if (s.phase !== 'REDEAL_DECISION') return state;
      const r = s.round!;
      if (s.pendingRedeal !== null && !s.redealAsked.includes(s.pendingRedeal)) {
        s.redealAsked.push(s.pendingRedeal);
      }
      // проверка после сноса — идём к заказу
      if (Object.keys(r.discardedTo).length >= 2) {
        s.pendingRedeal = null;
        const more = r.participants.find(
          (p) =>
            p !== r.contractPlayer &&
            !s.redealAsked.includes(p) &&
            countNines(r.hands[p]) === 4,
        );
        if (more !== undefined) {
          s.pendingRedeal = more;
          return s;
        }
        return toFinalContract(s);
      }
      const next = redealCandidatesAfterDeal(s).find((p) => !s.redealAsked.includes(p));
      if (next !== undefined) {
        s.pendingRedeal = next;
        return s;
      }
      s.pendingRedeal = null;
      return toDarkOrBidding(s);
    }

    case 'DECLARE_DARK': {
      if (s.phase !== 'DARK_GAME_DECISION') return state;
      const r = s.round!;
      r.darkPlayer = r.mandatoryBidder;
      r.darkActive = true;
      s.eventLog.push({ t: 'dark', player: r.mandatoryBidder });
      s.phase = 'BIDDING';
      r.bids = [{ player: r.mandatoryBidder, value: 120, dark: true }];
      r.highestBid = 120;
      r.highestBidder = r.mandatoryBidder;
      r.raisedAbove100 = true;
      r.passed = [];
      r.currentBidder = nextParticipant(r, r.mandatoryBidder);
      s.eventLog.push({ t: 'bid', player: r.mandatoryBidder, value: 120 });
      s.message = 'Втёмную 120';
      return skipSilent(s);
    }

    case 'SKIP_DARK': {
      if (s.phase !== 'DARK_GAME_DECISION') return state;
      return startBidding(s);
    }

    case 'BID': {
      if (s.phase !== 'BIDDING') return state;
      const r = s.round!;
      if (action.value !== null) {
        const allowed = legalBids(r, r.currentBidder, r.hands[r.currentBidder], s.players, s.rules);
        if (!allowed.includes(action.value)) return state;
      }
      return applyBid(s, action.value);
    }

    case 'TALON_CONTINUE': {
      if (s.phase !== 'TALON_REVEAL') return state;
      return takeTalon(s);
    }

    case 'TALON_REDEAL': {
      if (s.phase !== 'TALON_REDEAL_DECISION') return state;
      s.eventLog.push({ t: 'redeal', player: s.round!.contractPlayer, reason: 'talon' });
      return doRedeal(s);
    }

    case 'DISCARD': {
      if (s.phase !== 'DISCARDING') return state;
      return applyDiscard(s, action.card, action.to);
    }

    case 'SET_CONTRACT': {
      if (s.phase !== 'FINAL_CONTRACT') return state;
      const r = s.round!;
      const allowed = legalFinalContracts(r, r.hands[r.contractPlayer], s.rules);
      if (!allowed.includes(action.value)) return state;
      r.contract = action.value;
      return startPlaying(s);
    }

    case 'ROSPIS': {
      if (!canRospis(s)) return state;
      return applyRospis(s);
    }

    case 'PLAY': {
      if (s.phase !== 'PLAYING_TRICK') return state;
      return applyPlay(s, action.card, action.declare);
    }

    case 'ADVANCE': {
      if (s.phase === 'TRICK_RESULT') return advanceAfterTrick(s);
      if (s.phase === 'ROUND_END') return startRound(s);
      if (s.phase === 'TALON_REVEAL') return takeTalon(s);
      return state;
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------- запросы

/** Чей сейчас ход в розыгрыше. */
export function currentPlayerToMove(s: GameState): number | null {
  const r = s.round;
  if (!r || !r.currentTrick) return null;
  if (s.phase !== 'PLAYING_TRICK') return null;
  const t = r.currentTrick;
  if (t.cards.length === 0) return t.leader;
  let p = t.leader;
  for (let i = 0; i < t.cards.length; i++) p = nextParticipant(r, p);
  return p;
}

/** Кто должен сейчас принять решение (или null — ждём кнопки «Дальше»). */
export function currentActor(s: GameState): number | null {
  const r = s.round;
  if (!r) return null;
  switch (s.phase) {
    case 'REDEAL_DECISION':
    case 'TALON_REDEAL_DECISION':
      return s.pendingRedeal;
    case 'DARK_GAME_DECISION':
      return r.mandatoryBidder;
    case 'BIDDING':
      return r.currentBidder;
    case 'DISCARDING':
    case 'FINAL_CONTRACT':
      return r.contractPlayer;
    case 'PLAYING_TRICK':
      return currentPlayerToMove(s);
    default:
      return null;
  }
}

export function isHumanTurn(s: GameState): boolean {
  const a = currentActor(s);
  return a !== null && s.players[a].isHuman;
}

/** Карты, которыми игрок может сейчас пойти. */
export function playableCards(s: GameState, player: number): CardId[] {
  const r = s.round;
  if (!r || s.phase !== 'PLAYING_TRICK') return [];
  if (currentPlayerToMove(s) !== player) return [];
  return legalCards(r.hands[player], r, player, s.rules);
}

export function contractPlayerHand(s: GameState): CardId[] {
  const r = s.round;
  if (!r) return [];
  return r.hands[r.contractPlayer] || [];
}

export function minBarrelContract(s: GameState): number {
  return minContractFromBarrel(s.rules.barrelScore, s.rules.winMoreThan1000);
}

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export { MIN_BID, BID_STEP, TRICKS_IN_ROUND, maxBidFor, legalBids, legalFinalContracts, canDeclareDark };
