import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSfx, landingSounds, MAX_GAIN, MUSIC_BAR_MS, type AudioContextLike } from './sfx';

/** Minimal Web Audio stand-in that records started sources and gain values. */
function fakeContext() {
  const started: string[] = [];
  const gains: number[] = [];
  let state: AudioContextState = 'suspended';
  const param = (log: number[]) => ({
    value: 0,
    setValueAtTime(v: number) {
      log.push(v);
      return this;
    },
    linearRampToValueAtTime(v: number) {
      log.push(v);
      return this;
    },
    exponentialRampToValueAtTime(v: number) {
      log.push(v);
      return this;
    },
  });
  const node = () => ({ connect: (n: unknown) => n, disconnect() {} });
  const ctx = {
    get state() {
      return state;
    },
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    resume: async () => {
      state = 'running';
    },
    createGain: () => {
      const g = { ...node(), gain: param(gains) };
      return g;
    },
    createOscillator: () => ({ ...node(), type: 'sine', frequency: param([]), start: () => started.push('osc'), stop() {} }),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => ({ ...node(), buffer: null, start: () => started.push('noise'), stop() {} }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param([]) }),
  };
  return { ctx: ctx as unknown as AudioContextLike, started, gains, get state() {
    return state;
  } };
}

describe('sfx', () => {
  it('plays nothing before the first user tap unlocks audio', () => {
    const f = fakeContext();
    const sfx = createSfx({ enabled: () => true, createContext: () => f.ctx });
    sfx.shot();
    sfx.boom();
    sfx.chime();
    expect(f.started).toEqual([]);
  });

  it('plays shot, boom and chime after unlock when effects are on', async () => {
    const f = fakeContext();
    const sfx = createSfx({ enabled: () => true, createContext: () => f.ctx });
    await sfx.unlock();
    expect(f.state).toBe('running');
    sfx.shot();
    sfx.boom();
    sfx.chime();
    expect(f.started.length).toBeGreaterThanOrEqual(3);
  });

  it('plays nothing when settings.sound.effects is off', async () => {
    const f = fakeContext();
    let on = false;
    const sfx = createSfx({ enabled: () => on, createContext: () => f.ctx });
    await sfx.unlock();
    sfx.shot();
    sfx.boom();
    sfx.chime();
    expect(f.started).toEqual([]);
    on = true;
    sfx.chime();
    expect(f.started.length).toBeGreaterThan(0);
  });

  it('never sets a gain above the low cap', async () => {
    const f = fakeContext();
    const sfx = createSfx({ enabled: () => true, createContext: () => f.ctx });
    await sfx.unlock();
    sfx.shot();
    sfx.boom();
    sfx.chime();
    expect(MAX_GAIN).toBeLessThanOrEqual(0.3);
    expect(Math.max(...f.gains)).toBeLessThanOrEqual(MAX_GAIN);
  });

  it('offers no sound for a wrong answer; the only extra voice is the light plopp of a bursting decoy (amendment 10)', () => {
    const sfx = createSfx({ enabled: () => true, createContext: () => fakeContext().ctx });
    expect(Object.keys(sfx).sort()).toEqual(['boom', 'chime', 'installUnlock', 'plopp', 'shot', 'startMusic', 'stopMusic', 'unlock']);
  });

  it('the plopp is quiet, plays only when effects are on, and is lighter than the boom (amendment 10, FR-066)', async () => {
    const f = fakeContext();
    let on = false;
    const sfx = createSfx({ enabled: () => on, createContext: () => f.ctx });
    await sfx.unlock();
    sfx.plopp();
    expect(f.started).toEqual([]);
    on = true;
    sfx.plopp();
    expect(f.started.length).toBeGreaterThan(0);
    const ploppPeak = Math.max(...f.gains);
    expect(ploppPeak).toBeLessThanOrEqual(MAX_GAIN / 2);
    const b = fakeContext();
    const boom = createSfx({ enabled: () => true, createContext: () => b.ctx });
    await boom.unlock();
    boom.boom();
    expect(ploppPeak).toBeLessThan(Math.max(...b.gains));
  });

  it('a landing plays only the soft boom, a hit adds the soft chime, and a miss adds nothing (FR-009, AC-07)', () => {
    expect(landingSounds({ destroyedEnemy: false })).toEqual(['boom']);
    expect(landingSounds({ destroyedEnemy: true })).toEqual(['boom', 'chime']);
  });

  it('a hit that does not count (after the full help, amendment 18) plays the boom without the chime', () => {
    expect(landingSounds({ destroyedEnemy: true, uncounted: true })).toEqual(['boom']);
    expect(landingSounds({ destroyedEnemy: true, uncounted: false })).toEqual(['boom', 'chime']);
  });

  it('a burst decoy plays only the light plopp, clearly different from the enemy explosion (amendment 10, FR-066)', () => {
    expect(landingSounds({ destroyedEnemy: false, burstDecoy: true })).toEqual(['plopp']);
    expect(landingSounds({ destroyedEnemy: false, burstDecoy: false })).toEqual(['boom']);
  });
});

describe('music loop (FR-009, research R13, T142)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays a quiet generated loop only while settings.sound.music is on, and stops on stopMusic', async () => {
    vi.useFakeTimers();
    const f = fakeContext();
    let music = true;
    const sfx = createSfx({ enabled: () => false, music: () => music, createContext: () => f.ctx });
    await sfx.unlock();
    sfx.startMusic();
    vi.advanceTimersByTime(MUSIC_BAR_MS * 2);
    const played = f.started.length;
    expect(played).toBeGreaterThan(0);
    // Quieter than the effects: background only.
    expect(Math.max(...f.gains)).toBeLessThanOrEqual(MAX_GAIN / 4);
    // Turning music off stops the loop at the next bar.
    music = false;
    vi.advanceTimersByTime(MUSIC_BAR_MS * 3);
    expect(f.started.length).toBe(played);
    music = true;
    sfx.stopMusic();
    vi.advanceTimersByTime(MUSIC_BAR_MS * 3);
    expect(f.started.length).toBe(played);
  });

  it('plays nothing with music off (the default) or before the first tap unlocks audio', async () => {
    vi.useFakeTimers();
    const off = fakeContext();
    const quiet = createSfx({ enabled: () => true, music: () => false, createContext: () => off.ctx });
    await quiet.unlock();
    quiet.startMusic();
    vi.advanceTimersByTime(MUSIC_BAR_MS * 3);
    expect(off.started).toEqual([]);

    const locked = fakeContext();
    const early = createSfx({ enabled: () => true, music: () => true, createContext: () => locked.ctx });
    early.startMusic();
    vi.advanceTimersByTime(MUSIC_BAR_MS * 3);
    expect(locked.started).toEqual([]);
    early.stopMusic();
  });
});
