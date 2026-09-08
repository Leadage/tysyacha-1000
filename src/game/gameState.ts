import { CardId, Suit } from './cards';
import { RngState } from './rng';
import { RuleSettings } from './settings';

export type Phase =
  | 'SETUP'
  | 'DEALING'
  | 'REDEAL_DECISION'
  | 'DARK_GAME_DECISION'
  | 'BIDDING'
  | 'TALON_REVEAL'
  | 'TALON_REDEAL_DECISION'
  | 'DISCARDING'
  | 'FINAL_CONTRACT'
  | 'PLAYING_TRICK'
  | 'TRICK_RESULT'
  | 'ROUND_SCORING'
  | 'ROUND_END'
  | 'GAME_OVER';

export type AiLevel = 'novice' | 'medium' | 'strong';

export interface PlayerState {
  index: number;
  name: string;
  isHuman: boolean;
  aiLevel: AiLevel;

  total: number;

  /** сидит на бочке */
  onBarrel: boolean;
  /** сколько конов уже потрачено на текущей бочке */
  barrelAttemptsUsed: number;
  /** сколько раз игрок садился на бочку и слетал */
  barrelsFailed: number;

  /** болты подряд */
  boltsStreak: number;
  /** болты за партию (для режима «3 за игру») */
  boltsTotal: number;
  /** всего болтов за партию, для таблицы/статистики */
  boltsMarks: number;

  rospisCount: number;

  /** сыграл ли уже свой обязательный золотой кон */
  goldenPlayed: boolean;
}

export interface TrickCard {
  player: number;
  card: CardId;
}

export interface Trick {
  leader: number;
  cards: TrickCard[];
  winner: number | null;
}

export interface MarriageDeclared {
  player: number;
  suit: Suit | null; // null — тузовый марьяж
  value: number;
  trickNo: number;
}

export type BidEntry = { player: number; value: number | null; dark?: boolean };

export interface RoundState {
  no: number;
  dealer: number;
  /** индексы игроков, реально участвующих в раздаче (3 человека) */
  participants: number[];
  /** при игре вчетвером — кто сидит на прикупе (иначе null) */
  talonSitter: number | null;

  hands: Record<number, CardId[]>;
  talon: CardId[];
  /** прикуп раскрыт для соперников */
  talonRevealed: boolean;

  /** игрок с обязательным заказом 100 */
  mandatoryBidder: number;
  bids: BidEntry[];
  currentBidder: number;
  highestBid: number;
  highestBidder: number;
  passed: number[];
  /** игрок объявил тёмную и ещё не смотрел карты */
  darkPlayer: number | null;
  darkActive: boolean; // тёмная состоялась (никто не перебил)
  /** победитель торгов повышал ставку сверх обязательных 100 */
  raisedAbove100: boolean;

  contractPlayer: number;
  contract: number;

  /** карты, розданные соперникам при сносе: player -> card */
  discardedTo: Record<number, CardId>;
  discardSelection: CardId[];

  trump: Suit | null;
  trumpOwner: number | null;

  tricks: Trick[];
  currentTrick: Trick | null;
  trickNo: number;
  tricksWon: Record<number, number>;
  cardPoints: Record<number, number>;
  marriagePoints: Record<number, number>;
  marriages: MarriageDeclared[];

  rospis: boolean;

  golden: boolean;
  /** результат кона (то, что записано в общий счёт) */
  result: Record<number, number> | null;
  resultMarks: Record<number, string[]> | null;

  /** карты, которые игрок видел лично (для «сноса втёмную») */
  seenDiscard: Record<number, CardId | null>;
}

export interface HistoryEntry {
  roundNo: number;
  /** дельта общего счёта по каждому игроку */
  delta: Record<number, number>;
  /** общий счёт после кона */
  totals: Record<number, number>;
  /** буквенные обозначения: Z, D, R, O, B (бочка), '-' болт, '#' на прикупе */
  marks: Record<number, string[]>;
  contractPlayer: number;
  contract: number;
  golden: boolean;
  dark: boolean;
}

export type GameEvent =
  | { t: 'newRound'; round: number; dealer: number; hands: Record<number, CardId[]>; talon: CardId[]; talonSitter: number | null; golden: boolean }
  | { t: 'redeal'; player: number; reason: string }
  | { t: 'dark'; player: number }
  | { t: 'bid'; player: number; value: number | null }
  | { t: 'talon'; cards: CardId[]; revealed: boolean }
  | { t: 'discard'; from: number; to: number; card: CardId }
  | { t: 'contract'; player: number; value: number }
  | { t: 'rospis'; player: number }
  | { t: 'play'; player: number; card: CardId; marriage?: Suit | null }
  | { t: 'trick'; winner: number; cards: TrickCard[] }
  | { t: 'score'; delta: Record<number, number>; totals: Record<number, number>; marks: Record<number, string[]> }
  | { t: 'gameOver'; winner: number };

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  contractsTaken: number;
  contractsMade: number;
  contractSum: number;
  maxContract: number;
  marriages: number;
  aceMarriages: number;
  barrels: number;
  barrelWins: number;
  barrelFails: number;
  bolts: number;
  rospisi: number;
  minScore: number;
}

export const EMPTY_STATS: GameStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  contractsTaken: 0,
  contractsMade: 0,
  contractSum: 0,
  maxContract: 0,
  marriages: 0,
  aceMarriages: 0,
  barrels: 0,
  barrelWins: 0,
  barrelFails: 0,
  bolts: 0,
  rospisi: 0,
  minScore: 0,
};

export interface GameState {
  phase: Phase;
  rules: RuleSettings;
  rng: RngState;
  players: PlayerState[];
  dealer: number;
  roundNo: number;
  round: RoundState | null;
  history: HistoryEntry[];
  winner: number | null;
  /** идёт золотой круг */
  goldenCircle: boolean;
  /** сколько золотых конов уже сыграно в текущем круге */
  goldenRoundsPlayed: number;
  /** хоть кто-то выполнил золотой заказ в текущем круге */
  goldenAnyMade: boolean;
  /** сообщение для информационного окна */
  message: string;
  /** лог событий текущей раздачи — для повтора */
  eventLog: GameEvent[];
  /** лог предыдущей завершённой раздачи */
  lastRoundLog: GameEvent[];
  /** последняя взятка (для меню «Просмотр») */
  lastTrick: Trick | null;
  /** последний прикуп */
  lastTalon: CardId[];
  pendingRedeal: number | null;
  /** кого уже спрашивали про пересдачу в этом кону */
  redealAsked: number[];
  seed: number;
}

/** Следующий игрок по кругу среди участников раздачи. */
export function nextParticipant(round: RoundState, player: number): number {
  const arr = round.participants;
  const i = arr.indexOf(player);
  return arr[(i + 1) % arr.length];
}

export function participantsFor(playersCount: number, dealer: number): { participants: number[]; sitter: number | null } {
  if (playersCount === 3) {
    return { participants: [0, 1, 2], sitter: null };
  }
  const participants: number[] = [];
  for (let k = 1; k <= 3; k++) participants.push((dealer + k) % 4);
  return { participants, sitter: dealer };
}
