import { handValue } from './cards';
import { GameState, HistoryEntry, PlayerState, RoundState } from './gameState';
import { talonSitterBonus } from './marriages';
import { roundToFive, winThreshold } from './scoring';
import { RuleSettings } from './settings';

export interface RoundOutcome {
  delta: Record<number, number>;
  marks: Record<number, string[]>;
  totals: Record<number, number>;
  winner: number | null;
  contractMade: boolean;
}

function pushMark(marks: Record<number, string[]>, p: number, m: string) {
  if (!marks[p]) marks[p] = [];
  if (!marks[p].includes(m)) marks[p].push(m);
}

/** Сырые очки участника за кон (карты + марьяжи). */
export function rawRoundPoints(round: RoundState, p: number): number {
  return (round.cardPoints[p] || 0) + (round.marriagePoints[p] || 0);
}

/** Выполнен ли заказ (с учётом договорённости об округлении своей игры). */
export function isContractMade(round: RoundState, rules: RuleSettings): boolean {
  if (round.rospis) return false;
  const pts = rawRoundPoints(round, round.contractPlayer);
  const effective = rules.roundOwnGame ? roundToFive(pts) : pts;
  return effective >= round.contract;
}

/**
 * Полный расчёт кона: очки, роспись, удвоения, болты, бочка, самосвал, штрафы.
 * Мутирует переданные объекты игроков (это единственное место, где меняется общий счёт).
 */
export function finalizeRound(state: GameState): RoundOutcome {
  const round = state.round!;
  const rules = state.rules;
  const players = state.players;
  const delta: Record<number, number> = {};
  const marks: Record<number, string[]> = {};
  for (const p of players) {
    delta[p.index] = 0;
    marks[p.index] = [];
  }

  const cp = round.contractPlayer;
  const opponents = round.participants.filter((p) => p !== cp);
  let contractMade = false;

  if (round.rospis) {
    pushMark(marks, cp, 'R');
    if (!rules.rospisNoDeduct) delta[cp] -= round.contract;
    if (rules.rospisBy60) {
      for (const o of opponents) delta[o] += 60;
    } else {
      const half = roundToFive(round.contract / 2);
      for (const o of opponents) delta[o] += half;
    }
    players[cp].rospisCount += 1;
    if (rules.rospisPenaltyOnThird && players[cp].rospisCount === 3) {
      delta[cp] -= rules.penaltyAmount;
    }
  } else {
    contractMade = isContractMade(round, rules);
    delta[cp] = contractMade ? round.contract : -round.contract;
    for (const o of opponents) {
      delta[o] = roundToFive(rawRoundPoints(round, o));
    }
  }

  // Игрок, сидящий на прикупе (режим вчетвером)
  if (round.talonSitter !== null) {
    const bonus =
      handValue(round.talon) +
      talonSitterBonus(round.talon, rules.talonSitterMarriage, rules.talonSitterHalfMarriage);
    delta[round.talonSitter] = roundToFive(bonus);
    pushMark(marks, round.talonSitter, '#');
  }

  // Удвоения
  if (round.golden) {
    for (const p of round.participants) delta[p] *= 2;
    if (round.talonSitter !== null) delta[round.talonSitter] *= 2;
    for (const p of round.participants) pushMark(marks, p, 'D');
  } else if (round.darkActive) {
    delta[cp] *= 2;
    pushMark(marks, cp, 'D');
  }

  // --- Болты ---
  applyBolts(round, players, rules, delta, marks);

  // --- Общий счёт, бочка, самосвал ---
  const th = winThreshold(rules.winMoreThan1000);
  let winner: number | null = null;

  const wasOnBarrel = players.filter((p) => p.onBarrel).map((p) => p.index);

  // 1. Сидящие на бочке
  for (const idx of wasOnBarrel) {
    const p = players[idx];
    const isCp = !round.rospis && idx === cp && round.participants.includes(idx);
    const wins = isCp && contractMade && rules.barrelScore + round.contract >= th;
    if (wins) {
      p.total = rules.barrelScore + delta[idx];
      p.onBarrel = false;
      winner = idx;
      pushMark(marks, idx, 'W');
    } else {
      // очки с бочки не набираются
      delta[idx] = 0;
      p.total = rules.barrelScore;
      // сидящий на прикупе (вчетвером) не тратит попытку — он не играл
      if (round.talonSitter === idx) continue;
      p.barrelAttemptsUsed += 1;
      if (p.barrelAttemptsUsed >= rules.barrelAttempts) {
        p.onBarrel = false;
        p.barrelAttemptsUsed = 0;
        p.barrelsFailed += 1;
        p.total -= rules.penaltyAmount;
        delta[idx] = -rules.penaltyAmount;
        pushMark(marks, idx, '↓');
        if (rules.resetAfter3Barrels && p.barrelsFailed >= 3) {
          p.total = 0;
          p.barrelsFailed = 0;
          pushMark(marks, idx, 'O');
        }
      }
    }
  }

  // 2. Остальные — обычное начисление
  const barrelCandidates: number[] = [];
  for (const p of players) {
    if (wasOnBarrel.includes(p.index)) continue;
    p.total += delta[p.index];
    if (p.total >= rules.barrelScore) barrelCandidates.push(p.index);
  }

  if (barrelCandidates.length > 0 && winner === null) {
    if (rules.noSimultaneousBarrel && barrelCandidates.length >= 2) {
      for (const idx of barrelCandidates) {
        players[idx].total = rules.barrelScore - rules.penaltyAmount;
        players[idx].onBarrel = false;
        pushMark(marks, idx, '↓');
      }
    } else {
      for (const idx of barrelCandidates) {
        const p = players[idx];
        p.total = rules.barrelScore;
        p.onBarrel = true;
        p.barrelAttemptsUsed = 0;
        pushMark(marks, idx, 'B');
      }
      if (rules.barrelKnockOff) {
        for (const idx of wasOnBarrel) {
          const p = players[idx];
          if (!p.onBarrel) continue;
          if (barrelCandidates.includes(idx)) continue;
          p.onBarrel = false;
          p.barrelAttemptsUsed = 0;
          p.barrelsFailed += 1;
          p.total -= rules.penaltyAmount;
          pushMark(marks, idx, '↓');
          if (rules.resetAfter3Barrels && p.barrelsFailed >= 3) {
            p.total = 0;
            p.barrelsFailed = 0;
            pushMark(marks, idx, 'O');
          }
        }
      }
    }
  }

  // 3. Самосвал
  if (rules.dumpEnabled) {
    for (const p of players) {
      if (p.total === rules.dumpScore || (rules.dumpNegative && p.total === -rules.dumpScore)) {
        p.total = 0;
        p.onBarrel = false;
        pushMark(marks, p.index, 'Z');
      }
    }
  }

  // 4. Победа
  if (winner === null) {
    for (const p of players) {
      if (p.total >= th) {
        winner = p.index;
        pushMark(marks, p.index, 'W');
        break;
      }
    }
  }

  const totals: Record<number, number> = {};
  for (const p of players) totals[p.index] = p.total;

  return { delta, marks, totals, winner, contractMade };
}

function applyBolts(
  round: RoundState,
  players: PlayerState[],
  rules: RuleSettings,
  delta: Record<number, number>,
  marks: Record<number, string[]>,
) {
  for (const idx of round.participants) {
    const p = players[idx];
    const zero = (round.tricksWon[idx] || 0) === 0;
    if (!zero) {
      p.boltsStreak = 0;
      continue;
    }
    const isCp = idx === round.contractPlayer;
    if (isCp && rules.boltNoOwnGame) {
      // болт не записывается, но и серия не прерывается искусственно
      continue;
    }
    const weight = round.golden && rules.boltGoldenDouble ? 2 : 1;
    p.boltsStreak += weight;
    p.boltsTotal += weight;
    p.boltsMarks += weight;
    marks[idx].push('-');

    if (rules.boltMode === 'consecutive3' && p.boltsStreak >= 3) {
      delta[idx] -= rules.penaltyAmount;
      p.boltsStreak = 0;
      marks[idx].push('!');
    } else if (rules.boltMode === 'total3' && p.boltsTotal >= 3) {
      delta[idx] -= rules.penaltyAmount;
      p.boltsTotal = 0;
      p.boltsStreak = 0;
      marks[idx].push('!');
    }
  }
}

export function makeHistoryEntry(state: GameState, outcome: RoundOutcome): HistoryEntry {
  const round = state.round!;
  return {
    roundNo: round.no,
    delta: outcome.delta,
    totals: outcome.totals,
    marks: outcome.marks,
    contractPlayer: round.contractPlayer,
    contract: round.contract,
    golden: round.golden,
    dark: round.darkActive,
  };
}
