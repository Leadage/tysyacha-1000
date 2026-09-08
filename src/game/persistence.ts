import { EMPTY_STATS, GameState, GameStats } from './gameState';
import { RuleSettings, UiSettings, normalizeRules, normalizeUi } from './settings';

const KEY_GAME = 'tysyacha.save.v1';
const KEY_RULES = 'tysyacha.rules.v1';
const KEY_UI = 'tysyacha.ui.v1';
const KEY_STATS = 'tysyacha.stats.v1';

function safeGet(key: string): any | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage может быть недоступен */
  }
}

export function saveGame(state: GameState) {
  safeSet(KEY_GAME, state);
}

export function loadGame(): GameState | null {
  const g = safeGet(KEY_GAME) as GameState | null;
  if (!g || typeof g !== 'object' || !g.players || !g.phase) return null;
  g.rules = normalizeRules(g.rules);
  if (!Array.isArray(g.redealAsked)) g.redealAsked = [];
  return g;
}

export function clearGame() {
  try {
    localStorage.removeItem(KEY_GAME);
  } catch {
    /* ignore */
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function saveRules(r: RuleSettings) {
  safeSet(KEY_RULES, r);
}
export function loadRules(): RuleSettings {
  return normalizeRules(safeGet(KEY_RULES));
}

export function saveUi(u: UiSettings) {
  safeSet(KEY_UI, u);
}
export function loadUi(): UiSettings {
  return normalizeUi(safeGet(KEY_UI));
}

export function loadStats(): GameStats {
  const s = safeGet(KEY_STATS);
  return { ...EMPTY_STATS, ...(s || {}) };
}
export function saveStats(s: GameStats) {
  safeSet(KEY_STATS, s);
}
export function resetStats() {
  saveStats({ ...EMPTY_STATS });
}
