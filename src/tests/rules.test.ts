import { describe, expect, it } from 'vitest';
import {
  MARRIAGE_VALUE,
  RANK_ORDER,
  RANK_VALUE,
  cardValue,
  handValue,
  sortHand,
} from '../game/cards';
import { fullDeck } from '../game/deck';
import { beats, canDeclareMarriage, legalCards, trickWinner } from '../game/legalMoves';
import { roundToFive, minContractFromBarrel, winThreshold } from '../game/scoring';
import { hasAceMarriage, marriageSuits, marriagesValue, maxBidByMarriages, talonSitterBonus } from '../game/marriages';
import { DEFAULT_RULES } from '../game/settings';
import { RoundState } from '../game/gameState';

function mkRound(partial: Partial<RoundState> = {}): RoundState {
  return {
    no: 1,
    dealer: 0,
    participants: [0, 1, 2],
    talonSitter: null,
    hands: { 0: [], 1: [], 2: [] },
    talon: [],
    talonRevealed: false,
    mandatoryBidder: 0,
    bids: [],
    currentBidder: 0,
    highestBid: 100,
    highestBidder: 0,
    passed: [],
    darkPlayer: null,
    darkActive: false,
    raisedAbove100: false,
    contractPlayer: 0,
    contract: 100,
    discardedTo: {},
    discardSelection: [],
    trump: null,
    trumpOwner: null,
    tricks: [],
    currentTrick: { leader: 0, cards: [], winner: null },
    trickNo: 1,
    tricksWon: { 0: 0, 1: 0, 2: 0 },
    cardPoints: { 0: 0, 1: 0, 2: 0 },
    marriagePoints: { 0: 0, 1: 0, 2: 0 },
    marriages: [],
    rospis: false,
    golden: false,
    result: null,
    resultMarks: null,
    seenDiscard: { 0: null, 1: null, 2: null },
    ...partial,
  };
}

describe('колода и карты', () => {
  it('содержит ровно 24 уникальные карты', () => {
    const d = fullDeck();
    expect(d.length).toBe(24);
    expect(new Set(d).size).toBe(24);
  });

  it('вся колода стоит 120 очков, каждая масть — 30', () => {
    expect(handValue(fullDeck())).toBe(120);
    expect(handValue(fullDeck().filter((c) => c[1] === 'H'))).toBe(30);
  });

  it('старшинство: 9 < J < Q < K < 10 < A', () => {
    expect(RANK_ORDER['9']).toBeLessThan(RANK_ORDER.J);
    expect(RANK_ORDER.J).toBeLessThan(RANK_ORDER.Q);
    expect(RANK_ORDER.Q).toBeLessThan(RANK_ORDER.K);
    expect(RANK_ORDER.K).toBeLessThan(RANK_ORDER.T);
    expect(RANK_ORDER.T).toBeLessThan(RANK_ORDER.A);
  });

  it('стоимость карт не совпадает со старшинством', () => {
    expect(RANK_VALUE['9']).toBe(0);
    expect(RANK_VALUE.J).toBe(2);
    expect(RANK_VALUE.Q).toBe(3);
    expect(RANK_VALUE.K).toBe(4);
    expect(RANK_VALUE.T).toBe(10);
    expect(RANK_VALUE.A).toBe(11);
    expect(cardValue('TH')).toBeGreaterThan(cardValue('KH'));
  });

  it('сортировка руки не теряет карты', () => {
    const h = ['AS', '9H', 'KD', 'JC'];
    expect(sortHand(h).sort()).toEqual([...h].sort());
  });
});

describe('определение победителя взятки', () => {
  it('без козыря побеждает старшая карта масти первого хода', () => {
    const w = trickWinner(
      [
        { player: 0, card: 'AC' },
        { player: 1, card: '9C' },
        { player: 2, card: 'AH' },
      ],
      null,
    );
    expect(w).toBe(0);
  });

  it('карта другой масти не может взять взятку', () => {
    expect(beats('AH', 'JC', 'C', null)).toBe(false);
  });

  it('козырь бьёт любую некозырную', () => {
    const w = trickWinner(
      [
        { player: 0, card: 'AC' },
        { player: 1, card: '9H' },
        { player: 2, card: 'KC' },
      ],
      'H',
    );
    expect(w).toBe(1);
  });

  it('старший козырь бьёт младший', () => {
    const w = trickWinner(
      [
        { player: 0, card: '9H' },
        { player: 1, card: 'QH' },
        { player: 2, card: 'JH' },
      ],
      'H',
    );
    expect(w).toBe(1);
  });
});

describe('обязательная масть и обязательный козырь', () => {
  it('обязан ходить в масть первого хода', () => {
    const r = mkRound({ currentTrick: { leader: 0, cards: [{ player: 0, card: 'AC' }], winner: null } });
    const hand = ['9C', 'KC', 'AH', 'TS'];
    expect(legalCards(hand, r, 1, DEFAULT_RULES).sort()).toEqual(['9C', 'KC']);
  });

  it('без масти обязан класть козырь', () => {
    const r = mkRound({
      trump: 'H',
      trumpOwner: 0,
      currentTrick: { leader: 0, cards: [{ player: 0, card: 'AC' }], winner: null },
    });
    const hand = ['9H', 'AH', 'TS'];
    expect(legalCards(hand, r, 1, DEFAULT_RULES).sort()).toEqual(['9H', 'AH']);
  });

  it('без масти и без козыря — любая карта', () => {
    const r = mkRound({
      trump: 'H',
      currentTrick: { leader: 0, cards: [{ player: 0, card: 'AC' }], winner: null },
    });
    const hand = ['9D', 'TS'];
    expect(legalCards(hand, r, 1, DEFAULT_RULES).sort()).toEqual(['9D', 'TS']);
  });

  it('нельзя ходить с чужих козырей, если настройка включена', () => {
    const r = mkRound({ trump: 'H', trumpOwner: 0, currentTrick: { leader: 1, cards: [], winner: null } });
    const rules = { ...DEFAULT_RULES, noLeadForeignTrump: true };
    const hand = ['AH', 'TS', '9C'];
    expect(legalCards(hand, r, 1, rules).sort()).toEqual(['9C', 'TS']);
  });

  it('ограничение снимается, если других мастей нет', () => {
    const r = mkRound({ trump: 'H', trumpOwner: 0, currentTrick: { leader: 1, cards: [], winner: null } });
    const rules = { ...DEFAULT_RULES, noLeadForeignTrump: true };
    expect(legalCards(['AH', '9H'], r, 1, rules).sort()).toEqual(['9H', 'AH']);
  });
});

describe('марьяжи', () => {
  it('стоимость марьяжей по мастям', () => {
    expect(MARRIAGE_VALUE.S).toBe(40);
    expect(MARRIAGE_VALUE.C).toBe(60);
    expect(MARRIAGE_VALUE.D).toBe(80);
    expect(MARRIAGE_VALUE.H).toBe(100);
  });

  it('находит марьяжи в руке', () => {
    expect(marriageSuits(['KH', 'QH', 'KS', 'AS']).sort()).toEqual(['H']);
    expect(marriagesValue(['KH', 'QH', 'KS', 'QS'])).toBe(140);
  });

  it('нельзя объявить марьяж без взятки, если хвалить с первого хода запрещено', () => {
    const r = mkRound();
    expect(canDeclareMarriage(['KH', 'QH'], 'KH', r, 0, DEFAULT_RULES)).toBeNull();
  });

  it('можно объявить марьяж после взятки', () => {
    const r = mkRound({ tricksWon: { 0: 1, 1: 0, 2: 0 } });
    expect(canDeclareMarriage(['KH', 'QH'], 'KH', r, 0, DEFAULT_RULES)).toBe('H');
  });

  it('можно объявить с первого хода при включённой договорённости', () => {
    const r = mkRound();
    const rules = { ...DEFAULT_RULES, marriageFromFirstMove: true };
    expect(canDeclareMarriage(['KH', 'QH'], 'QH', r, 0, rules)).toBe('H');
  });

  it('нельзя объявить не первым ходом во взятке', () => {
    const r = mkRound({
      tricksWon: { 0: 1, 1: 0, 2: 0 },
      currentTrick: { leader: 1, cards: [{ player: 1, card: '9H' }], winner: null },
    });
    expect(canDeclareMarriage(['KH', 'QH'], 'KH', r, 0, DEFAULT_RULES)).toBeNull();
  });

  it('тузовый марьяж определяется по четырём тузам', () => {
    expect(hasAceMarriage(['AS', 'AC', 'AD', 'AH'])).toBe(true);
    expect(hasAceMarriage(['AS', 'AC', 'AD', 'KH'])).toBe(false);
  });

  it('ограничение торга: 120 + марьяжи', () => {
    expect(maxBidByMarriages(['9S'])).toBe(120);
    expect(maxBidByMarriages(['KH', 'QH'])).toBe(220);
    expect(maxBidByMarriages(['KH', 'QH', 'KS', 'QS'])).toBe(260);
  });

  it('бонус сидящего на прикупе', () => {
    expect(talonSitterBonus(['KH', 'QH', '9S'], true, false)).toBe(100);
    expect(talonSitterBonus(['KH', '9S', '9C'], false, true)).toBe(50);
  });
});

describe('округление очков', () => {
  it('по правилам старой программы', () => {
    expect(roundToFive(10)).toBe(10);
    expect(roundToFive(11)).toBe(10);
    expect(roundToFive(12)).toBe(10);
    expect(roundToFive(13)).toBe(15);
    expect(roundToFive(14)).toBe(15);
    expect(roundToFive(15)).toBe(15);
    expect(roundToFive(16)).toBe(15);
    expect(roundToFive(17)).toBe(15);
    expect(roundToFive(18)).toBe(20);
    expect(roundToFive(19)).toBe(20);
    expect(roundToFive(23)).toBe(25);
    expect(roundToFive(0)).toBe(0);
  });
});

describe('порог победы и бочка', () => {
  it('победа при 1000 или 1005', () => {
    expect(winThreshold(false)).toBe(1000);
    expect(winThreshold(true)).toBe(1005);
  });

  it('минимальный заказ с бочки', () => {
    expect(minContractFromBarrel(880, false)).toBe(120);
    expect(minContractFromBarrel(880, true)).toBe(125);
    expect(minContractFromBarrel(900, false)).toBe(100);
    expect(minContractFromBarrel(900, true)).toBe(105);
  });
});
