import React, { useState } from 'react';
import { Button, Checkbox, Window } from '../components/Win98';
import { GameState } from '../game/gameState';
import { CardId, SUITS, Suit, sortHand } from '../game/cards';
import { clone } from '../game/gameEngine';

/**
 * Отладочная панель (Ctrl+Shift+D) — служит только для проверки правил.
 */
export function DebugPanel({
  state,
  setState,
  revealAll,
  setRevealAll,
  onClose,
}: {
  state: GameState;
  setState: (s: GameState) => void;
  revealAll: boolean;
  setRevealAll: (v: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'tools' | 'state' | 'log'>('tools');
  const [scores, setScores] = useState<string>(state.players.map((p) => p.total).join(', '));

  function patch(fn: (s: GameState) => void) {
    const s = clone(state);
    fn(s);
    setState(s);
  }

  function giveMarriage(player: number, suit: Suit) {
    patch((s) => {
      const r = s.round;
      if (!r || !r.hands[player]) return;
      const hand = r.hands[player];
      const want: CardId[] = ['K' + suit, 'Q' + suit];
      for (const w of want) {
        if (hand.includes(w)) continue;
        // забираем карту у того, у кого она есть
        for (const p of r.participants) {
          const i = r.hands[p].indexOf(w);
          if (i >= 0) {
            r.hands[p].splice(i, 1);
            const give = hand.pop()!;
            r.hands[p].push(give);
            break;
          }
        }
        const ti = r.talon.indexOf(w);
        if (ti >= 0) {
          r.talon.splice(ti, 1);
          r.talon.push(hand.pop()!);
        }
        if (!hand.includes(w)) hand.push(w);
      }
      r.hands[player] = sortHand(hand);
    });
  }

  function giveFourAces(player: number) {
    patch((s) => {
      const r = s.round;
      if (!r || !r.hands[player]) return;
      for (const suit of SUITS) {
        const ace = 'A' + suit;
        if (r.hands[player].includes(ace)) continue;
        for (const p of r.participants) {
          const i = r.hands[p].indexOf(ace);
          if (i >= 0) {
            r.hands[p].splice(i, 1);
            r.hands[p].push(r.hands[player].pop()!);
            break;
          }
        }
        const ti = r.talon.indexOf(ace);
        if (ti >= 0) {
          r.talon.splice(ti, 1);
          r.talon.push(r.hands[player].pop()!);
        }
        if (!r.hands[player].includes(ace)) r.hands[player].push(ace);
      }
      r.hands[player] = sortHand(r.hands[player]);
    });
  }

  return (
    <div className="debug-panel">
      <Window title="Debug (Ctrl+Shift+D)" onClose={onClose}>
        <div style={{ display: 'flex', gap: 2, padding: '4px 4px 0' }}>
          <Button small onClick={() => setTab('tools')}>
            Инструменты
          </Button>
          <Button small onClick={() => setTab('state')}>
            State
          </Button>
          <Button small onClick={() => setTab('log')}>
            Log
          </Button>
        </div>
        <div className="w98-dialog-body" style={{ padding: 6 }}>
          {tab === 'tools' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Checkbox checked={revealAll} onChange={setRevealAll} label="Показать карты всех игроков" />

              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11 }}>Счёт:</span>
                <input
                  className="w98-input"
                  style={{ flex: 1 }}
                  value={scores}
                  onChange={(e) => setScores(e.target.value)}
                />
                <Button
                  small
                  onClick={() =>
                    patch((s) => {
                      const parts = scores.split(',').map((x) => Number(x.trim()));
                      s.players.forEach((p, i) => {
                        if (!Number.isNaN(parts[i])) p.total = parts[i];
                      });
                    })
                  }
                >
                  OK
                </Button>
              </div>

              <div style={{ fontSize: 11, marginTop: 4 }}>Посадить на бочку:</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {state.players.map((p) => (
                  <Button
                    key={p.index}
                    small
                    onClick={() =>
                      patch((s) => {
                        s.players[p.index].total = s.rules.barrelScore;
                        s.players[p.index].onBarrel = true;
                        s.players[p.index].barrelAttemptsUsed = 0;
                      })
                    }
                  >
                    {p.name}
                  </Button>
                ))}
              </div>

              <div style={{ fontSize: 11, marginTop: 4 }}>Дать марьяж игроку (вы):</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {SUITS.map((s) => (
                  <Button key={s} small onClick={() => giveMarriage(0, s)}>
                    {s === 'S' ? '♠' : s === 'C' ? '♣' : s === 'D' ? '♦' : '♥'}
                  </Button>
                ))}
                <Button small onClick={() => giveFourAces(0)}>
                  4 туза
                </Button>
              </div>

              <div style={{ fontSize: 11, marginTop: 4 }}>Прочее:</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Button
                  small
                  onClick={() =>
                    patch((s) => {
                      if (s.round) s.round.trump = 'H';
                    })
                  }
                >
                  Козырь ♥
                </Button>
                <Button
                  small
                  onClick={() =>
                    patch((s) => {
                      s.players.forEach((p) => {
                        p.boltsStreak = 2;
                        p.boltsTotal = 2;
                      });
                    })
                  }
                >
                  2 болта всем
                </Button>
                <Button
                  small
                  onClick={() =>
                    patch((s) => {
                      s.players[0].total = s.rules.dumpScore - 100;
                    })
                  }
                >
                  Счёт к самосвалу
                </Button>
              </div>

              <div style={{ fontSize: 10, marginTop: 6, color: '#404040' }}>
                Фаза: <b>{state.phase}</b>; кон {state.roundNo}; козырь {state.round?.trump || '—'};
                заказ {state.round?.contract}
              </div>
            </div>
          )}

          {tab === 'state' && <pre>{JSON.stringify(stripped(state), null, 1)}</pre>}
          {tab === 'log' && <pre>{state.eventLog.map((e) => JSON.stringify(e)).join('\n')}</pre>}
        </div>
      </Window>
    </div>
  );
}

function stripped(s: GameState) {
  return {
    phase: s.phase,
    roundNo: s.roundNo,
    dealer: s.dealer,
    winner: s.winner,
    players: s.players.map((p) => ({
      name: p.name,
      total: p.total,
      onBarrel: p.onBarrel,
      bolts: p.boltsMarks,
      rospis: p.rospisCount,
    })),
    round: s.round && {
      participants: s.round.participants,
      contractPlayer: s.round.contractPlayer,
      contract: s.round.contract,
      trump: s.round.trump,
      tricksWon: s.round.tricksWon,
      cardPoints: s.round.cardPoints,
      marriagePoints: s.round.marriagePoints,
      hands: s.round.hands,
      talon: s.round.talon,
    },
  };
}
