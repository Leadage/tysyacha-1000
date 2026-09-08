import { GameState, GameStats } from './gameState';
import { isContractMade } from './barrel';

/** Обновление статистики по завершившемуся кону (учитывается только человек). */
export function updateStatsAfterRound(stats: GameStats, s: GameState): GameStats {
  const r = s.round;
  if (!r || !r.result) return stats;
  const st = { ...stats };
  const human = 0;

  if (r.participants.includes(human)) {
    if (r.contractPlayer === human) {
      st.contractsTaken += 1;
      st.contractSum += r.contract;
      st.maxContract = Math.max(st.maxContract, r.contract);
      if (!r.rospis && isContractMade(r, s.rules)) st.contractsMade += 1;
    }
    if (r.rospis && r.contractPlayer === human) st.rospisi += 1;
    if ((r.tricksWon[human] || 0) === 0 && !r.rospis) st.bolts += 1;
    for (const m of r.marriages) {
      if (m.player !== human) continue;
      if (m.suit === null) st.aceMarriages += 1;
      else st.marriages += 1;
    }
  }

  const marks = r.resultMarks?.[human] || [];
  if (marks.includes('B')) st.barrels += 1;
  if (marks.includes('↓')) st.barrelFails += 1;

  st.minScore = Math.min(st.minScore, s.players[human].total);
  return st;
}

export function updateStatsAfterGame(stats: GameStats, s: GameState): GameStats {
  const st = { ...stats };
  st.gamesPlayed += 1;
  if (s.winner === 0) {
    st.wins += 1;
    if (s.players[0].onBarrel || (s.history.at(-1)?.marks[0] || []).includes('W')) st.barrelWins += 1;
  } else {
    st.losses += 1;
  }
  return st;
}

export function winRate(st: GameStats): number {
  if (st.gamesPlayed === 0) return 0;
  return Math.round((st.wins / st.gamesPlayed) * 100);
}

export function avgContract(st: GameStats): number {
  if (st.contractsTaken === 0) return 0;
  return Math.round(st.contractSum / st.contractsTaken);
}

export function contractSuccess(st: GameStats): number {
  if (st.contractsTaken === 0) return 0;
  return Math.round((st.contractsMade / st.contractsTaken) * 100);
}
