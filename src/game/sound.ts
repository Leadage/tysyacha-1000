/**
 * Простые ретро-звуки. Если в public/sounds лежат WAV-файлы — играем их,
 * иначе синтезируем короткий сигнал через WebAudio.
 */

export type SoundName = 'card' | 'marriage' | 'trick' | 'message' | 'wakeup';

const FILES: Record<SoundName, string> = {
  card: 'sounds/card.wav',
  marriage: 'sounds/marriage.wav',
  trick: 'sounds/trick.wav',
  message: 'sounds/message.wav',
  wakeup: 'sounds/wakeup.wav',
};

const TONES: Record<SoundName, { f: number; d: number; type: OscillatorType }[]> = {
  card: [{ f: 220, d: 0.05, type: 'square' }],
  marriage: [
    { f: 523, d: 0.09, type: 'square' },
    { f: 659, d: 0.09, type: 'square' },
    { f: 784, d: 0.14, type: 'square' },
  ],
  trick: [
    { f: 392, d: 0.07, type: 'square' },
    { f: 294, d: 0.09, type: 'square' },
  ],
  message: [{ f: 880, d: 0.08, type: 'triangle' }],
  wakeup: [
    { f: 1200, d: 0.1, type: 'square' },
    { f: 900, d: 0.1, type: 'square' },
    { f: 1200, d: 0.14, type: 'square' },
  ],
};

let enabled = true;
let ctx: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer | null>();

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function isSoundEnabled() {
  return enabled;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

async function loadFile(name: SoundName): Promise<AudioBuffer | null> {
  if (buffers.has(name)) return buffers.get(name)!;
  const c = getCtx();
  if (!c) return null;
  try {
    const res = await fetch(FILES[name]);
    if (!res.ok) throw new Error('нет файла');
    const ab = await res.arrayBuffer();
    const buf = await c.decodeAudioData(ab);
    buffers.set(name, buf);
    return buf;
  } catch {
    buffers.set(name, null);
    return null;
  }
}

export function play(name: SoundName) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  loadFile(name).then((buf) => {
    if (!enabled) return;
    if (buf) {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start();
      return;
    }
    beep(c, name);
  });
}

function beep(c: AudioContext, name: SoundName) {
  let t = c.currentTime;
  for (const tone of TONES[name]) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = tone.type;
    osc.frequency.value = tone.f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + tone.d);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + tone.d + 0.01);
    t += tone.d;
  }
}
