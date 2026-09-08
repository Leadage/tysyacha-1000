import React, { useMemo } from 'react';
import { CardId, MARRIAGE_VALUE, SUIT_NAME_RU_ADJ, SUIT_SYMBOL, rankOf, sortHand, suitOf } from '../game/cards';
import { GameState } from '../game/gameState';
import { UiSettings } from '../game/settings';
import { CardBack, CardFace, CardSlot } from '../components/CardView';
import { Portrait } from '../components/Portrait';
import { Bubble, InfoBox } from '../components/TableParts';
import { RoundTable, ScoreTable } from '../components/ScoreTable';
import {
  CARD_TABLE_W,
  HAND_OFFSET,
  L,
  PLAYER_HAND_OFFSET,
  Seat,
  TABLE_H,
  TABLE_W,
  seatCardPos,
} from '../components/layout';
import { Button } from '../components/Win98';
import { canDeclareMarriage, declarableMarriageSuits, legalCards } from '../game/legalMoves';
import { currentPlayerToMove, playableCards } from '../game/gameEngine';

export interface ScreenHandlers {
  onCardClick: (card: CardId) => void;
  onGiveTo: (player: number) => void;
  onBid: (v: number | null) => void;
  onSetContract: (v: number) => void;
  onRospis: () => void;
  onAdvance: () => void;
  onReplay: () => void;
  onNewGame: () => void;
}

export interface ScreenExtras {
  selectedCard: CardId | null;
  bidValue: number;
  setBidValue: (v: number) => void;
  allowedBids: number[];
  allowedContracts: number[];
  showRospis: boolean;
  humanIsActor: boolean;
}

/** Определяет, за каким местом стола сидит игрок. */
export function seatOf(state: GameState, player: number): Seat | 'out' {
  const r = state.round;
  if (!r) return 'out';
  if (!r.participants.includes(player)) return 'out';
  const human = 0;
  if (r.participants.includes(human)) {
    if (player === human) return 'bottom';
    const others = r.participants.filter((p) => p !== human);
    return player === others[0] ? 'left' : 'right';
  }
  // человек сидит на прикупе — три бота по местам
  const idx = r.participants.indexOf(player);
  return (['left', 'bottom', 'right'] as Seat[])[idx];
}

export function GameScreen({
  state,
  ui,
  handlers,
  extras,
  debugRevealAll,
}: {
  state: GameState;
  ui: UiSettings;
  handlers: ScreenHandlers;
  extras: ScreenExtras;
  debugRevealAll: boolean;
}) {
  const r = state.round;
  const human = 0;

  const bg: React.CSSProperties = {
    background: ui.backgroundImage ? `url(${ui.backgroundImage})` : ui.tableColor,
    backgroundColor: ui.tableColor,
  };

  const seats = useMemo(() => {
    const m: Record<number, Seat | 'out'> = {};
    for (const p of state.players) m[p.index] = seatOf(state, p.index);
    return m;
  }, [state]);

  const leftPlayer = state.players.find((p) => seats[p.index] === 'left');
  const rightPlayer = state.players.find((p) => seats[p.index] === 'right');
  const bottomPlayer = state.players.find((p) => seats[p.index] === 'bottom');
  const outPlayer = state.players.find((p) => seats[p.index] === 'out');

  const humanPlays = r ? r.participants.includes(human) : false;
  const bottomIsHuman = bottomPlayer?.index === human;

  return (
    <div className="table" style={bg}>
      {/* --- руки соперников --- */}
      {leftPlayer && r && (
        <HandRow
          cards={r.hands[leftPlayer.index] || []}
          x={L.leftHand.x}
          y={L.leftHand.y}
          faceUp={debugRevealAll}
        />
      )}
      {rightPlayer && r && (
        <HandRow
          cards={r.hands[rightPlayer.index] || []}
          x={
            TABLE_W -
            8 -
            (CARD_TABLE_W + Math.max(0, (r.hands[rightPlayer.index] || []).length - 1) * HAND_OFFSET)
          }
          y={L.rightHandRight.y}
          faceUp={debugRevealAll}
        />
      )}

      {/* --- портреты соперников --- */}
      {leftPlayer && (
        <Portrait
          src={`characters/${portraitFile(leftPlayer.index)}`}
          name={leftPlayer.name}
          x={L.portraitLeft.x}
          y={L.portraitLeft.y}
          width={L.portraitLeft.w}
          height={L.portraitLeft.h}
        />
      )}
      {rightPlayer && (
        <Portrait
          src={`characters/${portraitFile(rightPlayer.index)}`}
          name={rightPlayer.name}
          x={L.portraitRight.x}
          y={L.portraitRight.y}
          width={L.portraitRight.w}
          height={L.portraitRight.h}
        />
      )}

      {/* --- центр: прикуп или взятка --- */}
      <CenterArea state={state} seats={seats} debugRevealAll={debugRevealAll} />

      {/* --- таблицы --- */}
      <ScoreTable
        state={state}
        x={L.scoreTable.x}
        y={L.scoreTable.y}
        width={L.scoreTable.w}
        showLegend={ui.showTableLegend}
      />
      <RoundTable state={state} x={L.roundTable.x} y={L.roundTable.y} />

      {/* --- козырь --- */}
      {r && r.trump && (
        <div className="trump-badge" style={{ left: L.trumpBadge.x, top: L.trumpBadge.y }}>
          Козырь:{' '}
          <span style={{ color: r.trump === 'D' || r.trump === 'H' ? '#c00000' : '#000' }}>
            {SUIT_SYMBOL[r.trump]}
          </span>{' '}
          {SUIT_NAME_RU_ADJ[r.trump]}
        </div>
      )}
      {r && !r.trump && (state.phase === 'PLAYING_TRICK' || state.phase === 'TRICK_RESULT') && (
        <div className="trump-badge" style={{ left: L.trumpBadge.x, top: L.trumpBadge.y }}>
          Козыря нет
        </div>
      )}

      {/* --- информационное окно --- */}
      <InfoBox text={infoText(state, extras.humanIsActor)} x={L.infoBox.x} y={L.infoBox.y} />

      {/* --- реплики торговли --- */}
      <Bubbles state={state} seats={seats} />

      {/* --- рука игрока --- */}
      {bottomPlayer && r && (
        <PlayerHand
          state={state}
          player={bottomPlayer.index}
          faceUp={bottomIsHuman || debugRevealAll}
          selected={extras.selectedCard}
          onCardClick={handlers.onCardClick}
        />
      )}

      {/* --- портрет снизу слева: сидящий на прикупе либо сам игрок --- */}
      <Portrait
        src={`characters/${outPlayer ? portraitFile(outPlayer.index) : 'player.png'}`}
        name={outPlayer ? outPlayer.name : state.players[human].name}
        x={L.playerPortrait.x}
        y={L.playerPortrait.y}
        width={L.playerPortrait.w}
        height={L.playerPortrait.h}
        showName={false}
      />
      <div className="big-label" style={{ left: L.bottomName.x, top: L.bottomName.y }}>
        {outPlayer ? outPlayer.name : state.players[human].name}
      </div>
      {outPlayer && (
        <div
          className="big-label"
          style={{ left: L.bottomName.x - 12, top: L.bottomName.y + 24, fontSize: 13 }}
        >
          на прикупе
        </div>
      )}

      {/* --- кнопки действий --- */}
      <ActionPanel state={state} ui={ui} handlers={handlers} extras={extras} />

      {/* --- флажок языка (как в оригинале) --- */}
      <div className="flag-box" title="Русский">
        <span
          className="flag"
          style={{
            background: 'linear-gradient(#fff 0 33%, #0039a6 33% 66%, #d52b1e 66% 100%)',
          }}
        />
        <span className="arrow">▼</span>
      </div>
    </div>
  );
}

/** Текст информационного окна — в духе оригинала. */
function infoText(state: GameState, humanIsActor: boolean): string {
  switch (state.phase) {
    case 'GAME_OVER':
      return state.winner !== null ? `Победил\n${state.players[state.winner].name}` : 'Партия окончена';
    case 'TRICK_RESULT':
    case 'ROUND_END':
    case 'TALON_REVEAL':
      return 'Нажмите кнопку мыши';
    case 'ROUND_SCORING':
      return 'Подсчёт очков';
    case 'DEALING':
      return 'Раздача';
    default:
      break;
  }
  if (!humanIsActor) return 'Думаю';
  switch (state.phase) {
    case 'BIDDING':
      return 'Выберите ставку';
    case 'DISCARDING':
      return 'Выберите две карты для сноса';
    case 'FINAL_CONTRACT':
      return 'Ваш окончательный заказ';
    case 'PLAYING_TRICK':
      return 'Ваш ход';
    case 'REDEAL_DECISION':
    case 'TALON_REDEAL_DECISION':
      return 'Пересдача?';
    case 'DARK_GAME_DECISION':
      return 'Играть втёмную?';
    default:
      return state.message;
  }
}

function portraitFile(index: number): string {
  return ['player.png', 'left.png', 'right.png', 'fourth.png'][index] || 'left.png';
}

// ------------------------------------------------------------------ рука

function HandRow({
  cards,
  x,
  y,
  faceUp,
}: {
  cards: CardId[];
  x: number;
  y: number;
  faceUp: boolean;
}) {
  const sorted = faceUp ? sortHand(cards) : cards;
  return (
    <div className="hand" style={{ left: x, top: y, width: CARD_TABLE_W + cards.length * HAND_OFFSET }}>
      {sorted.map((c, i) =>
        faceUp ? (
          <CardFace key={c} card={c} width={CARD_TABLE_W} style={{ left: i * HAND_OFFSET, top: 0 }} />
        ) : (
          <CardBack key={i} width={CARD_TABLE_W} style={{ left: i * HAND_OFFSET, top: 0 }} />
        ),
      )}
    </div>
  );
}

function PlayerHand({
  state,
  player,
  faceUp,
  selected,
  onCardClick,
}: {
  state: GameState;
  player: number;
  faceUp: boolean;
  selected: CardId | null;
  onCardClick: (c: CardId) => void;
}) {
  const r = state.round!;
  const cards = sortHand(r.hands[player] || []);
  const width = CARD_TABLE_W + Math.max(0, cards.length - 1) * PLAYER_HAND_OFFSET;
  const x = Math.round((TABLE_W - width) / 2);
  const isHuman = state.players[player].isHuman;

  const playable = isHuman ? playableCards(state, player) : [];
  const discardMode = isHuman && state.phase === 'DISCARDING' && r.contractPlayer === player;

  return (
    <div className="hand" data-hand="player" style={{ left: x, top: L.playerHand.y, width }}>
      {cards.map((c, i) => {
        const can = discardMode || playable.includes(c);
        const isSel = selected === c;
        if (!faceUp) {
          return <CardBack key={i} width={CARD_TABLE_W} style={{ left: i * PLAYER_HAND_OFFSET, top: 0 }} />;
        }
        return (
          <CardFace
            key={c}
            card={c}
            data-card={c}
            width={CARD_TABLE_W}
            className={`player-card${can ? ' playable clickable' : ''}`}
            style={{
              left: i * PLAYER_HAND_OFFSET,
              top: isSel ? -16 : 0,
              cursor: can ? 'pointer' : 'default',
            }}
            dim={isHuman && !can && (state.phase === 'PLAYING_TRICK' || state.phase === 'DISCARDING')}
            highlight={isSel}
            onClick={() => can && onCardClick(c)}
          />
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ центр

function CenterArea({
  state,
  seats,
  debugRevealAll,
}: {
  state: GameState;
  seats: Record<number, Seat | 'out'>;
  debugRevealAll: boolean;
}) {
  const r = state.round;
  if (!r) return null;

  const showTalon =
    state.phase === 'TALON_REVEAL' ||
    state.phase === 'TALON_REDEAL_DECISION' ||
    state.phase === 'DEALING' ||
    state.phase === 'REDEAL_DECISION' ||
    state.phase === 'DARK_GAME_DECISION' ||
    state.phase === 'BIDDING';

  if (showTalon) {
    const revealed =
      debugRevealAll ||
      (state.phase !== 'BIDDING' &&
        state.phase !== 'DEALING' &&
        state.phase !== 'REDEAL_DECISION' &&
        state.phase !== 'DARK_GAME_DECISION' &&
        (r.talonRevealed || r.contractPlayer === 0));
    const positions: Seat[] = ['left', 'right', 'bottom'];
    return (
      <>
        {r.talon.map((c, i) => {
          const p = seatCardPos(positions[i]);
          return revealed ? (
            <CardFace key={c} card={c} width={CARD_TABLE_W} style={{ left: p.x, top: p.y }} />
          ) : (
            <CardSlot key={i} width={CARD_TABLE_W} style={{ position: 'absolute', left: p.x, top: p.y }} />
          );
        })}
      </>
    );
  }

  const trick = r.currentTrick;
  if (!trick) return null;
  return (
    <>
      {trick.cards.map((tc) => {
        const seat = seats[tc.player];
        const p = seatCardPos(seat === 'out' ? 'bottom' : seat);
        const isWinner = trick.winner === tc.player;
        return (
          <CardFace
            key={tc.card}
            card={tc.card}
            width={CARD_TABLE_W}
            style={{ left: p.x, top: p.y, zIndex: 5 }}
            highlight={state.phase === 'TRICK_RESULT' && isWinner}
          />
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ реплики

function Bubbles({ state, seats }: { state: GameState; seats: Record<number, Seat | 'out'> }) {
  const r = state.round;
  if (!r) return null;
  const showPhases = ['BIDDING', 'DARK_GAME_DECISION', 'TALON_REVEAL', 'TALON_REDEAL_DECISION'];
  if (!showPhases.includes(state.phase)) return null;

  const last: Record<number, { text: string; dark: boolean }> = {};
  for (const b of r.bids) {
    last[b.player] = { text: b.value === null ? 'Пас' : String(b.value), dark: !!b.dark };
  }
  const items: React.ReactNode[] = [];
  for (const p of r.participants) {
    const e = last[p];
    if (!e) continue;
    const seat = seats[p];
    if (seat === 'left') {
      items.push(<Bubble key={p} text={e.text} x={L.bubbleLeft.x} y={L.bubbleLeft.y} dark={e.dark} />);
    } else if (seat === 'right') {
      items.push(<Bubble key={p} text={e.text} x={L.bubbleRight.x} y={L.bubbleRight.y} dark={e.dark} />);
    } else {
      items.push(
        <Bubble key={p} text={e.text} x={L.bubbleBottom.x} y={L.bubbleBottom.y} tail="down-left" dark={e.dark} />,
      );
    }
  }
  return <>{items}</>;
}

// ------------------------------------------------------------------ кнопки

function ActionPanel({
  state,
  ui,
  handlers,
  extras,
}: {
  state: GameState;
  ui: UiSettings;
  handlers: ScreenHandlers;
  extras: ScreenExtras;
}) {
  const r = state.round;
  const style: React.CSSProperties = { left: L.buttons.x, top: L.buttons.y };

  if (state.phase === 'BIDDING' && extras.humanIsActor) {
    const canBid = extras.allowedBids.length > 0;
    return (
      <div className="table-buttons" style={style}>
        <div
          className="w98-outset"
          style={{ padding: 6, display: 'flex', gap: 6, alignItems: 'center' }}
        >
          <Button onClick={() => handlers.onBid(null)}>Пас</Button>
          {canBid && (
            <>
              <Button
                small
                onClick={() =>
                  extras.setBidValue(prevBid(extras.allowedBids, extras.bidValue))
                }
              >
                −
              </Button>
              <div
                className="w98-thin-inset"
                style={{
                  width: 52,
                  textAlign: 'center',
                  background: '#fff',
                  padding: '3px 0',
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              >
                {extras.bidValue}
              </div>
              <Button
                small
                onClick={() => extras.setBidValue(nextBid(extras.allowedBids, extras.bidValue))}
              >
                +
              </Button>
              <Button onClick={() => handlers.onBid(extras.bidValue)}>Заказ</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'DISCARDING' && extras.humanIsActor && r) {
    const opponents = r.participants.filter(
      (p) => p !== r.contractPlayer && r.discardedTo[p] === undefined,
    );
    return (
      <div className="table-buttons" style={style}>
        <div className="w98-outset" style={{ padding: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          {extras.selectedCard ? (
            opponents.map((p) => (
              <Button key={p} onClick={() => handlers.onGiveTo(p)}>
                {state.players[p].name} ←
              </Button>
            ))
          ) : (
            <span style={{ fontSize: 12, padding: '0 6px' }}>Выберите карту для сноса</span>
          )}
          {extras.showRospis && <Button onClick={handlers.onRospis}>Расписать</Button>}
        </div>
      </div>
    );
  }

  if (state.phase === 'FINAL_CONTRACT' && extras.humanIsActor && r) {
    return (
      <div className="table-buttons" style={style}>
        <div className="w98-outset" style={{ padding: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12 }}>Заказ:</span>
          <Button small onClick={() => extras.setBidValue(prevBid(extras.allowedContracts, extras.bidValue))}>
            −
          </Button>
          <div
            className="w98-thin-inset"
            style={{ width: 52, textAlign: 'center', background: '#fff', padding: '3px 0', fontSize: 14, fontWeight: 'bold' }}
          >
            {extras.bidValue}
          </div>
          <Button small onClick={() => extras.setBidValue(nextBid(extras.allowedContracts, extras.bidValue))}>
            +
          </Button>
          <Button onClick={() => handlers.onSetContract(extras.bidValue)}>Играю</Button>
          {extras.showRospis && <Button onClick={handlers.onRospis}>Расписать</Button>}
        </div>
      </div>
    );
  }

  if (state.phase === 'TRICK_RESULT' || state.phase === 'ROUND_END' || state.phase === 'TALON_REVEAL') {
    return (
      <div className="table-buttons" style={{ left: 22, top: 452 }}>
        <Button onClick={handlers.onAdvance}>Дальше</Button>
        {state.phase === 'ROUND_END' && ui.showReplayButton && (
          <Button onClick={handlers.onReplay}>Повтор</Button>
        )}
      </div>
    );
  }

  if (state.phase === 'GAME_OVER') {
    return (
      <div className="table-buttons" style={{ left: 22, top: 452 }}>
        <Button onClick={handlers.onNewGame}>Новая партия</Button>
        {ui.showReplayButton && <Button onClick={handlers.onReplay}>Повтор</Button>}
      </div>
    );
  }

  return null;
}

function nextBid(list: number[], cur: number): number {
  const i = list.indexOf(cur);
  if (i < 0) return list[0] ?? cur;
  return list[Math.min(list.length - 1, i + 1)];
}

function prevBid(list: number[], cur: number): number {
  const i = list.indexOf(cur);
  if (i < 0) return list[0] ?? cur;
  return list[Math.max(0, i - 1)];
}
