import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/win98.css';
import './styles/game.css';

import {
  Action,
  applyAction,
  canRospis,
  createGame,
  currentActor,
  currentPlayerToMove,
  minBarrelContract,
} from './game/gameEngine';
import { legalBids, legalFinalContracts } from './game/bidding';
import { aiAct } from './game/ai';
import { Rng } from './game/rng';
import { GameState, GameStats } from './game/gameState';
import { RuleSettings, UiSettings } from './game/settings';
import {
  clearGame,
  loadGame,
  loadRules,
  loadStats,
  loadUi,
  saveGame,
  saveRules,
  saveStats,
  saveUi,
} from './game/persistence';
import { updateStatsAfterGame, updateStatsAfterRound } from './game/stats';
import { canDeclareMarriage, canDeclareAceMarriage } from './game/legalMoves';
import { CardId, MARRIAGE_VALUE, SUIT_NAME_RU, cardName, rankOf, suitOf } from './game/cards';
import { marriageSuits } from './game/marriages';
import * as sound from './game/sound';

import { MenuBar, MenuDef, MessageBox } from './components/Win98';
import { GameScreen, ScreenExtras, ScreenHandlers } from './screens/GameScreen';
import { RulesDialog } from './components/dialogs/RulesDialog';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import {
  AboutDialog,
  CardsDialog,
  HelpDialog,
  NegotiationDialog,
  ReplayDialog,
  StatsDialog,
} from './components/dialogs/InfoDialogs';
import { DebugPanel } from './components/DebugPanel';
import { TABLE_H, TABLE_W } from './components/layout';

type DialogKind =
  | null
  | 'rules'
  | 'settings'
  | 'stats'
  | 'replay'
  | 'lastTrick'
  | 'lastTalon'
  | 'help'
  | 'about'
  | 'negotiation'
  | 'continue';

interface Confirm {
  title: string;
  text: React.ReactNode;
  onOk: () => void;
  onCancel?: () => void;
  okLabel?: string;
  cancelLabel?: string;
  icon?: '!' | '?' | 'i';
}

export default function App() {
  const [rules, setRules] = useState<RuleSettings>(() => loadRules());
  const [ui, setUi] = useState<UiSettings>(() => loadUi());
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  const [state, setState] = useState<GameState>(() =>
    createGame({ rules: loadRules(), playerName: loadUi().playerName, botNames: loadUi().botNames }),
  );
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);
  const [bidValue, setBidValue] = useState(100);
  const [hidden, setHidden] = useState(false);
  const [debug, setDebug] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
  const [scale, setScale] = useState(1);

  // сохранённая партия читается до первого автосохранения
  const savedRef = useRef<GameState | null>(loadGame());
  const rngRef = useRef(Rng.random());
  const timerRef = useRef<number | null>(null);
  const statsCountedRef = useRef<{ round: number; game: boolean }>({ round: -1, game: false });

  // ------------------------------------------------ масштабирование окна

  useEffect(() => {
    const fit = () => {
      const k = Math.min(window.innerWidth / 1012, window.innerHeight / 704);
      setScale(Math.max(0.4, Math.min(1.6, k)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ------------------------------------------------ звук

  useEffect(() => {
    sound.setSoundEnabled(ui.sound);
  }, [ui.sound]);

  // ------------------------------------------------ сохранение

  useEffect(() => {
    saveGame(state);
  }, [state]);
  useEffect(() => {
    saveRules(rules);
  }, [rules]);
  useEffect(() => {
    saveUi(ui);
  }, [ui]);
  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  // предложение продолжить сохранённую партию
  useEffect(() => {
    const saved = savedRef.current;
    if (saved && saved.phase !== 'GAME_OVER' && saved.history.length + saved.roundNo > 1) {
      setDialog('continue');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------ статистика

  useEffect(() => {
    if (state.phase === 'ROUND_END' || state.phase === 'GAME_OVER') {
      if (state.round && statsCountedRef.current.round !== state.round.no) {
        statsCountedRef.current.round = state.round.no;
        setStats((s) => updateStatsAfterRound(s, state));
      }
    }
    if (state.phase === 'GAME_OVER' && !statsCountedRef.current.game) {
      statsCountedRef.current.game = true;
      setStats((s) => updateStatsAfterGame(s, state));
    }
  }, [state]);

  // ------------------------------------------------ действия

  const dispatch = useCallback((a: Action) => {
    setState((s) => applyAction(s, a));
  }, []);

  const actor = currentActor(state);
  const humanIsActor = actor !== null && state.players[actor].isHuman;

  // драйвер ботов и автопереходов
  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dialog === 'continue' || confirm) return;
    if (state.phase === 'GAME_OVER') return;

    if (state.phase === 'TRICK_RESULT') {
      timerRef.current = window.setTimeout(
        () => dispatch({ type: 'ADVANCE' }),
        Math.max(150, ui.trickDelayMs),
      );
      return;
    }
    if (state.phase === 'TALON_REVEAL') {
      timerRef.current = window.setTimeout(
        () => dispatch({ type: 'ADVANCE' }),
        Math.max(200, ui.talonDelayMs),
      );
      return;
    }
    if (state.phase === 'ROUND_END') {
      if (ui.autoClick) {
        timerRef.current = window.setTimeout(() => dispatch({ type: 'ADVANCE' }), 1600);
      }
      return;
    }
    if (humanIsActor) return;
    if (actor === null) return;

    timerRef.current = window.setTimeout(() => {
      setState((s) => {
        const a = aiAct(s, rngRef.current);
        if (!a) return s;
        if (a.type === 'PLAY') sound.play('card');
        return applyAction(s, a);
      });
    }, botDelay(state.phase, ui));
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state, humanIsActor, actor, dialog, confirm, ui, dispatch]);

  // звук при марьяже и взятке
  const lastMarriageRef = useRef(0);
  const lastTrickRef = useRef(0);
  useEffect(() => {
    const r = state.round;
    if (!r) return;
    if (r.marriages.length > lastMarriageRef.current) {
      lastMarriageRef.current = r.marriages.length;
      sound.play('marriage');
    } else if (r.marriages.length < lastMarriageRef.current) {
      lastMarriageRef.current = r.marriages.length;
    }
    if (r.tricks.length > lastTrickRef.current) {
      lastTrickRef.current = r.tricks.length;
      sound.play('trick');
    } else if (r.tricks.length < lastTrickRef.current) {
      lastTrickRef.current = r.tricks.length;
    }
  }, [state]);

  // ------------------------------------------------ решения человека

  // пересдача / тёмная — показываем модальные вопросы
  useEffect(() => {
    if (confirm) return;
    if (!humanIsActor) return;
    const r = state.round;
    if (!r) return;

    if (state.phase === 'REDEAL_DECISION' || state.phase === 'TALON_REDEAL_DECISION') {
      const isTalon = state.phase === 'TALON_REDEAL_DECISION';
      setConfirm({
        title: 'Пересдача',
        icon: '?',
        text: isTalon
          ? 'Прикуп слабый. Потребовать пересдачу?'
          : 'Ваша раздача позволяет потребовать пересдачу. Пересдать?',
        okLabel: 'Пересдать',
        cancelLabel: 'Играть',
        onOk: () => {
          setConfirm(null);
          dispatch({ type: isTalon ? 'TALON_REDEAL' : 'REDEAL' });
        },
        onCancel: () => {
          setConfirm(null);
          dispatch({ type: 'NO_REDEAL' });
        },
      });
    }

    if (state.phase === 'DARK_GAME_DECISION') {
      const declare = () => dispatch({ type: 'DECLARE_DARK' });
      setConfirm({
        title: 'Игра втёмную',
        icon: '?',
        text: 'Объявить игру ВТЁМНУЮ на 120 очков, не глядя в карты? Результат раздачи будет удвоен.',
        okLabel: 'Втёмную',
        cancelLabel: 'Смотрю карты',
        onOk: () => {
          setConfirm(null);
          if (ui.confirmDark) {
            // «Подтверждение при игре втемную» — второй, окончательный вопрос
            setConfirm({
              title: 'Подтверждение',
              icon: '!',
              text: 'Вы точно играете втёмную? Отменить объявление будет нельзя.',
              okLabel: 'Да',
              cancelLabel: 'Нет',
              onOk: () => {
                setConfirm(null);
                declare();
              },
              onCancel: () => {
                setConfirm(null);
                dispatch({ type: 'SKIP_DARK' });
              },
            });
          } else {
            declare();
          }
        },
        onCancel: () => {
          setConfirm(null);
          dispatch({ type: 'SKIP_DARK' });
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, humanIsActor, state.roundNo, state.pendingRedeal]);

  const allowedBids = useMemo(() => {
    if (state.phase !== 'BIDDING' || !humanIsActor || !state.round) return [];
    return legalBids(state.round, actor!, state.round.hands[actor!], state.players, state.rules);
  }, [state, humanIsActor, actor]);

  const allowedContracts = useMemo(() => {
    if (state.phase !== 'FINAL_CONTRACT' || !state.round) return [];
    return legalFinalContracts(state.round, state.round.hands[state.round.contractPlayer], state.rules);
  }, [state]);

  useEffect(() => {
    if (allowedBids.length > 0) setBidValue(allowedBids[0]);
  }, [allowedBids.join(',')]);

  // «Показывать кнопку Пас даже при обязательном пасе»: если выключено —
  // при отсутствии допустимых ставок игрок пасует автоматически.
  useEffect(() => {
    if (ui.showPassButton) return;
    if (state.phase !== 'BIDDING' || !humanIsActor || confirm) return;
    if (allowedBids.length > 0) return;
    const t = window.setTimeout(() => dispatch({ type: 'BID', value: null }), 350);
    return () => window.clearTimeout(t);
  }, [state.phase, humanIsActor, allowedBids.length, ui.showPassButton, confirm, dispatch]);

  useEffect(() => {
    if (allowedContracts.length > 0) setBidValue(allowedContracts[0]);
  }, [allowedContracts.join(',')]);

  useEffect(() => {
    setSelectedCard(null);
  }, [state.phase, state.roundNo]);

  // ------------------------------------------------ обработчики стола

  const handlers: ScreenHandlers = {
    onCardClick: (card) => {
      const r = state.round;
      if (!r) return;
      if (state.phase === 'DISCARDING') {
        setSelectedCard((c) => (c === card ? null : card));
        return;
      }
      if (state.phase !== 'PLAYING_TRICK') return;
      const me = currentPlayerToMove(state);
      if (me === null || !state.players[me].isHuman) return;

      const hand = r.hands[me];
      const marriageSuit = canDeclareMarriage(hand, card, r, me, state.rules);
      const aceM = canDeclareAceMarriage(hand, card, r, me, state.rules);

      // предупреждение: объявить марьяж пока нельзя
      const rk = rankOf(card);
      const isLead = !r.currentTrick || r.currentTrick.cards.length === 0;
      if (
        ui.confirmNoMarriage &&
        isLead &&
        !marriageSuit &&
        (rk === 'K' || rk === 'Q') &&
        marriageSuits(hand).includes(suitOf(card))
      ) {
        setConfirm({
          title: 'Марьяж',
          icon: '!',
          text: `У вас есть ${SUIT_NAME_RU[suitOf(card)]} марьяж (${MARRIAGE_VALUE[suitOf(card)]}), но объявить его пока нельзя — нужно сначала взять взятку. Всё равно сходить ${cardName(card)}?`,
          okLabel: 'Ходить',
          cancelLabel: 'Отмена',
          onOk: () => {
            setConfirm(null);
            sound.play('card');
            dispatch({ type: 'PLAY', card, declare: 'none' });
          },
          onCancel: () => setConfirm(null),
        });
        return;
      }

      sound.play('card');
      dispatch({
        type: 'PLAY',
        card,
        declare: marriageSuit ? 'marriage' : aceM ? 'ace' : 'none',
      });
    },

    onGiveTo: (player) => {
      if (!selectedCard) return;
      dispatch({ type: 'DISCARD', card: selectedCard, to: player });
      setSelectedCard(null);
      sound.play('card');
    },

    onBid: (v) => {
      dispatch({ type: 'BID', value: v });
      sound.play('message');
    },

    onSetContract: (v) => {
      const r = state.round;
      if (!r) return;
      const me = r.contractPlayer;
      const onBarrel = state.players[me].onBarrel;
      const need = minBarrelContract(state);
      if (ui.confirmLowBarrelContract && onBarrel && v < need) {
        setConfirm({
          title: 'Бочка',
          icon: '!',
          text: `Вы на бочке. Заказа ${v} не хватит для победы — нужно минимум ${need}. Всё равно играть ${v}?`,
          onOk: () => {
            setConfirm(null);
            dispatch({ type: 'SET_CONTRACT', value: v });
          },
          onCancel: () => setConfirm(null),
        });
        return;
      }
      if (ui.confirmSameContract && v === r.highestBid) {
        setConfirm({
          title: 'Заказ',
          icon: '?',
          text: `Играть на выигранной ставке ${v}, не увеличивая заказ?`,
          onOk: () => {
            setConfirm(null);
            dispatch({ type: 'SET_CONTRACT', value: v });
          },
          onCancel: () => setConfirm(null),
        });
        return;
      }
      dispatch({ type: 'SET_CONTRACT', value: v });
    },

    onRospis: () => {
      setConfirm({
        title: 'Роспись',
        icon: '?',
        text: 'Признать, что заказ невыполним, и расписать?',
        onOk: () => {
          setConfirm(null);
          dispatch({ type: 'ROSPIS' });
        },
        onCancel: () => setConfirm(null),
      });
    },

    onAdvance: () => dispatch({ type: 'ADVANCE' }),
    onReplay: () => setDialog('replay'),
    onNewGame: () => newGame(rules, ui),
  };

  const extras: ScreenExtras = {
    selectedCard,
    bidValue,
    setBidValue,
    allowedBids,
    allowedContracts,
    showRospis: canRospis(state) && humanIsActor,
    humanIsActor,
  };

  // ------------------------------------------------ новая партия

  const newGame = useCallback((r: RuleSettings, u: UiSettings) => {
    statsCountedRef.current = { round: -1, game: false };
    lastMarriageRef.current = 0;
    lastTrickRef.current = 0;
    setState(createGame({ rules: r, playerName: u.playerName, botNames: u.botNames }));
    setSelectedCard(null);
    setConfirm(null);
  }, []);

  // ------------------------------------------------ горячие клавиши

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        newGame(rules, ui);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setHidden((v) => !v);
      } else if (e.key.toLowerCase() === 'd' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setDebug((v) => !v);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [rules, ui, newGame]);

  // режим «спрятать»
  useEffect(() => {
    if (hidden) {
      document.title = ui.escapeTitle || 'Microsoft Excel';
      setFavicon(
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23217346'/%3E%3Ctext x='8' y='12' font-size='11' text-anchor='middle' fill='white' font-family='sans-serif'%3EX%3C/text%3E%3C/svg%3E",
      );
    } else {
      document.title = '1000';
      setFavicon(
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23008000'/%3E%3Ctext x='8' y='12' font-size='9' text-anchor='middle' fill='white' font-family='sans-serif'%3E1K%3C/text%3E%3C/svg%3E",
      );
    }
  }, [hidden, ui.escapeTitle]);

  // ------------------------------------------------ меню

  const menus: MenuDef[] = [
    {
      title: 'Игра',
      entries: [
        { label: 'Новая партия', shortcut: 'F2', action: () => newGame(rules, ui) },
        {
          label: 'Продолжить',
          disabled: !savedRef.current,
          action: () => {
            const g = savedRef.current;
            if (g) {
              setState(g);
              setRules(g.rules);
            }
          },
        },
        { separator: true, label: '' },
        { label: 'Статистика', action: () => setDialog('stats') },
        { label: 'Переговорный пункт', action: () => setDialog('negotiation') },
        { separator: true, label: '' },
        {
          label: 'Закрыть игру',
          shortcut: 'Esc',
          action: () => setHidden(true),
        },
      ],
    },
    {
      title: 'Параметры',
      entries: [
        { label: 'Договорённости…', action: () => setDialog('rules') },
        { label: 'Настройки…', action: () => setDialog('settings') },
        {
          label: 'Звук',
          checked: ui.sound,
          action: () => setUi((u) => ({ ...u, sound: !u.sound })),
        },
        { label: 'Язык: Русский', disabled: true },
      ],
    },
    {
      title: 'Просмотр',
      entries: [
        { label: 'Договорённости', action: () => setDialog('rules') },
        { label: 'Статистика партии', action: () => setDialog('stats') },
        {
          label: 'Последняя взятка',
          action: () => setDialog('lastTrick'),
          disabled: !state.lastTrick,
        },
        { label: 'Последний прикуп', action: () => setDialog('lastTalon'), disabled: state.lastTalon.length === 0 },
        { separator: true, label: '' },
        {
          label: 'Повтор раздачи',
          action: () => setDialog('replay'),
          disabled: state.eventLog.length === 0 && state.lastRoundLog.length === 0,
        },
      ],
    },
    {
      title: 'Помощь',
      entries: [
        { label: 'Правила игры', action: () => setDialog('help') },
        { label: 'О программе', action: () => setDialog('about') },
      ],
    },
  ];

  // ------------------------------------------------ рендер

  if (hidden) {
    return (
      <div
        className="hidden-screen"
        onClick={() => setHidden(false)}
        title="Щёлкните или нажмите Escape, чтобы вернуться"
      >
        <div className="fake-menu">
          <span>Файл</span>
          <span>Правка</span>
          <span>Вид</span>
          <span>Вставка</span>
          <span>Формат</span>
          <span>Сервис</span>
          <span>Данные</span>
          <span>Окно</span>
          <span>Справка</span>
        </div>
        <div className="fake-grid" />
      </div>
    );
  }

  const names = state.players.map((p) => p.name);
  const replayLog = state.eventLog.length > 2 ? state.eventLog : state.lastRoundLog;

  return (
    <div className="app-root">
      <div className="app-scaler" style={{ transform: `scale(${scale})` }}>
        <div className="w98-window main-window">
          <div className="w98-titlebar">
            <GameIcon />
            <span className="w98-titlebar-text">1000</span>
            <div className="w98-titlebar-buttons">
              <button className="w98-sysbtn" title="Свернуть" onClick={() => setHidden(true)}>
                _
              </button>
              <button className="w98-sysbtn" title="Развернуть">
                ❐
              </button>
              <button className="w98-sysbtn" title="Спрятать (Esc)" onClick={() => setHidden(true)}>
                ✕
              </button>
            </div>
          </div>
          <MenuBar menus={menus} />
          <GameScreen
            state={state}
            ui={ui}
            handlers={handlers}
            extras={extras}
            debugRevealAll={revealAll}
          />

          {debug && (
            <DebugPanel
              state={state}
              setState={setState}
              revealAll={revealAll}
              setRevealAll={setRevealAll}
              onClose={() => setDebug(false)}
            />
          )}

          <div className="w98-modal-layer">
            {confirm && (
              <MessageBox
                title={confirm.title}
                text={confirm.text}
                icon={confirm.icon}
                okLabel={confirm.okLabel}
                cancelLabel={confirm.cancelLabel}
                onOk={confirm.onOk}
                onCancel={confirm.onCancel}
              />
            )}

            {dialog === 'continue' && (
              <MessageBox
                title="1000"
                icon="?"
                text="Найдена сохранённая партия. Продолжить игру?"
                okLabel="Продолжить"
                cancelLabel="Новая партия"
                onOk={() => {
                  const g = savedRef.current;
                  if (g) {
                    setState(g);
                    setRules(g.rules);
                  }
                  setDialog(null);
                }}
                onCancel={() => {
                  clearGame();
                  newGame(rules, ui);
                  setDialog(null);
                }}
              />
            )}

            {dialog === 'rules' && (
              <RulesDialog
                rules={rules}
                locked={state.roundNo > 1 || state.phase !== 'DEALING'}
                onCancel={() => setDialog(null)}
                onOk={(r) => {
                  setRules(r);
                  setDialog(null);
                  const structural =
                    r.playersCount !== state.rules.playersCount || r.goldenEnabled !== state.rules.goldenEnabled;
                  if (structural) {
                    setConfirm({
                      title: 'Договорённости',
                      icon: '?',
                      text: 'Изменения требуют новой партии. Начать новую партию?',
                      onOk: () => {
                        setConfirm(null);
                        newGame(r, ui);
                      },
                      onCancel: () => setConfirm(null),
                    });
                  } else {
                    // применяем к текущей партии на лету
                    setState((s) => ({ ...s, rules: r, players: s.players.map((p) => ({ ...p, aiLevel: r.aiLevel })) }));
                  }
                }}
              />
            )}

            {dialog === 'settings' && (
              <SettingsDialog
                ui={ui}
                onCancel={() => setDialog(null)}
                onOk={(u) => {
                  setUi(u);
                  setDialog(null);
                  setState((s) => {
                    const players = s.players.map((p) =>
                      p.isHuman ? { ...p, name: u.playerName || 'Игрок' } : p,
                    );
                    return { ...s, players };
                  });
                }}
              />
            )}

            {dialog === 'stats' && <StatsDialog stats={stats} onClose={() => setDialog(null)} />}

            {dialog === 'lastTrick' && (
              <CardsDialog
                title="Последняя взятка"
                cards={(state.lastTrick?.cards || []).map((c) => c.card)}
                labels={(state.lastTrick?.cards || []).map(
                  (c) => names[c.player] + (state.lastTrick?.winner === c.player ? ' ★' : ''),
                )}
                onClose={() => setDialog(null)}
                empty="В этом кону ещё не было взяток."
              />
            )}

            {dialog === 'lastTalon' && (
              <CardsDialog
                title="Последний прикуп"
                cards={state.lastTalon}
                onClose={() => setDialog(null)}
                empty="Прикуп ещё не открывался."
              />
            )}

            {dialog === 'replay' && (
              <ReplayDialog log={replayLog} names={names} onClose={() => setDialog(null)} />
            )}

            {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
            {dialog === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
            {dialog === 'negotiation' && (
              <NegotiationDialog names={names} onClose={() => setDialog(null)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function botDelay(phase: GameState['phase'], ui: UiSettings): number {
  if (ui.autoClick) return 80;
  switch (phase) {
    case 'BIDDING':
      return 520;
    case 'PLAYING_TRICK':
      return 420;
    case 'DISCARDING':
      return 380;
    case 'FINAL_CONTRACT':
      return 500;
    default:
      return 300;
  }
}

function setFavicon(href: string) {
  const link = document.getElementById('favicon') as HTMLLinkElement | null;
  if (link) link.href = href;
}

function GameIcon() {
  return (
    <svg className="w98-titlebar-icon" viewBox="0 0 16 16">
      <rect x="1" y="2" width="8" height="11" fill="#fff" stroke="#000" />
      <rect x="4" y="4" width="8" height="11" fill="#ffe" stroke="#000" />
      <text x="8" y="13" fontSize="8" fill="#c00000" textAnchor="middle">
        ♥
      </text>
    </svg>
  );
}
