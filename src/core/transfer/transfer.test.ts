import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { defaultSettings } from '../settings/defaults';
import type { Settings } from '../settings/schema';
import { validateSettings, withRange } from '../settings/validate';
import { migrate } from '../storage/migrate';
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
  TRANSFER_MAX_CODE_LENGTH,
  TRANSFER_MAX_JSON_BYTES,
  TRANSFER_MAX_LINK_BYTES,
  TRANSFER_V2_SETTINGS_BASE,
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

/** base64url of bytes. */
function b64urlBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url of UTF-8 text, for hand-made codes. */
function b64url(text: string): string {
  return b64urlBytes(new TextEncoder().encode(text));
}

function fromB64url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
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
  it('a version 1 code with settings version 5 is migrated to the current settings version', async () => {
    const { numberPad: _drop, ...v5 } = settings();
    void _drop;
    const old = { ...toTransfer(data()), settings: { ...v5, version: 5 } };
    const dec = await decodeTransfer(`v1.${b64url(JSON.stringify(old))}`);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.data.settings.version).toBe(8);
    expect(dec.data.settings.playModes).toEqual({ mixed: true, ruler: true, math: true });
    expect(dec.data.settings.numberPad).toBe('auto');
    expect(dec.data.settings.sound.speech).toBe(false);
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

/** Codes written by this game on 2026-11-05 (settings version 6, transfer version 2), kept as they are (review T1, P4). */
const FROZEN_V2_COMPRESSED = 'v2.VU67bsMwDPwXzgwg52G3WpOhc1dDg-AwrWBZMig5iWHn38M4KYJyIXm8O149wZk4uRhAlwhsww-BnqBnSpRBQzOkHDtA6JxQdjslk72Crj7UDcEejy4v4ukBf1MafP47UqBuPLjTyTWCjmIWInfWi1n6jZe9j00LOvNAN6y3laDtKDcWWF7L2ltuPSUZG46XAAbrGiTCSvznYh5Cdv6LLGehbLEslFJYVOpdZlH0MS0h0_zSAq6xWOPnoyE4CwvvnxLLZ3vRNsaYOw';
const FROZEN_V2_PLAIN = 'v2.W3sidmVyc2lvbiI6NiwicmFuZ2UiOnsicHJlc2V0IjoiY3VzdG9tIiwibWluIjo1NTAsIm1heCI6NzgwfSwiYWRkaXRpb24iOnsibWF4UmVzdWx0Ijo3ODB9LCJlbmVteURpZmZpY3VsdHkiOiJub3JtYWwiLCJzaG93Q2xvY2siOnRydWV9LFs0Nywic2t5Iiwicm9ja2V0Iiwic3BhcmtsZXMiLCJjcm93biJdLFtbIjU1MC03ODB8MXx1bnRpbEhlYXJ0cyIsNCw2MTAwMCwxNzAwMDAwMDAwMDAwXV0sW1sicG9zaXRpb25zfDU1MC03ODAiLDIsMTIsOSwyLDEsImlhIl1dLFtbMTcwMDAwMDAwMDAwMCw2MDAwMDAsMTIsOSwyLDNdXV0';

/** The version 6 defaults as a literal, so this test does not follow later changes of defaultSettings(). */
const V6_DEFAULTS = {
  version: 6,
  challengeTypes: { numberLine: true, addition: true, subtraction: true, comparison: true },
  range: { preset: '0-100', min: 0, max: 100 },
  addition: { maxOperand: 10, maxResult: 100, steps: 1 },
  subtraction: { maxOperand: 10, steps: 1 },
  crossTens: true,
  crossHundreds: false,
  negativeResults: false,
  rulerLevelStart: 1,
  rulerLevelMax: 5,
  enemyDifficulty: 'easy',
  help: { nearestTen: true, countSteps: true, zoom: true, stepAnimation: true },
  beginnerAssist: true,
  sound: { effects: true, music: false, speech: true },
  roundType: 'untilHearts',
  roundLength: 5,
  adaptive: true,
  freePlay: false,
  noDamage: false,
  showClock: false,
  showRecords: true,
  timeLimitSeconds: null,
  garage: true,
  numberPad: 'auto',
};

describe('frozen version 2 codes (review T1, P4)', () => {
  it('the settings differences of version 2 codes are laid over the frozen version 6 defaults', () => {
    expect(TRANSFER_V2_SETTINGS_BASE).toEqual(V6_DEFAULTS);
    expect(Object.isFrozen(TRANSFER_V2_SETTINGS_BASE)).toBe(true);
    expect(Object.isFrozen(TRANSFER_V2_SETTINGS_BASE.sound)).toBe(true);
  });

  for (const [name, code] of [
    ['compressed', FROZEN_V2_COMPRESSED],
    ['uncompressed', FROZEN_V2_PLAIN],
  ] as const) {
    it(`a frozen ${name} code still gives the same save`, async () => {
      const dec = await decodeTransfer(code, { codec: browserCodec() });
      expect(dec.ok).toBe(true);
      if (!dec.ok) return;
      const v6 = {
        ...V6_DEFAULTS,
        range: { preset: 'custom', min: 550, max: 780 },
        addition: { maxOperand: 10, maxResult: 780, steps: 1 },
        enemyDifficulty: 'normal',
        showClock: true,
      };
      expect(dec.data.settings).toEqual(migrate(v6, 'settings'));
      expect(dec.data.settings.playModes).toEqual({ mixed: true, ruler: true, math: true });
      expect('freePlay' in dec.data.settings).toBe(false);
      expect(dec.data.garage).toEqual({ version: 1, stars: 47, look: { color: 'sky', flag: 'rocket', trail: 'sparkles', hat: 'crown' } });
      expect(dec.data.records.best).toEqual({ '550-780|1|untilHearts': { enemies: 4, ms: 61000, at: 1700000000000 } });
      expect(dec.data.progress.skills).toEqual({
        'positions|550-780': { step: 2, recent: [], masteryWindow: ['independent', 'assisted'], guesses: 1, attempts: 12, independentCorrect: 9, assisted: 2 },
      });
      expect(dec.data.progress.sessions).toEqual([{ id: '1700000000000-3', startedAt: 1700000000000, lastActiveAt: 1700000600000, attempts: 12, independentCorrect: 9, assisted: 2 }]);
    });
  }
});

describe('size limits when reading a code (review R3, P8)', () => {
  it('refuses a code longer than the limit without reading it', async () => {
    expect(TRANSFER_MAX_CODE_LENGTH).toBe(8192);
    const long = `v2.${'A'.repeat(TRANSFER_MAX_CODE_LENGTH)}`;
    expect((await decodeTransfer(long)).ok).toBe(false);
  });

  it('stops reading compressed data that unpacks to more than 64 KB', async () => {
    expect(TRANSFER_MAX_JSON_BYTES).toBe(65_536);
    // A valid payload padded with 200 KB of spaces: tiny when compressed, too large when unpacked.
    const plain = new TextDecoder().decode(fromB64url(FROZEN_V2_PLAIN.slice(3)));
    const padded = plain.slice(0, 1) + ' '.repeat(200_000) + plain.slice(1);
    const zipped = await browserCodec()!.deflate(new TextEncoder().encode(padded));
    const code = `v2.${b64urlBytes(zipped)}`;
    expect(code.length).toBeLessThan(TRANSFER_MAX_CODE_LENGTH);
    expect((await decodeTransfer(code)).ok).toBe(false);
    // The same payload without the padding is read.
    expect((await decodeTransfer(FROZEN_V2_PLAIN)).ok).toBe(true);
  });
});

/** Valid settings drawn at random: every field, every range kind and the linked limits (review P5). */
function randomSettings(seed: number): Settings {
  const r = createRng(seed);
  const bool = () => r.next() < 0.5;
  const preset = r.pick(['0-10', '0-20', '0-50', '0-100', '0-1000', 'custom'] as const);
  let range: Settings['range'];
  if (preset === 'custom') {
    const min = r.int(-1000, 9000);
    range = { preset, min, max: min + r.int(5, 1000) };
  } else {
    const max = Number(preset.split('-')[1]);
    range = { preset, min: 0, max };
  }
  const noDamage = bool();
  const types = { numberLine: bool(), addition: bool(), subtraction: bool(), comparison: bool() };
  const anyType = Object.values(types).some(Boolean);
  const playModes = anyType ? { mixed: bool(), ruler: bool(), math: bool() } : { mixed: false, ruler: true, math: false };
  if (!playModes.mixed && !playModes.ruler && !playModes.math) playModes.ruler = true;
  const start = r.int(1, 5) as Settings['rulerLevelStart'];
  // A range below 1 has exercises only with negative results.
  const negativeResults = range.min < 0 && (bool() || range.max < 1);
  const base: Settings = {
    ...defaultSettings(),
    challengeTypes: types,
    negativeResults,
    crossTens: bool(),
    crossHundreds: bool(),
    rulerLevelStart: start,
    rulerLevelMax: r.int(start, 5) as Settings['rulerLevelMax'],
    enemyDifficulty: r.pick(['easy', 'normal', 'challenging'] as const),
    help: { nearestTen: bool(), countSteps: bool(), zoom: bool(), stepAnimation: bool() },
    beginnerAssist: bool(),
    sound: { effects: bool(), music: bool(), speech: bool() },
    roundType: noDamage ? 'enemyCount' : r.pick(['untilHearts', 'enemyCount'] as const),
    roundLength: r.int(1, 20),
    adaptive: bool(),
    playModes,
    noDamage,
    showClock: bool(),
    showRecords: bool(),
    timeLimitSeconds: bool() ? null : r.int(10, 120),
    garage: bool(),
    numberPad: r.pick(['auto', 'always', 'never'] as const),
  };
  const fitted = withRange(base, range);
  const span = range.max - range.min;
  const lo = negativeResults ? range.min : Math.max(range.min, 0);
  fitted.addition = { maxOperand: r.int(1, span), maxResult: r.int(Math.min(lo + 1, range.max), range.max), steps: r.pick([1, 2] as const) };
  fitted.subtraction = { maxOperand: r.int(1, span), steps: r.pick([1, 2] as const) };
  return fitted;
}

describe('round trip over generated settings (review P5)', () => {
  it('200 random valid settings come back unchanged, compressed and uncompressed', async () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = randomSettings(seed);
      expect(validateSettings(s), `seed ${seed}`).toEqual({ ok: true });
      for (const codec of [browserCodec(), null]) {
        const enc = await encodeTransfer({ ...data(), settings: s }, PAGE, { codec });
        const dec = await decodeTransfer(codeOf(enc.link), { codec: browserCodec() });
        expect(dec.ok, `seed ${seed}`).toBe(true);
        if (dec.ok) expect(dec.data.settings, `seed ${seed}`).toEqual(s);
      }
    }
  });
});
