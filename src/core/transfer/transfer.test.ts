import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import type { Attempt, Progress, SessionSummary } from '../types';
import type { Garage } from '../rewards/garage';
import type { Records } from '../records/records';
import {
  browserCodec,
  decodeTransfer,
  encodeTransfer,
  saveCodeFromHash,
  toTransfer,
  transferLink,
  TRANSFER_MAX_LINK_BYTES,
  type SaveData,
} from './transfer';

const PAGE = 'https://iddocohen.github.io/math-tank/';

function settings(): Settings {
  return {
    ...defaultSettings(),
    range: { preset: 'custom', min: 550, max: 780 },
    addition: { maxOperand: 10, maxResult: 780, steps: 1 },
    enemyDifficulty: 'normal',
    roundType: 'enemyCount',
    roundLength: 12,
  };
}

function garage(): Garage {
  return { version: 1, stars: 47, look: { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'crown' } };
}

function records(): Records {
  return {
    version: 1,
    best: {
      '550-780|1|enemyCount': { enemies: 4, ms: 61_000, at: 1_700_000_000_000 },
      '0-100|1|untilHearts': { enemies: 9, ms: 372_000, at: 1_700_000_100_000 },
    },
  };
}

function attempt(i: number): Attempt {
  return {
    challengeId: `${i}-0`,
    seed: i,
    kind: 'findNumber',
    skills: ['positions'],
    rangeKey: '550-780',
    difficultyStep: 1,
    solved: true,
    independent: true,
    exact: true,
    helpLevel: 0,
    wrongAnswers: 0,
    responseMs: 4000,
    guess: false,
    sessionId: 's1',
    at: 1_700_000_000_000 + i,
  };
}

function session(i: number): SessionSummary {
  return { id: `s${i}`, startedAt: 1_700_000_000_000 + i * 86_400_000, lastActiveAt: 1_700_000_000_000 + i * 86_400_000 + 600_000, attempts: 10 + i, independentCorrect: 5, assisted: 3 };
}

function progress(sessions = 3): Progress {
  return {
    version: 1,
    attempts: Array.from({ length: 50 }, (_, i) => attempt(i)),
    skills: {
      'positions|550-780': {
        step: 2,
        recent: ['independent', 'assisted'],
        masteryWindow: ['independent', 'independent', 'assisted', 'unsolved', 'independent', 'close', 'independent', 'independent', 'assisted', 'independent'],
        guesses: 1,
        attempts: 40,
        independentCorrect: 30,
        assisted: 8,
      },
      'addition|0-100': { step: 0, recent: [], masteryWindow: ['assisted'], guesses: 0, attempts: 3, independentCorrect: 1, assisted: 2 },
    },
    sessions: Array.from({ length: sessions }, (_, i) => session(i)),
  };
}

function data(sessions = 3): SaveData {
  return { settings: settings(), progress: progress(sessions), records: records(), garage: garage() };
}

/** The part after `#save=`. */
function codeOf(link: string): string {
  return link.slice(link.indexOf('#save=') + '#save='.length);
}

/** base64url of UTF-8 text, for hand-made codes. */
function b64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('toTransfer (FR-116)', () => {
  it('keeps settings, garage, records, the skill summary and sessions, and no attempts', () => {
    const t = toTransfer(data());
    expect(t.v).toBe(1);
    expect(t.settings).toEqual(settings());
    expect(t.garage).toEqual({ stars: 47, look: garage().look });
    expect(t.records).toEqual(records().best);
    expect(t.skills['positions|550-780']).toEqual([2, 40, 30, 8, 1, 'iiauiciiai']);
    expect(t.sessions).toHaveLength(3);
    expect(t.sessions[0]).toEqual(['s0', session(0).startedAt, session(0).lastActiveAt, 10, 5, 3]);
    expect(JSON.stringify(t)).not.toContain('challengeId');
  });
});

describe('encodeTransfer and decodeTransfer round trip (FR-117, FR-120)', () => {
  for (const [name, codec] of [
    ['compressed', browserCodec()],
    ['uncompressed', null],
  ] as const) {
    it(`gives back the same save, ${name}`, async () => {
      const enc = await encodeTransfer(data(), PAGE + '#old', { codec });
      expect(enc.link.startsWith(PAGE + '#save=v2.')).toBe(true);
      expect(enc.fits).toBe(true);
      expect(enc.sessionsDropped).toBe(0);
      expect(enc.windowLength).toBe(10);
      const dec = await decodeTransfer(codeOf(enc.link), { codec: browserCodec() });
      expect(dec.ok).toBe(true);
      if (!dec.ok) return;
      expect(dec.data.settings).toEqual(settings());
      expect(dec.data.garage).toEqual(garage());
      expect(dec.data.records).toEqual(records());
      expect(dec.data.progress.attempts).toEqual([]);
      expect(dec.data.progress.sessions).toEqual(progress().sessions);
      const expectedSkills = Object.fromEntries(Object.entries(progress().skills).map(([k, sp]) => [k, { ...sp, recent: [] }]));
      expect(dec.data.progress.skills).toEqual(expectedSkills);
      expect(dec.summary).toEqual({ stars: 47, record: 9, min: 550, max: 780 });
    });
  }

  it('the compressed link is shorter than the uncompressed one', async () => {
    const zipped = await encodeTransfer(data(), PAGE, { codec: browserCodec() });
    const plain = await encodeTransfer(data(), PAGE, { codec: null });
    expect(zipped.link.length).toBeLessThan(plain.link.length);
  });

  it('builds the link from the page address without its old fragment', () => {
    expect(transferLink('http://localhost:4173/?seed=3#save=v1.old', 'v1.abc')).toBe('http://localhost:4173/?seed=3#save=v1.abc');
  });

  it('a summary without records says record 0', async () => {
    const enc = await encodeTransfer({ ...data(), records: { version: 1, best: {} } }, PAGE);
    const dec = await decodeTransfer(codeOf(enc.link));
    expect(dec.ok && dec.summary.record).toBe(0);
  });
});

describe('size limit and trimming order (FR-118)', () => {
  it('drops the oldest sessions first, then shortens the mastery windows', async () => {
    const full = await encodeTransfer(data(40), PAGE, { codec: null });
    const noSessions = await encodeTransfer(data(0), PAGE, { codec: null });
    // Room for a few sessions only: the oldest go, the newest stay, the windows stay whole.
    const limit = noSessions.link.length + 120;
    const some = await encodeTransfer(data(40), PAGE, { codec: null, maxBytes: limit });
    expect(full.link.length).toBeGreaterThan(limit);
    expect(some.fits).toBe(true);
    expect(some.link.length).toBeLessThanOrEqual(limit);
    expect(some.sessionsDropped).toBeGreaterThan(0);
    expect(some.sessionsDropped).toBeLessThan(40);
    expect(some.windowLength).toBe(10);
    const dec = await decodeTransfer(codeOf(some.link));
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    const kept = dec.data.progress.sessions.map((s) => s.id);
    expect(kept.at(-1)).toBe('s39');
    expect(kept[0]).toBe(`s${some.sessionsDropped}`);

    // Less room than the save without sessions: every session goes, then the windows get shorter.
    const tighter = await encodeTransfer(data(40), PAGE, { codec: null, maxBytes: noSessions.link.length - 4 });
    expect(tighter.fits).toBe(true);
    expect(tighter.sessionsDropped).toBe(40);
    expect(tighter.windowLength).toBeLessThan(10);
    const dec2 = await decodeTransfer(codeOf(tighter.link));
    expect(dec2.ok).toBe(true);
    if (!dec2.ok) return;
    const window = dec2.data.progress.skills['positions|550-780']!.masteryWindow;
    expect(window).toHaveLength(tighter.windowLength);
    // The newest entries stay.
    expect(window).toEqual(progress().skills['positions|550-780']!.masteryWindow.slice(10 - tighter.windowLength));
  });

  it('reports fits false when even empty windows are too long', async () => {
    const r = await encodeTransfer(data(5), PAGE, { codec: null, maxBytes: 100 });
    expect(r.fits).toBe(false);
    expect(r.sessionsDropped).toBe(5);
    expect(r.windowLength).toBe(0);
  });

  it('the default limit is 2300 bytes and a usual save fits it compressed', async () => {
    expect(TRANSFER_MAX_LINK_BYTES).toBe(2300);
    const r = await encodeTransfer(data(200), PAGE);
    expect(r.fits).toBe(true);
    expect(new TextEncoder().encode(r.link).length).toBeLessThanOrEqual(2300);
  });
});

describe('invalid codes change nothing (FR-120)', () => {
  const validTransfer = () => toTransfer(data());

  it.each([
    ['empty', ''],
    ['no version', 'abc'],
    ['unknown version', `v3.${b64url(JSON.stringify(validTransfer()))}`],
    ['version 2 payload that is an object', `v2.${b64url(JSON.stringify(validTransfer()))}`],
    ['version 2 payload with a bad garage', `v2.${b64url(JSON.stringify([{ version: 6 }, [-1, 'blue', 'star', 'plain', 'none'], [], [], []]))}`],
    ['bad base64url', 'v1.@@@!!'],
    ['damaged compressed data', 'v1.AAECAwQFBgcICQ'],
    ['not a transfer', `v1.${b64url(JSON.stringify({ hello: 1 }))}`],
    ['JSON array', `v1.${b64url('[1,2,3]')}`],
    ['invalid settings', `v1.${b64url(JSON.stringify({ ...validTransfer(), settings: { ...settings(), range: { preset: 'custom', min: 50, max: 10 } } }))}`],
    ['negative stars', `v1.${b64url(JSON.stringify({ ...validTransfer(), garage: { stars: -1, look: garage().look } }))}`],
    ['bad record', `v1.${b64url(JSON.stringify({ ...validTransfer(), records: { '0-100|1|untilHearts': { enemies: 'x', ms: 1, at: 1 } } }))}`],
    ['bad window letter', `v1.${b64url(JSON.stringify({ ...validTransfer(), skills: { 'positions|0-100': [0, 1, 1, 0, 0, 'ix'] } }))}`],
  ])('%s', async (_name, code) => {
    expect((await decodeTransfer(code)).ok).toBe(false);
  });

  it('a damaged real code is refused', async () => {
    const enc = await encodeTransfer(data(), PAGE);
    const code = codeOf(enc.link);
    const damaged = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11, -6);
    expect((await decodeTransfer(damaged)).ok).toBe(false);
  });
});

describe('migration of an older transfer (FR-120)', () => {
  it('a version 1 code with settings version 5 is migrated to settings version 6', async () => {
    const { numberPad: _drop, ...v5 } = settings();
    void _drop;
    const old = { ...toTransfer(data()), settings: { ...v5, version: 5 } };
    const dec = await decodeTransfer(`v1.${b64url(JSON.stringify(old))}`);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.data.settings.version).toBe(6);
    expect(dec.data.settings.numberPad).toBe('auto');
    expect(dec.data.settings.range).toEqual(settings().range);
  });

  it('a look part that is not unlocked for the stars becomes the standard item', async () => {
    const old = { ...toTransfer(data()), garage: { stars: 0, look: garage().look } };
    const dec = await decodeTransfer(`v1.${b64url(JSON.stringify(old))}`);
    expect(dec.ok).toBe(true);
    if (dec.ok) expect(dec.data.garage.look.color).not.toBe('sky');
  });
});

describe('saveCodeFromHash', () => {
  it('reads the code of a save fragment', () => {
    expect(saveCodeFromHash('#save=v1.abc_-')).toBe('v1.abc_-');
    expect(saveCodeFromHash('#save=')).toBe('');
  });
  it('gives null for other fragments', () => {
    expect(saveCodeFromHash('')).toBeNull();
    expect(saveCodeFromHash('#')).toBeNull();
    expect(saveCodeFromHash('#seed=3')).toBeNull();
    expect(saveCodeFromHash('#xsave=v1.abc')).toBeNull();
  });
});

/** A save after about 50 attempts in 0 to 100: two changed settings, 3 records, 20 stars, 6 skills, 5 sessions (T305). */
function typicalSave(): SaveData {
  const t0 = 1_762_300_000_000;
  const w: Progress['skills'][string]['masteryWindow'] = ['independent', 'independent', 'assisted', 'independent', 'close', 'independent', 'unsolved', 'independent'];
  const skills: Progress['skills'] = {};
  for (const s of ['positions', 'countForward', 'countBackward', 'addition', 'subtraction', 'comparison']) {
    skills[`${s}|0-100`] = { step: 1, recent: [], masteryWindow: w, guesses: 0, attempts: 8, independentCorrect: 5, assisted: 2 };
  }
  const sessions = Array.from({ length: 5 }, (_, i) => {
    const startedAt = t0 + i * 86_400_000 + i * 37_123;
    return { id: `${startedAt}-${i}`, startedAt, lastActiveAt: startedAt + 812_345, attempts: 10, independentCorrect: 6, assisted: 3 };
  });
  return {
    settings: { ...defaultSettings(), rulerLevelMax: 3, sound: { effects: true, music: false, speech: false } },
    progress: { version: 1, attempts: Array.from({ length: 50 }, (_, i) => attempt(i)), skills, sessions },
    records: {
      version: 1,
      best: {
        '0-100|1|untilHearts': { enemies: 7, ms: 312_345, at: t0 + 1000 },
        '0-20|1|untilHearts': { enemies: 4, ms: 100_000, at: t0 + 2000 },
        '0-100|2|enemyCount': { enemies: 5, ms: 200_123, at: t0 + 3000 },
      },
    },
    garage: { version: 1, stars: 20, look: { color: 'blue', flag: 'rocket', trail: 'plain', hat: 'none' } },
  };
}

describe('compact transfer version 2 (T305)', () => {
  it('a typical save gives a link of at most 800 bytes', async () => {
    const r = await encodeTransfer(typicalSave(), PAGE);
    expect(r.code.startsWith('v2.')).toBe(true);
    const bytes = new TextEncoder().encode(r.link).length; // 399 bytes when written (version 1: 933)
    expect(bytes).toBeLessThanOrEqual(800);
  });

  it('a typical save comes back unchanged, without the attempt history', async () => {
    for (const codec of [browserCodec(), null]) {
      const save = typicalSave();
      const dec = await decodeTransfer((await encodeTransfer(save, PAGE, { codec })).code);
      expect(dec.ok).toBe(true);
      if (!dec.ok) return;
      expect(dec.data).toEqual({ ...save, progress: { ...save.progress, attempts: [] } });
    }
  });

  it('leaves out skills without any progress; a missing skill reads as empty', async () => {
    const save = typicalSave();
    save.progress.skills['tens|0-100'] = { step: 0, recent: [], masteryWindow: [], guesses: 0, attempts: 0, independentCorrect: 0, assisted: 0 };
    const dec = await decodeTransfer((await encodeTransfer(save, PAGE)).code);
    expect(dec.ok && Object.keys(dec.data.progress.skills)).not.toContain('tens|0-100');
  });

  it('keeps session ids that do not follow the "<start>-<n>" pattern', async () => {
    const dec = await decodeTransfer((await encodeTransfer(data(), PAGE)).code);
    expect(dec.ok && dec.data.progress.sessions.map((s) => s.id)).toEqual(['s0', 's1', 's2']);
  });

  it('ignores a "__proto__" key in the settings differences', async () => {
    const raw = '[{"version":6,"__proto__":{"roundLength":7},"rulerLevelMax":3},[0,"blue","star","plain","none"],[],[],[]]';
    const dec = await decodeTransfer(`v2.${b64url(raw)}`);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.data.settings).toEqual({ ...defaultSettings(), rulerLevelMax: 3 });
    expect(({} as Record<string, unknown>).roundLength).toBeUndefined();
  });

  it('still reads a version 1 code', async () => {
    const dec = await decodeTransfer(`v1.${b64url(JSON.stringify(toTransfer(data())))}`);
    expect(dec.ok).toBe(true);
    if (dec.ok) expect(dec.data.settings).toEqual(settings());
  });
});
