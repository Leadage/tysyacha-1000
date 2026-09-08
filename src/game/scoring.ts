/**
 * Округление и подсчёт очков кона.
 */

/**
 * Округление до ближайшего числа, кратного 5, по правилам старой программы:
 * остаток 0 → без изменения, 1,2 → вниз, 3,4 → вверх,
 * 5 → без изменения, 6,7 → вниз, 8,9 → вверх.
 */
export function roundToFive(n: number): number {
  const sign = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  const base = Math.floor(a / 5) * 5;
  const rem = a - base;
  const rounded = rem <= 2 ? base : base + 5;
  return sign * rounded;
}

/** Победная планка. */
export function winThreshold(winMoreThan1000: boolean): number {
  return winMoreThan1000 ? 1005 : 1000;
}

/** Минимальный заказ, которого хватит для победы с бочки. */
export function minContractFromBarrel(barrelScore: number, winMoreThan1000: boolean): number {
  const need = winThreshold(winMoreThan1000) - barrelScore;
  return Math.ceil(need / 5) * 5;
}
