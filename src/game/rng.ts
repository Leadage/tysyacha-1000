/**
 * Детерминированный ГПСЧ (mulberry32) с сериализуемым состоянием —
 * нужен для воспроизводимых раздач и корректного сохранения партии.
 */

export interface RngState {
  seed: number;
}

export class Rng {
  private s: number;

  constructor(seed: number) {
    // приводим к беззнаковому 32-битному
    this.s = seed >>> 0;
  }

  static fromState(state: RngState): Rng {
    return new Rng(state.seed);
  }

  static random(): Rng {
    return new Rng((Math.random() * 0xffffffff) >>> 0);
  }

  getState(): RngState {
    return { seed: this.s };
  }

  /** [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Целое из [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Перемешивание Фишера — Йетса (не мутирует вход). */
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(arr.length)];
  }
}
