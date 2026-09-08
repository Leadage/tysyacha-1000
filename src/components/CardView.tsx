import React from 'react';
import { CardId, RANK_LABEL, SUIT_SYMBOL, Rank, Suit, isRed, rankOf, suitOf } from '../game/cards';

export const CARD_W = 84;
export const CARD_H = 114;

/** Позиции пипсов для числовых карт (в долях области 20..78 × 8..106). */
const PIP_LAYOUT: Record<string, [number, number][]> = {
  '9': [
    [0.25, 0.1],
    [0.75, 0.1],
    [0.25, 0.32],
    [0.75, 0.32],
    [0.5, 0.5],
    [0.25, 0.68],
    [0.75, 0.68],
    [0.25, 0.9],
    [0.75, 0.9],
  ],
  T: [
    [0.25, 0.08],
    [0.75, 0.08],
    [0.5, 0.24],
    [0.25, 0.36],
    [0.75, 0.36],
    [0.25, 0.64],
    [0.75, 0.64],
    [0.5, 0.76],
    [0.25, 0.92],
    [0.75, 0.92],
  ],
};

let courtIdCounter = 0;

/**
 * Фигурная карта в духе старых Windows-карт: рамка, зеркальные половинки,
 * плоские красно-жёлто-чёрные заливки.
 */
function CourtArt({ rank, suit, color }: { rank: Rank; suit: Suit; color: string }) {
  const uid = React.useMemo(() => `crt${++courtIdCounter}`, []);
  const FX = 19; // левая граница рамки
  const FW = 46;
  const FY = 8;
  const FH = 98;
  const MID = FY + FH / 2; // ось зеркала
  const CX = FX + FW / 2; // центр по горизонтали

  const half = (
    <g>
      {/* плечи / мантия */}
      <path
        d={`M${FX + 2},${MID} L${FX + 2},${MID - 14} Q${CX},${MID - 24} ${FX + FW - 2},${MID - 14} L${FX + FW - 2},${MID} Z`}
        fill={color}
        stroke="#000"
        strokeWidth="0.9"
      />
      {/* воротник */}
      <path
        d={`M${CX - 11},${MID} L${CX - 9},${MID - 15} Q${CX},${MID - 20} ${CX + 9},${MID - 15} L${CX + 11},${MID} Z`}
        fill="#ffd400"
        stroke="#000"
        strokeWidth="0.7"
      />
      {/* голова */}
      <circle cx={CX} cy={MID - 26} r="9" fill="#ffe0bd" stroke="#000" strokeWidth="0.9" />
      <circle cx={CX - 3.2} cy={MID - 27.5} r="1" fill="#000" />
      <circle cx={CX + 3.2} cy={MID - 27.5} r="1" fill="#000" />
      <path
        d={`M${CX - 3},${MID - 22.5} Q${CX},${MID - 20.5} ${CX + 3},${MID - 22.5}`}
        fill="none"
        stroke="#000"
        strokeWidth="0.7"
      />

      {rank === 'K' && (
        <>
          <polygon
            points={`${CX - 11},${MID - 33} ${CX - 9},${MID - 42} ${CX - 5},${MID - 34} ${CX},${MID - 44} ${CX + 5},${MID - 34} ${CX + 9},${MID - 42} ${CX + 11},${MID - 33}`}
            fill="#ffd400"
            stroke="#000"
            strokeWidth="0.9"
          />
          <rect x={CX - 11} y={MID - 33} width="22" height="3.4" fill="#ffd400" stroke="#000" strokeWidth="0.8" />
          {/* борода */}
          <path
            d={`M${CX - 7},${MID - 21} Q${CX},${MID - 12} ${CX + 7},${MID - 21}`}
            fill="#fff"
            stroke="#000"
            strokeWidth="0.7"
          />
        </>
      )}
      {rank === 'Q' && (
        <>
          <polygon
            points={`${CX - 9},${MID - 33} ${CX - 7},${MID - 40} ${CX},${MID - 43} ${CX + 7},${MID - 40} ${CX + 9},${MID - 33}`}
            fill="#ffd400"
            stroke="#000"
            strokeWidth="0.9"
          />
          {/* локоны */}
          <path d={`M${CX - 10},${MID - 20} Q${CX - 14},${MID - 30} ${CX - 9},${MID - 34}`} fill="none" stroke="#000" strokeWidth="0.8" />
          <path d={`M${CX + 10},${MID - 20} Q${CX + 14},${MID - 30} ${CX + 9},${MID - 34}`} fill="none" stroke="#000" strokeWidth="0.8" />
          <circle cx={CX} cy={MID - 8} r="2.6" fill="#ffd400" stroke="#000" strokeWidth="0.6" />
        </>
      )}
      {rank === 'J' && (
        <>
          <path
            d={`M${CX - 10},${MID - 32} Q${CX},${MID - 45} ${CX + 10},${MID - 32} Z`}
            fill={color}
            stroke="#000"
            strokeWidth="0.9"
          />
          <rect x={CX - 11} y={MID - 33} width="22" height="3" fill="#ffd400" stroke="#000" strokeWidth="0.7" />
          <path d={`M${CX - 5},${MID - 12} L${CX},${MID - 4} L${CX + 5},${MID - 12} Z`} fill="#ffd400" stroke="#000" strokeWidth="0.6" />
        </>
      )}

      <text x={FX + 4} y={FY + 12} fontSize="9" fill={color} fontFamily="serif">
        {SUIT_SYMBOL[suit]}
      </text>
    </g>
  );

  return (
    <g>
      <defs>
        <clipPath id={`${uid}t`}>
          <rect x={FX} y={FY} width={FW} height={FH / 2} />
        </clipPath>
        <clipPath id={`${uid}b`}>
          <rect x={FX} y={MID} width={FW} height={FH / 2} />
        </clipPath>
      </defs>
      <rect x={FX} y={FY} width={FW} height={FH} fill="#fff" stroke="#000" strokeWidth="0.9" />
      <g clipPath={`url(#${uid}t)`}>{half}</g>
      {/* обрезка снаружи, поворот внутри: иначе clip-path повернулся бы вместе с фигурой */}
      <g clipPath={`url(#${uid}b)`}>
        <g transform={`rotate(180 ${CX} ${MID})`}>{half}</g>
      </g>
      <line x1={FX} y1={MID} x2={FX + FW} y2={MID} stroke="#000" strokeWidth="0.7" />
    </g>
  );
}

export function CardFace({
  card,
  width = CARD_W,
  className,
  style,
  onClick,
  dim,
  highlight,
  ...rest
}: {
  card: CardId;
  width?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  dim?: boolean;
  highlight?: boolean;
  [key: string]: any;
}) {
  const rank = rankOf(card);
  const suit = suitOf(card);
  const color = isRed(suit) ? '#d40000' : '#000000';
  const h = Math.round((width / CARD_W) * CARD_H);
  const label = RANK_LABEL[rank];
  const sym = SUIT_SYMBOL[suit];

  return (
    <svg
      className={`card-svg${className ? ' ' + className : ''}`}
      width={width}
      height={h}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      style={style}
      onClick={onClick}
      {...rest}
    >
      <rect
        x="0.5"
        y="0.5"
        width={CARD_W - 1}
        height={CARD_H - 1}
        rx="3"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1"
      />
      {/* угловой индекс */}
      <text
        x="9"
        y="18"
        fontSize={label === '10' ? 15 : 18}
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        {label}
      </text>
      <text x="9" y="33" fontSize="15" fill={color} textAnchor="middle" fontFamily="serif">
        {sym}
      </text>

      {rank === 'A' && (
        <text x="46" y="72" fontSize="46" fill={color} textAnchor="middle" fontFamily="serif">
          {sym}
        </text>
      )}
      {(rank === '9' || rank === 'T') &&
        PIP_LAYOUT[rank].map(([fx, fy], i) => (
          <text
            key={i}
            x={20 + fx * 56}
            y={16 + fy * 88}
            fontSize="14"
            fill={color}
            textAnchor="middle"
            fontFamily="serif"
          >
            {sym}
          </text>
        ))}
      {(rank === 'J' || rank === 'Q' || rank === 'K') && (
        <>
          <CourtArt rank={rank} suit={suit} color={color} />
          <text
            x="70"
            y="103"
            fontSize="12"
            fontWeight="bold"
            fill={color}
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            {rank === 'J' ? 'В' : rank === 'Q' ? 'Д' : 'К'}
          </text>
        </>
      )}
      {highlight && (
        <rect
          x="1"
          y="1"
          width={CARD_W - 2}
          height={CARD_H - 2}
          rx="3"
          fill="none"
          stroke="#ffff00"
          strokeWidth="2.5"
        />
      )}
      {dim && <rect x="0" y="0" width={CARD_W} height={CARD_H} rx="3" fill="rgba(0,0,0,0.38)" />}
    </svg>
  );
}

let backIdCounter = 0;

export function CardBack({
  width = CARD_W,
  style,
  className,
  onClick,
}: {
  width?: number;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  const h = Math.round((width / CARD_W) * CARD_H);
  const id = React.useMemo(() => `cb${++backIdCounter}`, []);
  return (
    <svg
      className={`card-svg${className ? ' ' + className : ''}`}
      width={width}
      height={h}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      style={style}
      onClick={onClick}
    >
      <defs>
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#ffffff" />
          <path d="M0,0 L8,8" stroke="#0000c0" strokeWidth="2.6" />
          <path d="M8,0 L0,8" stroke="#c00000" strokeWidth="2.6" />
          <path d="M4,0 L8,4" stroke="#0000c0" strokeWidth="1.2" />
          <path d="M0,4 L4,8" stroke="#c00000" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width={CARD_W - 1}
        height={CARD_H - 1}
        rx="3"
        fill="#ffffff"
        stroke="#000000"
      />
      <rect x="3" y="3" width={CARD_W - 6} height={CARD_H - 6} fill={`url(#${id})`} />
      <rect
        x="3"
        y="3"
        width={CARD_W - 6}
        height={CARD_H - 6}
        fill="none"
        stroke="#000000"
        strokeWidth="0.8"
      />
    </svg>
  );
}

/** Пустое место под карту (пунктирный прямоугольник, как в оригинале). */
export function CardSlot({ width = CARD_W, style }: { width?: number; style?: React.CSSProperties }) {
  const h = Math.round((width / CARD_W) * CARD_H);
  return (
    <svg width={width} height={h} viewBox={`0 0 ${CARD_W} ${CARD_H}`} style={style}>
      <rect
        x="1"
        y="1"
        width={CARD_W - 2}
        height={CARD_H - 2}
        rx="3"
        fill="rgba(0,0,0,0.10)"
        stroke="#1c5c1c"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
    </svg>
  );
}
