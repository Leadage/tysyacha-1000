import React, { useEffect, useState } from 'react';
import { Button, Window } from '../Win98';
import { CardFace } from '../CardView';
import { GameStats, GameEvent, GameState, Trick } from '../../game/gameState';
import { avgContract, contractSuccess, winRate } from '../../game/stats';
import { CardId, MARRIAGE_VALUE, SUIT_NAME_RU, SUIT_SYMBOL, cardName } from '../../game/cards';
import { MARK_LEGEND } from '../ScoreTable';

// ------------------------------------------------------------ статистика

export function StatsDialog({ stats, onClose }: { stats: GameStats; onClose: () => void }) {
  const rows: [string, string | number][] = [
    ['Партий сыграно', stats.gamesPlayed],
    ['Побед', stats.wins],
    ['Поражений', stats.losses],
    ['Процент побед', winRate(stats) + '%'],
    ['Заказов сыграно', stats.contractsTaken],
    ['Средний заказ', avgContract(stats)],
    ['Максимальный заказ', stats.maxContract],
    ['Успешность заказов', contractSuccess(stats) + '%'],
    ['Марьяжей объявлено', stats.marriages],
    ['Тузовых марьяжей', stats.aceMarriages],
    ['Бочек', stats.barrels],
    ['Успешных выходов с бочки', stats.barrelWins],
    ['Слётов с бочки', stats.barrelFails],
    ['Болтов', stats.bolts],
    ['Росписей', stats.rospisi],
    ['Максимальный минус', stats.minScore],
  ];
  return (
    <Window title="Статистика" onClose={onClose} style={{ width: 340 }}>
      <div className="w98-dialog-body">
        <div className="w98-inset" style={{ background: '#fff', padding: 6, maxHeight: 320, overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: '2px 4px' }}>{k}</td>
                  <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 'bold' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </Window>
  );
}

// ------------------------------------------------------------ карты (взятка/прикуп)

export function CardsDialog({
  title,
  cards,
  labels,
  onClose,
  empty,
}: {
  title: string;
  cards: CardId[];
  labels?: string[];
  onClose: () => void;
  empty?: string;
}) {
  return (
    <Window title={title} onClose={onClose} style={{ minWidth: 300 }}>
      <div className="w98-dialog-body">
        {cards.length === 0 ? (
          <div style={{ fontSize: 12, padding: 20 }}>{empty || 'Пока нечего показать.'}</div>
        ) : (
          <div style={{ display: 'flex', gap: 10, padding: '6px 4px' }}>
            {cards.map((c, i) => (
              <div key={c + i} style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 84, height: 114 }}>
                  <CardFace card={c} width={84} style={{ position: 'absolute', left: 0, top: 0 }} />
                </div>
                {labels && <div style={{ fontSize: 11, marginTop: 3 }}>{labels[i]}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </Window>
  );
}

// ------------------------------------------------------------ повтор раздачи

function describe(e: GameEvent, names: string[]): string | null {
  switch (e.t) {
    case 'newRound': {
      const parts = Object.keys(e.hands).map(
        (k) => `${names[Number(k)]}: ${e.hands[Number(k)].map(cardName).join(' ')}`,
      );
      return (
        `── Кон ${e.round}${e.golden ? ' (золотой)' : ''}. Раздаёт ${names[e.dealer]}\n` +
        parts.join('\n') +
        `\nПрикуп: ${e.talon.map(cardName).join(' ')}` +
        (e.talonSitter !== null ? `\nНа прикупе: ${names[e.talonSitter]}` : '')
      );
    }
    case 'redeal':
      return `${names[e.player]} требует пересдачу`;
    case 'dark':
      return `${names[e.player]} играет ВТЁМНУЮ`;
    case 'bid':
      return `${names[e.player]}: ${e.value === null ? 'пас' : e.value}`;
    case 'talon':
      return `Прикуп ${e.revealed ? 'открыт' : 'закрыт'}: ${e.cards.map(cardName).join(' ')}`;
    case 'discard':
      return `${names[e.from]} сносит ${cardName(e.card)} → ${names[e.to]}`;
    case 'contract':
      return `${names[e.player]} играет ${e.value}`;
    case 'rospis':
      return `${names[e.player]} расписывает`;
    case 'play':
      return (
        `${names[e.player]} ходит ${cardName(e.card)}` +
        (e.marriage === undefined
          ? ''
          : e.marriage === null
            ? ' — ТУЗОВЫЙ МАРЬЯЖ +200'
            : ` — МАРЬЯЖ ${SUIT_NAME_RU[e.marriage]} +${MARRIAGE_VALUE[e.marriage]}`)
      );
    case 'trick':
      return `  взятку берёт ${names[e.winner]}`;
    case 'score': {
      const parts = Object.keys(e.delta).map(
        (k) =>
          `${names[Number(k)]}: ${e.delta[Number(k)] >= 0 ? '+' : ''}${e.delta[Number(k)]} → ${e.totals[Number(k)]}` +
          ((e.marks[Number(k)] || []).length ? ` [${(e.marks[Number(k)] || []).join('')}]` : ''),
      );
      return `── Итог кона:\n` + parts.join('\n');
    }
    case 'gameOver':
      return `ПАРТИЯ ОКОНЧЕНА. Победил ${names[e.winner]}`;
    default:
      return null;
  }
}

export function ReplayDialog({
  log,
  names,
  onClose,
}: {
  log: GameEvent[];
  names: string[];
  onClose: () => void;
}) {
  const lines = log.map((e) => describe(e, names)).filter((x): x is string => x !== null);
  const [shown, setShown] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 320);
    return () => clearTimeout(t);
  }, [auto, shown, lines.length]);

  return (
    <Window title="Повтор раздачи" onClose={onClose} style={{ width: 470 }}>
      <div className="w98-dialog-body">
        <div
          className="w98-inset w98-scroll"
          style={{ background: '#fff', height: 300, padding: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}
        >
          {lines.slice(0, shown).map((l, i) => (
            <div key={i} style={{ marginBottom: 2, fontFamily: 'Courier New, monospace' }}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
          <Button onClick={() => setAuto((a) => !a)}>{auto ? 'Пауза' : 'Пуск'}</Button>
          <Button onClick={() => setShown((s) => Math.min(lines.length, s + 1))}>Шаг</Button>
          <Button onClick={() => setShown(lines.length)}>Всё</Button>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </Window>
  );
}

// ------------------------------------------------------------ помощь

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Window title="Правила игры" onClose={onClose} style={{ width: 520 }}>
      <div className="w98-dialog-body">
        <div
          className="w98-inset w98-scroll"
          style={{ background: '#fff', height: 340, padding: 10, fontSize: 12, lineHeight: 1.5 }}
        >
          <b>Тысяча</b>
          <p>
            Колода 24 карты. Старшинство: 9 &lt; В &lt; Д &lt; К &lt; 10 &lt; Т. Стоимость: 9 — 0, В — 2, Д — 3,
            К — 4, 10 — 10, Т — 11. Всего в колоде 120 очков.
          </p>
          <p>
            Каждому по 7 карт, 3 — в прикуп. Идёт торговля начиная со 100 с шагом 5. Без марьяжа на руках нельзя
            торговаться выше 120. Победитель торгов берёт прикуп, отдаёт по одной карте каждому сопернику и
            объявляет окончательный заказ (не меньше выигранной ставки).
          </p>
          <p>
            Розыгрыш: обязательно ходить в масть, при её отсутствии — козырем, иначе любой картой. Марьяж
            (король + дама одной масти) объявляется при ходе первым: пики 40, трефы 60, бубны 80, червы 100.
            Объявленная масть становится козырной.
          </p>
          <p>
            Выполнил заказ — получаешь ровно его величину, не выполнил — вычитается. Очки соперников округляются
            до кратного пяти. При 880 очках игрок садится на бочку: выйти можно только выиграв свою игру.
          </p>
          <p>
            Все дополнительные договорённости (бочка, болты, росписи, самосвал, золотой кон, игра втёмную,
            тузовый марьяж) включаются в меню «Параметры → Договорённости».
          </p>
          <b>Обозначения в таблице</b>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {Object.entries(MARK_LEGEND).map(([k, v]) => (
              <li key={k}>
                <b>{k}</b> — {v}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </Window>
  );
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Window title="О программе" onClose={onClose} style={{ width: 330 }}>
      <div className="w98-dialog-body" style={{ fontSize: 12, lineHeight: 1.6 }}>
        <p>
          <b>Тысяча (1000)</b>
          <br />
          Браузерная реконструкция классической игры для Windows.
        </p>
        <p>Полная реализация правил, договорённостей и компьютерных соперников.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>OK</Button>
        </div>
      </div>
    </Window>
  );
}

// ------------------------------------------------------------ переговорный пункт

const PHRASES = [
  'Остальные взятки мои',
  'Ход ваш',
  'Красиво сыграно!',
  'Ну и прикуп...',
  'Я пас',
  'Придётся расписать',
  'Сажусь на бочку',
  'Не повезло',
];

export function NegotiationDialog({
  names,
  onClose,
}: {
  names: string[];
  onClose: () => void;
}) {
  const [log, setLog] = useState<string[]>([]);
  return (
    <Window title="Переговорный пункт" onClose={onClose} style={{ width: 400 }}>
      <div className="w98-dialog-body">
        <div className="w98-inset w98-scroll" style={{ background: '#fff', height: 180, padding: 6, fontSize: 12 }}>
          {log.length === 0 ? <i>Скажите что-нибудь соперникам.</i> : log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
          {PHRASES.map((p) => (
            <Button
              key={p}
              onClick={() =>
                setLog((l) => [
                  ...l,
                  `${names[0]}: ${p}`,
                  `${names[1 + Math.floor(Math.random() * (names.length - 1))]}: ${
                    PHRASES[Math.floor(Math.random() * PHRASES.length)]
                  }`,
                ])
              }
            >
              {p}
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </Window>
  );
}
