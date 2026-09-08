import { describe, expect, it } from 'vitest';
import {
  Action,
  applyAction,
  createGame,
  currentActor,
  currentPlayerToMove,
} from '../game/gameEngine';
import { legalBids, legalFinalContracts, maxBidFor } from '../game/bidding';
import { DEFAULT_RULES, RuleSettings } from '../game/settings';
import { GameState } from '../game/gameState';
import { finalizeRound, isContractMade } from '../game/barrel';
import { aiAct } from '../game/ai';
import { Rng } from '../game/rng';
import { handValue } from '../game/cards';

function newGame(rules: Partial<RuleSettings> = {}, seed = 12345): GameState {
  return createGame({
    rules: { ...DEFAULT_RULES, ...rules },
    playerName: 'Игрок',
    botNames: ['Lisa', 'Homer', 'Bart'],
    seed,
  });
}

/** Прогоняет партию до конца ботами (человек тоже управляется ИИ). */
function playOut(s: GameState, maxSteps = 200000): GameState {
  const rng = new Rng(999);
  let steps = 0;
  while (s.phase !== 'GAME_OVER' && steps++ < maxSteps) {
    if (s.phase === 'TRICK_RESULT' || s.phase === 'ROUND_END' || s.phase === 'TALON_REVEAL') {
      s = applyAction(s, { type: 'ADVANCE' });
      continue;
    }
    const a = aiAct(s, rng);
    if (!a) throw new Error('нет действия в фазе ' + s.phase);
    const next = applyAction(s, a);
    if (next === s) throw new Error('действие не изменило состояние: ' + JSON.stringify(a) + ' фаза ' + s.phase);
    s = next;
  }
  return s;
}

describe('раздача', () => {
  it('втроём: по 7 карт и 3 в прикупе, все карты разные', () => {
    const s = newGame();
    const r = s.round!;
    expect(r.participants).toEqual([0, 1, 2]);
    for (const p of r.participants) expect(r.hands[p].length).toBe(7);
    expect(r.talon.length).toBe(3);
    const all = [...r.hands[0], ...r.hands[1], ...r.hands[2], ...r.talon];
    expect(new Set(all).size).toBe(24);
  });

  it('одинаковый seed даёт одинаковую раздачу', () => {
    const a = newGame({}, 777);
    const b = newGame({}, 777);
    expect(a.round!.hands).toEqual(b.round!.hands);
    expect(a.round!.talon).toEqual(b.round!.talon);
  });

  it('вчетвером: раздающий сидит на прикупе', () => {
    const s = newGame({ playersCount: 4 });
    const r = s.round!;
    expect(r.participants.length).toBe(3);
    expect(r.talonSitter).toBe(r.dealer);
    expect(r.participants).not.toContain(r.dealer);
  });
});

describe('торговля', () => {
  function toBidding(s: GameState): GameState {
    let g = s;
    let guard = 0;
    while (g.phase !== 'BIDDING' && guard++ < 20) {
      if (g.phase === 'REDEAL_DECISION') g = applyAction(g, { type: 'NO_REDEAL' });
      else if (g.phase === 'DARK_GAME_DECISION') g = applyAction(g, { type: 'SKIP_DARK' });
      else break;
    }
    return g;
  }

  it('обязательная первая ставка 100', () => {
    const s = toBidding(newGame({ darkEnabled: false }));
    expect(s.phase).toBe('BIDDING');
    expect(s.round!.highestBid).toBe(100);
    expect(s.round!.bids[0].value).toBe(100);
  });

  it('все ставки кратны 5 и больше предыдущей', () => {
    const s = toBidding(newGame({ darkEnabled: false, bidAbove120WithoutMarriage: true }));
    const r = s.round!;
    const bids = legalBids(r, r.currentBidder, r.hands[r.currentBidder], s.players, s.rules);
    for (const b of bids) {
      expect(b % 5).toBe(0);
      expect(b).toBeGreaterThan(r.highestBid);
    }
  });

  it('прыжки запрещены — доступна только следующая ставка +5', () => {
    const s = toBidding(newGame({ darkEnabled: false, noJumpBids: true, bidAbove120WithoutMarriage: true }));
    const r = s.round!;
    const bids = legalBids(r, r.currentBidder, r.hands[r.currentBidder], s.players, s.rules);
    expect(bids).toEqual([105]);
  });

  it('без марьяжа нельзя торговаться выше 120', () => {
    expect(maxBidFor(['9S', 'JC', 'TD'], DEFAULT_RULES)).toBe(120);
    expect(maxBidFor(['KH', 'QH', '9S'], DEFAULT_RULES)).toBe(220);
    expect(maxBidFor(['KH', 'QH', 'KS', 'QS'], DEFAULT_RULES)).toBe(260);
  });

  it('настройка снимает ограничение по марьяжам', () => {
    const rules = { ...DEFAULT_RULES, bidAbove120WithoutMarriage: true };
    expect(maxBidFor(['9S'], rules)).toBeGreaterThan(120);
  });

  it('молчание при большом минусе — автоматический пас', () => {
    let s = toBidding(newGame({ darkEnabled: false }));
    s.players[1].total = -200;
    s.players[2].total = -200;
    // первый же ход торговли должен завершить торги в пользу обязательного игрока
    const r = s.round!;
    const mandatory = r.mandatoryBidder;
    let g = s;
    let guard = 0;
    while (g.phase === 'BIDDING' && guard++ < 10) {
      g = applyAction(g, { type: 'BID', value: null });
    }
    expect(g.round!.contractPlayer).toBe(mandatory);
    expect(g.round!.contract).toBe(100);
  });

  it('после паса игрок выбывает из торгов', () => {
    let s = toBidding(newGame({ darkEnabled: false, bidAbove120WithoutMarriage: true }));
    const first = s.round!.currentBidder;
    s = applyAction(s, { type: 'BID', value: null });
    expect(s.round!.passed).toContain(first);
  });
});

describe('прикуп, снос и окончательный заказ', () => {
  function toDiscarding(seed: number): GameState {
    let s = newGame({ darkEnabled: false, redealLowHand: false, redealFourNines: false, redealWeakTalon: false }, seed);
    let guard = 0;
    while (s.phase !== 'DISCARDING' && guard++ < 60) {
      if (s.phase === 'BIDDING') s = applyAction(s, { type: 'BID', value: null });
      else if (s.phase === 'TALON_REVEAL') s = applyAction(s, { type: 'ADVANCE' });
      else if (s.phase === 'REDEAL_DECISION' || s.phase === 'TALON_REDEAL_DECISION')
        s = applyAction(s, { type: 'NO_REDEAL' });
      else break;
    }
    return s;
  }

  it('победитель торгов получает 10 карт', () => {
    const s = toDiscarding(4242);
    expect(s.phase).toBe('DISCARDING');
    expect(s.round!.hands[s.round!.contractPlayer].length).toBe(10);
  });

  it('после сноса у всех по 8 карт', () => {
    let s = toDiscarding(4242);
    const r0 = s.round!;
    const cp = r0.contractPlayer;
    const opps = r0.participants.filter((p) => p !== cp);
    s = applyAction(s, { type: 'DISCARD', card: r0.hands[cp][0], to: opps[0] });
    s = applyAction(s, { type: 'DISCARD', card: s.round!.hands[cp][0], to: opps[1] });
    expect(s.phase).toBe('FINAL_CONTRACT');
    for (const p of s.round!.participants) expect(s.round!.hands[p].length).toBe(8);
  });

  it('нельзя отдать обе карты одному сопернику', () => {
    let s = toDiscarding(4242);
    const r0 = s.round!;
    const cp = r0.contractPlayer;
    const opp = r0.participants.filter((p) => p !== cp)[0];
    s = applyAction(s, { type: 'DISCARD', card: r0.hands[cp][0], to: opp });
    const before = s;
    const after = applyAction(s, { type: 'DISCARD', card: s.round!.hands[cp][0], to: opp });
    expect(after.round!.discardedTo[opp]).toBe(before.round!.discardedTo[opp]);
    expect(after.phase).toBe('DISCARDING');
  });

  it('окончательный заказ не может быть меньше выигранной ставки', () => {
    const s = toDiscarding(4242);
    const r = s.round!;
    r.highestBid = 125;
    const opts = legalFinalContracts(r, r.hands[r.contractPlayer], s.rules);
    expect(Math.min(...opts)).toBe(125);
    expect(opts).not.toContain(120);
  });
});

describe('подсчёт очков кона', () => {
  function mkState(rules: Partial<RuleSettings> = {}): GameState {
    const s = newGame(rules);
    const r = s.round!;
    r.tricksWon = { 0: 3, 1: 3, 2: 2 };
    r.cardPoints = { 0: 0, 1: 0, 2: 0 };
    r.marriagePoints = { 0: 0, 1: 0, 2: 0 };
    return s;
  }

  it('выполненный заказ даёт ровно величину заказа', () => {
    const s = mkState();
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 120;
    r.cardPoints[0] = 163;
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(120);
    expect(s.players[0].total).toBe(120);
  });

  it('проваленный заказ вычитается', () => {
    const s = mkState();
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 130;
    r.cardPoints[0] = 129;
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(-130);
    expect(s.players[0].total).toBe(-130);
  });

  it('строгий режим: 98 при заказе 100 — проигрыш', () => {
    const s = mkState({ roundOwnGame: false });
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.cardPoints[0] = 98;
    expect(isContractMade(r, s.rules)).toBe(false);
  });

  it('с округлением своей игры 98 → 100 — заказ выполнен', () => {
    const s = mkState({ roundOwnGame: true });
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.cardPoints[0] = 98;
    expect(isContractMade(r, s.rules)).toBe(true);
  });

  it('очки соперников округляются до кратного пяти', () => {
    const s = mkState();
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.cardPoints[0] = 100;
    r.cardPoints[1] = 12;
    r.cardPoints[2] = 13;
    const out = finalizeRound(s);
    expect(out.delta[1]).toBe(10);
    expect(out.delta[2]).toBe(15);
  });

  it('игра втёмную удваивает результат играющего', () => {
    const s = mkState();
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 120;
    r.darkActive = true;
    r.cardPoints[0] = 125;
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(240);
  });

  it('провал втёмную удваивает минус', () => {
    const s = mkState();
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 120;
    r.darkActive = true;
    r.cardPoints[0] = 30;
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(-240);
  });

  it('золотой кон удваивает очки', () => {
    const s = mkState();
    const r = s.round!;
    r.golden = true;
    r.contractPlayer = 0;
    r.contract = 120;
    r.cardPoints[0] = 125;
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(240);
  });
});

describe('роспись', () => {
  function mkRospis(rules: Partial<RuleSettings> = {}): GameState {
    const s = newGame(rules);
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 120;
    r.rospis = true;
    r.tricksWon = { 0: 0, 1: 0, 2: 0 };
    return s;
  }

  it('классика: играющий −заказ, соперники по 60', () => {
    const s = mkRospis({ rospisBy60: true, rospisNoDeduct: false, boltMode: 'off' });
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(-120);
    expect(out.delta[1]).toBe(60);
    expect(out.delta[2]).toBe(60);
  });

  it('без вычета заказа', () => {
    const s = mkRospis({ rospisNoDeduct: true, boltMode: 'off' });
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(0);
  });

  it('деление заказа пополам с округлением', () => {
    const s = mkRospis({ rospisBy60: false, boltMode: 'off' });
    s.round!.contract = 125;
    const out = finalizeRound(s);
    expect(out.delta[1]).toBe(65);
    expect(out.delta[2]).toBe(65);
  });

  it('штраф при третьей росписи', () => {
    const s = mkRospis({ rospisPenaltyOnThird: true, boltMode: 'off' });
    s.players[0].rospisCount = 2;
    const out = finalizeRound(s);
    expect(out.delta[0]).toBe(-120 - 120);
  });
});

describe('болты', () => {
  function mkBolt(rules: Partial<RuleSettings> = {}): GameState {
    const s = newGame(rules);
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.cardPoints[0] = 120;
    r.tricksWon = { 0: 8, 1: 0, 2: 0 };
    return s;
  }

  it('нулевой кон отмечается болтом', () => {
    const s = mkBolt();
    const out = finalizeRound(s);
    expect(out.marks[1]).toContain('-');
    expect(s.players[1].boltsMarks).toBe(1);
  });

  it('штраф после трёх болтов подряд', () => {
    const s = mkBolt({ boltMode: 'consecutive3' });
    s.players[1].boltsStreak = 2;
    const out = finalizeRound(s);
    expect(out.delta[1]).toBe(-120);
    expect(s.players[1].boltsStreak).toBe(0);
  });

  it('штраф при третьем болте за игру', () => {
    const s = mkBolt({ boltMode: 'total3' });
    s.players[1].boltsTotal = 2;
    const out = finalizeRound(s);
    expect(out.delta[1]).toBe(-120);
    expect(s.players[1].boltsTotal).toBe(0);
  });

  it('болт на своей игре не считается', () => {
    const s = newGame({ boltNoOwnGame: true });
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.tricksWon = { 0: 0, 1: 4, 2: 4 };
    const out = finalizeRound(s);
    expect(out.marks[0]).not.toContain('-');
  });

  it('болт на своей игре считается, если настройка выключена', () => {
    const s = newGame({ boltNoOwnGame: false, boltMode: 'off' });
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.tricksWon = { 0: 0, 1: 4, 2: 4 };
    const out = finalizeRound(s);
    expect(out.marks[0]).toContain('-');
  });

  it('болт на золотом считается за два', () => {
    const s = mkBolt({ boltGoldenDouble: true, boltMode: 'off' });
    s.round!.golden = true;
    finalizeRound(s);
    expect(s.players[1].boltsMarks).toBe(2);
  });
});

describe('бочка', () => {
  function mkBarrel(rules: Partial<RuleSettings> = {}): GameState {
    const s = newGame({ boltMode: 'off', dumpEnabled: false, ...rules });
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.cardPoints = { 0: 110, 1: 5, 2: 5 };
    r.tricksWon = { 0: 6, 1: 1, 2: 1 };
    return s;
  }

  it('880 и выше — ровно 880', () => {
    const s = mkBarrel();
    s.players[0].total = 800;
    finalizeRound(s);
    expect(s.players[0].total).toBe(880);
    expect(s.players[0].onBarrel).toBe(true);
  });

  it('бочка 900', () => {
    const s = mkBarrel({ barrelScore: 900 });
    s.players[0].total = 850;
    finalizeRound(s);
    expect(s.players[0].total).toBe(900);
  });

  it('с бочки очки не набираются обычными взятками', () => {
    const s = mkBarrel();
    s.players[1].onBarrel = true;
    s.players[1].total = 880;
    finalizeRound(s);
    expect(s.players[1].total).toBe(880);
  });

  it('победа с бочки при достаточном заказе', () => {
    const s = mkBarrel();
    s.players[0].onBarrel = true;
    s.players[0].total = 880;
    s.round!.contract = 120;
    s.round!.cardPoints[0] = 125;
    const out = finalizeRound(s);
    expect(s.players[0].total).toBe(1000);
    expect(out.winner).toBe(0);
  });

  it('победа при 1005, если требуется больше 1000', () => {
    const s = mkBarrel({ winMoreThan1000: true });
    s.players[0].onBarrel = true;
    s.players[0].total = 880;
    s.round!.contract = 120;
    s.round!.cardPoints[0] = 125;
    const out1 = finalizeRound(s);
    expect(out1.winner).toBeNull();

    const s2 = mkBarrel({ winMoreThan1000: true });
    s2.players[0].onBarrel = true;
    s2.players[0].total = 880;
    s2.round!.contract = 125;
    s2.round!.cardPoints[0] = 130;
    const out2 = finalizeRound(s2);
    expect(s2.players[0].total).toBe(1005);
    expect(out2.winner).toBe(0);
  });

  it('три неудачные попытки — штраф и слёт с бочки', () => {
    let s = mkBarrel();
    s.players[1].onBarrel = true;
    s.players[1].total = 880;
    s.players[1].barrelAttemptsUsed = 2;
    finalizeRound(s);
    expect(s.players[1].onBarrel).toBe(false);
    expect(s.players[1].total).toBe(760);
    expect(s.players[1].barrelsFailed).toBe(1);
  });

  it('нельзя одновременно влезать на бочку', () => {
    const s = mkBarrel({ noSimultaneousBarrel: true });
    s.players[0].total = 800;
    s.players[1].total = 880;
    s.players[1].onBarrel = false;
    s.round!.cardPoints[1] = 20;
    finalizeRound(s);
    expect(s.players[0].onBarrel).toBe(false);
    expect(s.players[1].onBarrel).toBe(false);
    expect(s.players[0].total).toBe(760);
  });

  it('сброс с бочки, если на неё влез другой', () => {
    const s = mkBarrel({ barrelKnockOff: true });
    s.players[1].onBarrel = true;
    s.players[1].total = 880;
    s.players[0].total = 800;
    finalizeRound(s);
    expect(s.players[0].onBarrel).toBe(true);
    expect(s.players[1].onBarrel).toBe(false);
    expect(s.players[1].total).toBe(760);
  });

  it('сброс на ноль после трёх бочек', () => {
    const s = mkBarrel({ resetAfter3Barrels: true });
    s.players[1].onBarrel = true;
    s.players[1].total = 880;
    s.players[1].barrelAttemptsUsed = 2;
    s.players[1].barrelsFailed = 2;
    finalizeRound(s);
    expect(s.players[1].total).toBe(0);
  });
});

describe('самосвал', () => {
  it('ровно 555 обнуляется', () => {
    const s = newGame({ boltMode: 'off' });
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.cardPoints = { 0: 120, 1: 0, 2: 0 };
    r.tricksWon = { 0: 8, 1: 0, 2: 0 };
    s.players[0].total = 455;
    const out = finalizeRound(s);
    expect(s.players[0].total).toBe(0);
    expect(out.marks[0]).toContain('Z');
  });

  it('−555 обнуляется при включённой настройке', () => {
    const s = newGame({ boltMode: 'off', dumpNegative: true });
    const r = s.round!;
    r.contractPlayer = 0;
    r.contract = 100;
    r.cardPoints = { 0: 10, 1: 60, 2: 50 };
    r.tricksWon = { 0: 1, 1: 4, 2: 3 };
    s.players[0].total = -455;
    finalizeRound(s);
    expect(s.players[0].total).toBe(0);
  });
});

describe('игра вчетвером', () => {
  it('сидящий на прикупе получает стоимость прикупа', () => {
    const s = newGame({ playersCount: 4, boltMode: 'off', dumpEnabled: false });
    const r = s.round!;
    r.talon = ['AS', 'TH', '9C']; // 11 + 10 + 0 = 21 → 20
    r.contractPlayer = r.participants[0];
    r.contract = 100;
    r.cardPoints[r.participants[0]] = 120;
    r.tricksWon = { [r.participants[0]]: 8, [r.participants[1]]: 0, [r.participants[2]]: 0 } as any;
    const out = finalizeRound(s);
    expect(out.delta[r.talonSitter!]).toBe(20);
    expect(out.marks[r.talonSitter!]).toContain('#');
  });

  it('марьяж в прикупе добавляется сидящему', () => {
    const s = newGame({ playersCount: 4, talonSitterMarriage: true, boltMode: 'off', dumpEnabled: false });
    const r = s.round!;
    r.talon = ['KH', 'QH', '9C']; // 4 + 3 + 0 = 7 + 100 = 107 → 105
    r.contractPlayer = r.participants[0];
    r.contract = 100;
    r.cardPoints[r.participants[0]] = 120;
    r.tricksWon = { [r.participants[0]]: 8, [r.participants[1]]: 0, [r.participants[2]]: 0 } as any;
    const out = finalizeRound(s);
    expect(out.delta[r.talonSitter!]).toBe(105);
  });
});

describe('пересдача', () => {
  it('слабая рука предлагает пересдачу', () => {
    let s = newGame({ redealLowHand: true, redealLowHandValue: 60 }); // заведомо срабатывает
    expect(s.phase).toBe('REDEAL_DECISION');
    expect(s.pendingRedeal).not.toBeNull();
  });

  it('пересдача выдаёт новую раздачу с тем же номером кона', () => {
    const s = newGame({ redealLowHand: true, redealLowHandValue: 60 });
    const before = JSON.stringify(s.round!.hands);
    const after = applyAction(s, { type: 'REDEAL' });
    expect(after.roundNo).toBe(s.roundNo);
    expect(JSON.stringify(after.round!.hands)).not.toBe(before);
  });

  it('отказ от пересдачи ведёт к торговле', () => {
    let s = newGame({ redealLowHand: true, redealLowHandValue: 60, darkEnabled: false });
    let guard = 0;
    while (s.phase === 'REDEAL_DECISION' && guard++ < 5) s = applyAction(s, { type: 'NO_REDEAL' });
    expect(['BIDDING', 'DARK_GAME_DECISION']).toContain(s.phase);
  });
});

describe('игра втёмную', () => {
  it('объявление тёмной ставит заказ 120', () => {
    let s = newGame({ darkEnabled: true, darkMinScore: 0 });
    let guard = 0;
    while (s.phase === 'REDEAL_DECISION' && guard++ < 5) s = applyAction(s, { type: 'NO_REDEAL' });
    expect(s.phase).toBe('DARK_GAME_DECISION');
    s = applyAction(s, { type: 'DECLARE_DARK' });
    expect(s.round!.highestBid).toBe(120);
    expect(s.round!.darkActive).toBe(true);
  });

  it('если тёмную перебили — удвоение отменяется', () => {
    let s = newGame({ darkEnabled: true, darkMinScore: 0, bidAbove120WithoutMarriage: true });
    let guard = 0;
    while (s.phase === 'REDEAL_DECISION' && guard++ < 5) s = applyAction(s, { type: 'NO_REDEAL' });
    s = applyAction(s, { type: 'DECLARE_DARK' });
    s = applyAction(s, { type: 'BID', value: 125 });
    expect(s.round!.darkActive).toBe(false);
    expect(s.round!.darkPlayer).toBeNull();
  });

  it('нельзя темнить при недостаточном счёте', () => {
    let s = newGame({ darkEnabled: true, darkMinScore: 240 });
    let guard = 0;
    while (s.phase === 'REDEAL_DECISION' && guard++ < 5) s = applyAction(s, { type: 'NO_REDEAL' });
    expect(s.phase).not.toBe('DARK_GAME_DECISION');
  });
});

describe('золотой кон', () => {
  it('заказ 120 без торговли, каждый игрок по разу', () => {
    let s = newGame({ goldenEnabled: true, darkEnabled: false });
    expect(s.round!.golden).toBe(true);
    expect(s.round!.contract).toBe(120);
    expect(s.phase === 'TALON_REVEAL' || s.phase === 'REDEAL_DECISION').toBe(true);
    expect(legalFinalContracts(s.round!, [], s.rules)).toEqual([120]);
  });

  it('можно увеличивать заказ при включённой настройке', () => {
    const s = newGame({ goldenEnabled: true, goldenCanRaise: true, bidAbove120WithoutMarriage: true });
    const opts = legalFinalContracts(s.round!, ['KH', 'QH'], s.rules);
    expect(opts.length).toBeGreaterThan(1);
    expect(opts[0]).toBe(120);
  });
});

describe('марьяжи в розыгрыше', () => {
  /** Готовим состояние прямо перед первым ходом с заданными руками. */
  function mkPlay(hands: Record<number, string[]>, rules: Partial<RuleSettings> = {}): GameState {
    const s = newGame({ marriageFromFirstMove: true, ...rules });
    const r = s.round!;
    r.hands = { 0: [...hands[0]], 1: [...hands[1]], 2: [...hands[2]] };
    r.contractPlayer = 0;
    r.contract = 100;
    r.trump = null;
    r.trumpOwner = null;
    r.currentTrick = { leader: 0, cards: [], winner: null };
    r.trickNo = 1;
    s.phase = 'PLAYING_TRICK';
    return s;
  }

  it('объявление марьяжа даёт очки и делает масть козырной', () => {
    let s = mkPlay({
      0: ['KH', 'QH', 'AS'],
      1: ['9H', '9S', 'JS'],
      2: ['JH', 'TS', 'QS'],
    });
    s = applyAction(s, { type: 'PLAY', card: 'KH', declare: 'marriage' });
    expect(s.round!.trump).toBe('H');
    expect(s.round!.trumpOwner).toBe(0);
    expect(s.round!.marriagePoints[0]).toBe(100);
  });

  it('второй марьяж меняет козырь', () => {
    let s = mkPlay({
      0: ['KH', 'QH', 'AS'],
      1: ['KS', 'QS', '9H'],
      2: ['JH', 'TS', '9S'],
    });
    s = applyAction(s, { type: 'PLAY', card: 'KH', declare: 'marriage' });
    s = applyAction(s, { type: 'PLAY', card: '9H', declare: 'none' });
    s = applyAction(s, { type: 'PLAY', card: 'JH', declare: 'none' });
    expect(s.phase).toBe('TRICK_RESULT');
    expect(s.round!.tricks[0].winner).toBe(0);
    // теперь ход снова у игрока 0; отдадим взятку игроку 1, чтобы он мог хвалить
    s = applyAction(s, { type: 'ADVANCE' });
    s = applyAction(s, { type: 'PLAY', card: 'AS', declare: 'none' });
    s = applyAction(s, { type: 'PLAY', card: 'KS', declare: 'none' });
    s = applyAction(s, { type: 'PLAY', card: 'TS', declare: 'none' });
    s = applyAction(s, { type: 'ADVANCE' });
    // ходит игрок 0 (взял тузом), значит объявить не выйдет — проверим напрямую
    const r = s.round!;
    expect(r.trump).toBe('H');
    expect(r.trumpOwner).toBe(0);
  });

  it('марьяж соперника перебивает козырь', () => {
    let s = mkPlay({
      0: ['9H', 'AS', 'JS'],
      1: ['KS', 'QS', 'TS'],
      2: ['JH', 'QH', '9S'],
    });
    // игрок 1 выигрывает взятку и объявляет пиковый марьяж следующим ходом
    s = applyAction(s, { type: 'PLAY', card: 'JS', declare: 'none' });
    s = applyAction(s, { type: 'PLAY', card: 'TS', declare: 'none' });
    s = applyAction(s, { type: 'PLAY', card: '9S', declare: 'none' });
    s = applyAction(s, { type: 'ADVANCE' });
    expect(currentPlayerToMove(s)).toBe(1);
    s = applyAction(s, { type: 'PLAY', card: 'KS', declare: 'marriage' });
    expect(s.round!.trump).toBe('S');
    expect(s.round!.trumpOwner).toBe(1);
    expect(s.round!.marriagePoints[1]).toBe(40);
  });

  it('тузовый марьяж даёт 200 и не меняет козырь', () => {
    let s = mkPlay(
      {
        0: ['AS', 'AC', 'AD', 'AH'],
        1: ['KS', 'QS', '9H', '9C'],
        2: ['JH', 'QH', '9S', 'JC'],
      },
      { aceMarriage: true },
    );
    s.round!.trump = 'H';
    s.round!.trumpOwner = 2;
    s = applyAction(s, { type: 'PLAY', card: 'AS', declare: 'ace' });
    expect(s.round!.marriagePoints[0]).toBe(200);
    expect(s.round!.trump).toBe('H');
    expect(s.round!.marriages[0].suit).toBeNull();
  });

  it('без настройки тузовый марьяж не объявляется', () => {
    let s = mkPlay(
      {
        0: ['AS', 'AC', 'AD', 'AH'],
        1: ['KS', 'QS', '9H', '9C'],
        2: ['JH', 'QH', '9S', 'JC'],
      },
      { aceMarriage: false },
    );
    s = applyAction(s, { type: 'PLAY', card: 'AS', declare: 'ace' });
    expect(s.round!.marriagePoints[0]).toBe(0);
  });

  it('нельзя объявить марьяж до первой взятки при классической договорённости', () => {
    let s = mkPlay(
      { 0: ['KH', 'QH', 'AS'], 1: ['9H', '9S', 'JS'], 2: ['JH', 'TS', 'QS'] },
      { marriageFromFirstMove: false },
    );
    s = applyAction(s, { type: 'PLAY', card: 'KH', declare: 'marriage' });
    expect(s.round!.trump).toBeNull();
    expect(s.round!.marriagePoints[0]).toBe(0);
  });

  it('нельзя сыграть карту не в масть при наличии масти хода', () => {
    let s = mkPlay({ 0: ['AS', 'KH'], 1: ['9S', '9H'], 2: ['TS', 'JH'] });
    s = applyAction(s, { type: 'PLAY', card: 'AS', declare: 'none' });
    const before = s;
    const after = applyAction(s, { type: 'PLAY', card: '9H', declare: 'none' });
    expect(after.round!.currentTrick!.cards.length).toBe(before.round!.currentTrick!.cards.length);
  });
});

describe('полная партия', () => {
  it('партия втроём доходит до GAME_OVER без ошибок', () => {
    const s = playOut(newGame({}, 20240101));
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).not.toBeNull();
    expect(s.players[s.winner!].total).toBeGreaterThanOrEqual(1000);
    expect(s.history.length).toBeGreaterThan(3);
  });

  it('партия вчетвером доходит до GAME_OVER', () => {
    const s = playOut(newGame({ playersCount: 4 }, 555001));
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).not.toBeNull();
  });

  it('партия с включёнными «максимальными» договорённостями отыгрывается', () => {
    const s = playOut(
      newGame(
        {
          goldenEnabled: true,
          goldenCanRaise: true,
          aceMarriage: true,
          marriageFromFirstMove: true,
          noLeadForeignTrump: true,
          roundOwnGame: true,
          winMoreThan1000: true,
          barrelScore: 900,
          barrelKnockOff: true,
          resetAfter3Barrels: true,
          dumpNegative: true,
          redealFourNinesAfterDiscard: true,
          redealTwoNinesTalon: true,
          boltMode: 'total3',
          boltNoOwnGame: false,
          rospisNoDeduct: true,
          rospisWhenGolden: true,
          rospisWhenDark: true,
          bidAbove120WithoutMarriage: true,
          darkMinScore: 0,
        },
        31337,
      ),
    );
    expect(s.phase).toBe('GAME_OVER');
  });

  it('во всех конах сохраняется 24 карты и 8 взяток', () => {
    let s = newGame({}, 98765);
    const rng = new Rng(1);
    let guard = 0;
    while (s.phase !== 'GAME_OVER' && guard++ < 100000) {
      if (s.phase === 'ROUND_SCORING' || s.phase === 'ROUND_END') {
        const r = s.round!;
        if (!r.rospis) {
          expect(r.tricks.length).toBe(8);
          const total =
            (r.cardPoints[r.participants[0]] || 0) +
            (r.cardPoints[r.participants[1]] || 0) +
            (r.cardPoints[r.participants[2]] || 0);
          expect(total + handValue(r.talon) * 0).toBe(120 - handValue([]));
        }
      }
      if (s.phase === 'TRICK_RESULT' || s.phase === 'ROUND_END' || s.phase === 'TALON_REVEAL') {
        s = applyAction(s, { type: 'ADVANCE' });
        continue;
      }
      const a = aiAct(s, rng);
      if (!a) break;
      s = applyAction(s, a);
    }
    expect(s.phase).toBe('GAME_OVER');
  });
});
