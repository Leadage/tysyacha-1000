/** Координаты элементов стола (базовая система 1000 × 646, как в оригинале). */

export const TABLE_W = 1000;
export const TABLE_H = 646;

export const CARD_TABLE_W = 110;
export const CARD_TABLE_H = 145;
export const HAND_OFFSET = 24;
export const PLAYER_HAND_OFFSET = 24;

export const L = {
  leftHand: { x: 8, y: 6 },
  rightHandRight: { right: 8, y: 6 },

  portraitLeft: { x: 405, y: 8, w: 105, h: 148 },
  portraitRight: { x: 535, y: 8, w: 105, h: 148 },

  scoreTable: { x: 736, y: 162, w: 240 },
  roundTable: { x: 20, y: 257 },
  infoBox: { x: 84, y: 345 },

  bubbleLeft: { x: 262, y: 187 },
  bubbleRight: { x: 645, y: 187 },
  bubbleBottom: { x: 645, y: 402 },

  centerLeftCard: { x: 381, y: 162 },
  centerRightCard: { x: 511, y: 162 },
  centerBottomCard: { x: 448, y: 320 },

  playerHand: { y: 496 },
  playerPortrait: { x: 34, y: 492, w: 96, h: 154 },
  bottomName: { x: 840, y: 528 },

  buttons: { x: 22, y: 452 },
  trumpBadge: { x: 20, y: 205 },
};

/** Позиции трёх карт в центре стола по «месту за столом». */
export type Seat = 'left' | 'right' | 'bottom';

export function seatCardPos(seat: Seat) {
  if (seat === 'left') return L.centerLeftCard;
  if (seat === 'right') return L.centerRightCard;
  return L.centerBottomCard;
}
