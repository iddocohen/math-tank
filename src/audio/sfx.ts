/**
 * Synthesized sound effects (FR-009, research R13): a shot, a soft boom and a soft chime, made
 * with the Web Audio API at runtime, so there are no audio files.
 *
 * - Sounds play only while `enabled()` returns true (wire it to settings.sound.effects).
 * - There is deliberately no sound for a wrong answer.
 * - Every voice peaks at MAX_GAIN or lower.
 * - Browsers start audio suspended; the context is created and resumed on the first user tap
 *   (installUnlock). Until then every sound is skipped silently.
 */

/** The part of AudioContext this module uses; tests pass a stand-in. */
export type AudioContextLike = Pick<
  AudioContext,
  'state' | 'currentTime' | 'sampleRate' | 'destination' | 'resume' | 'createGain' | 'createOscillator' | 'createBuffer' | 'createBufferSource' | 'createBiquadFilter'
>;

export const MAX_GAIN = 0.25;
const SILENT = 0.0001;

export interface SfxOptions {
  enabled: () => boolean;
  /** Defaults to `new AudioContext()`. */
  createContext?: () => AudioContextLike;
}

export interface Sfx {
  shot(): void;
  boom(): void;
  chime(): void;
  /** Creates and resumes the audio context; call from a user gesture. */
  unlock(): Promise<void>;
  /** Unlocks on the first pointer or key press on `target`; returns a function that removes the listeners. */
  installUnlock(target?: EventTarget): () => void;
}

export function createSfx(options: SfxOptions): Sfx {
  const make = options.createContext ?? (() => new AudioContext());
  let ctx: AudioContextLike | null = null;
  let noise: AudioBuffer | null = null;

  const ready = (): AudioContextLike | null => {
    if (!options.enabled() || !ctx || ctx.state !== 'running') return null;
    return ctx;
  };

  const envelope = (c: AudioContextLike, peak: number, attack: number, decay: number, delay = 0): GainNode => {
    const g = c.createGain();
    const t = c.currentTime + delay;
    const p = Math.min(peak, MAX_GAIN);
    g.gain.setValueAtTime(SILENT, t);
    g.gain.linearRampToValueAtTime(p, t + attack);
    g.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay);
    g.connect(c.destination);
    return g;
  };

  const noiseBuffer = (c: AudioContextLike): AudioBuffer => {
    if (noise) return noise;
    const length = Math.floor(c.sampleRate * 0.6);
    const buf = c.createBuffer(1, length, c.sampleRate);
    const data = buf.getChannelData(0);
    // Fixed pseudo-random noise, so the sound is the same every time.
    let s = 12345;
    for (let i = 0; i < length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (s / 0x7fffffff) * 2 - 1;
    }
    noise = buf;
    return buf;
  };

  const tone = (c: AudioContextLike, type: OscillatorType, from: number, to: number, peak: number, attack: number, decay: number, delay = 0) => {
    const g = envelope(c, peak, attack, decay, delay);
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime + delay;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    o.connect(g);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  };

  const filteredNoise = (c: AudioContextLike, cutoff: number, peak: number, attack: number, decay: number) => {
    const g = envelope(c, peak, attack, decay);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, c.currentTime);
    f.connect(g);
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.connect(f);
    src.start(c.currentTime);
    src.stop(c.currentTime + attack + decay + 0.05);
  };

  const unlock = async (): Promise<void> => {
    try {
      ctx ??= make();
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      // No Web Audio here: the game stays silent.
      ctx = null;
    }
  };

  return {
    shot() {
      const c = ready();
      if (!c) return;
      tone(c, 'triangle', 220, 70, 0.2, 0.005, 0.18);
      filteredNoise(c, 1800, 0.12, 0.003, 0.12);
    },
    boom() {
      const c = ready();
      if (!c) return;
      filteredNoise(c, 500, MAX_GAIN, 0.01, 0.55);
      tone(c, 'sine', 90, 40, 0.2, 0.01, 0.45);
    },
    chime() {
      const c = ready();
      if (!c) return;
      tone(c, 'sine', 880, 880, 0.12, 0.01, 0.5);
      tone(c, 'sine', 1320, 1320, 0.08, 0.01, 0.6, 0.09);
    },
    unlock,
    installUnlock(target: EventTarget = globalThis) {
      const events = ['pointerdown', 'touchend', 'keydown'];
      const handler = () => {
        remove();
        void unlock();
      };
      const remove = () => events.forEach((e) => target.removeEventListener(e, handler));
      events.forEach((e) => target.addEventListener(e, handler));
      return remove;
    },
  };
}
