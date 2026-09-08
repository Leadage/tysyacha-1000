import React from 'react';
import { GameState } from '../game/gameState';

export const MARK_LEGEND: Record<string, string> = {
  Z: 'Самосвал: счёт сброшен на ноль',
  D: 'Двойной результат (тёмная или золотой кон)',
  R: 'Роспись',
  O: 'Сброс на ноль после трёх бочек',
  '-': 'Болт: не взято ни одной взятки',
  '#': 'Игрок сидел на прикупе',
  B: 'Игрок сел на бочку',
  '↓': 'Слёт с бочки со штрафом',
  '!': 'Штраф за болты',
  W: 'Победа',
};

/** Большая таблица общего счёта партии (правая сторона стола). */
export function ScoreTable({
  state,
  x,
  y,
  width,
  rows = 12,
  showLegend,
}: {
  state: GameState;
  x: number;
  y: number;
  width: number;
  rows?: number;
  showLegend: boolean;
}) {
  const players = state.players;
  const history = state.history;
  const shown = history.slice(Math.max(0, history.length - rows));
  const blanks = Math.max(0, rows - shown.length - 1);

  return (
    <div className="score-table" style={{ left: x, top: y, width }}>
      <table>
        <thead>
          <tr>
            {players.map((p) => (
              <th key={p.index} title={p.name}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {players.map((p) => (
              <td key={p.index} className="cur" title="Текущий счёт">
                {p.total}
                {p.onBarrel ? ' ●' : ''}
              </td>
            ))}
          </tr>
          {shown.map((h, i) => (
            <tr key={i}>
              {players.map((p) => {
                const marks = (h.marks[p.index] || []).filter((m) => m !== 'W');
                const d = h.delta[p.index] ?? 0;
                const title = marks.length
                  ? marks.map((m) => MARK_LEGEND[m] || m).join('; ')
                  : `Кон ${h.roundNo}: ${d >= 0 ? '+' : ''}${d}`;
                return (
                  <td key={p.index} className={d < 0 ? 'neg' : ''} title={title}>
                    {showLegend && marks.length > 0 && <span className="mark">{marks.join('')}</span>}
                    {h.totals[p.index]}
                  </td>
                );
              })}
            </tr>
          ))}
          {Array.from({ length: blanks }).map((_, i) => (
            <tr key={'b' + i}>
              {players.map((p) => (
                <td key={p.index}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Маленькая таблица текущего кона (левая сторона стола). */
export function RoundTable({
  state,
  x,
  y,
}: {
  state: GameState;
  x: number;
  y: number;
}) {
  const r = state.round;
  const players = state.players;
  return (
    <div className="round-table" style={{ left: x, top: y }}>
      <table>
        <thead>
          <tr>
            {players.map((p) => (
              <th key={p.index}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {players.map((p) => {
              if (!r) return <td key={p.index}>0</td>;
              if (!r.participants.includes(p.index))
                return (
                  <td key={p.index} title="Сидит на прикупе">
                    #
                  </td>
                );
              const pts = (r.cardPoints[p.index] || 0) + (r.marriagePoints[p.index] || 0);
              if (p.isHuman) {
                // как в оригинале: в своей колонке — число оставшихся взяток
                const left = 8 - r.tricks.length;
                return (
                  <td key={p.index} title={`Ваши очки в кону: ${pts}`}>
                    ({left})
                  </td>
                );
              }
              return <td key={p.index}>{pts}</td>;
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
