import { describe, expect, it } from 'vitest';
import { createSfx, landingSounds, MAX_GAIN, type AudioContextLike } from './sfx';

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

  it('offers no sound for a wrong answer', () => {
    const sfx = createSfx({ enabled: () => true, createContext: () => fakeContext().ctx });
    expect(Object.keys(sfx).sort()).toEqual(['boom', 'chime', 'installUnlock', 'shot', 'unlock']);
  });

  it('a landing plays only the soft boom, a hit adds the soft chime, and a miss adds nothing (FR-009, AC-07)', () => {
    expect(landingSounds({ outOfBounds: false, destroyedEnemy: false })).toEqual(['boom']);
    expect(landingSounds({ outOfBounds: false, destroyedEnemy: true })).toEqual(['boom', 'chime']);
    expect(landingSounds({ outOfBounds: true, destroyedEnemy: false })).toEqual([]);
  });
});
