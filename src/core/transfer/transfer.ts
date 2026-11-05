/**
 * Moving a save to another browser with a link or a QR code (amendment 15, FR-115 to FR-120, data-model.md
 * "Transfer code"). Engine-free: no React, no Phaser, no storage access.
 *
 * The transfer holds the settings, the garage, the personal bests and the progress summary, without the attempt
 * history. It is compressed with `deflate-raw` through the browser's CompressionStream (or sent uncompressed when there
 * is none), encoded as base64url and put into the link's fragment as `#save=v2.<data>`. Browsers never send the
 * fragment to the server.
 *
 * Transfer version 2 (T305) is a JSON array that keeps the QR code small enough for a camera to read from another
 * screen: settings only where they differ from the defaults, the garage, records, skills and sessions as arrays of
 * numbers, no skill without progress, session times as differences, and session ids as their counter when they follow
 * the "<start>-<n>" pattern. Version 1 codes (a JSON object, amendment 15) are still read.
 *
 * Receiving checks every part with the same schemas and migrations as loading from storage (FR-048), so a damaged or
 * foreign code is refused as a whole and changes nothing.
 */
import { z } from 'zod';
import { emptyRecords, recordsSchema, type Records } from '../records/records';
import { parseGarage, type Garage } from '../rewards/garage';
import type { Look } from '../rewards/items';
import type { Settings } from '../settings/schema';
import { migrate, parseSettings } from '../storage/migrate';
import { progressSchema } from '../storage/progressSchema';
import { isRecord, mergeDeep } from '../util';
import type { Progress, RecentOutcome } from '../types';

/** The version this game writes; version 1 codes are still read. */
export const TRANSFER_VERSION = 2;
/** The whole link, in bytes: below the 2331 bytes of a version 40 QR code with error correction M (FR-118). */
export const TRANSFER_MAX_LINK_BYTES = 2300;
/** Longest code read (review R3): about 3.5 times the longest link written, so no real code is refused. */
export const TRANSFER_MAX_CODE_LENGTH = 8192;
/** Most bytes of JSON read from a compressed code (review R3, P8); unpacking stops there, so a crafted code cannot freeze the tab. */
export const TRANSFER_MAX_JSON_BYTES = 65_536;
/** Longest stored mastery window (data-model.md SkillProgress). */
const WINDOW_MAX = 10;
const FRAGMENT = 'save=';
const intMin0 = () => z.number().int().min(0);

export interface SaveData {
  settings: Settings;
  progress: Progress;
  records: Records;
  garage: Garage;
}

type SkillTuple = [step: number, attempts: number, independentCorrect: number, assisted: number, guesses: number, window: string];
type SessionTuple = [id: string, startedAt: number, lastActiveAt: number, attempts: number, independentCorrect: number, assisted: number];

/** The full transfer, before it is made compact; it is also the shape of a version 1 code. */
export interface TransferV1 {
  v: 1;
  settings: Settings;
  garage: { stars: number; look: Look };
  records: Records['best'];
  skills: Record<string, SkillTuple>;
  /** Oldest first, like Progress.sessions. */
  sessions: SessionTuple[];
}

/** What the receive dialog shows (FR-119). */
export interface TransferSummary {
  stars: number;
  /** The most enemies of any personal best; 0 without one. */
  record: number;
  min: number;
  max: number;
}

export interface Codec {
  deflate(bytes: Uint8Array): Promise<Uint8Array>;
  /** Rejects when the unpacked data would be longer than `maxBytes`. */
  inflate(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>;
}

export interface EncodedTransfer {
  link: string;
  /** `v2.<data>`, the part after `#save=`. */
  code: string;
  /**
   * False when the link is longer than the limit even with no sessions and empty mastery windows; `link` is then still
   * the shortest link, for "Link kopieren" (FR-118).
   */
  fits: boolean;
  /** Oldest session totals left out (FR-118). */
  sessionsDropped: number;
  /** Length every mastery window was cut to; 10 when no window was shortened. */
  windowLength: number;
}

export type DecodedTransfer = { ok: true; data: SaveData; summary: TransferSummary } | { ok: false };

const LETTER: Record<RecentOutcome, string> = { independent: 'i', close: 'c', assisted: 'a', unsolved: 'u' };
const OUTCOME: Record<string, RecentOutcome> = { i: 'independent', c: 'close', a: 'assisted', u: 'unsolved' };

/** The compact transfer of a save; no attempt history and no `recent` lists (FR-116). */
export function toTransfer(data: SaveData): TransferV1 {
  const skills: Record<string, SkillTuple> = {};
  for (const [key, sp] of Object.entries(data.progress.skills)) {
    skills[key] = [sp.step, sp.attempts, sp.independentCorrect, sp.assisted, sp.guesses, sp.masteryWindow.map((o) => LETTER[o]).join('')];
  }
  return {
    v: 1,
    settings: data.settings,
    garage: { stars: data.garage.stars, look: { ...data.garage.look } },
    records: data.records.best,
    skills,
    sessions: data.progress.sessions.map((s) => [s.id, s.startedAt, s.lastActiveAt, s.attempts, s.independentCorrect, s.assisted]),
  };
}

async function pipe(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const body = new Response(bytes as BodyInit).body!;
  return new Uint8Array(await new Response(body.pipeThrough(stream)).arrayBuffer());
}

/** Unpacks chunk by chunk and stops as soon as the output passes `maxBytes` (review R3). */
async function pipeLimited(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = new Response(bytes as BodyInit).body!.pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RangeError('transfer data too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** `deflate-raw` through CompressionStream and DecompressionStream; null when the browser has neither. */
export function browserCodec(): Codec | null {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') return null;
  return {
    deflate: (bytes) => pipe(bytes, new CompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>),
    inflate: (bytes, maxBytes) => pipeLimited(bytes, new DecompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>, maxBytes),
  };
}

function toBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The page address without its fragment, plus `#save=<code>` (FR-117). */
export function transferLink(pageHref: string, code: string): string {
  const hash = pageHref.indexOf('#');
  return `${hash < 0 ? pageHref : pageHref.slice(0, hash)}#${FRAGMENT}${code}`;
}

/** The code of a `#save=` fragment, or null for any other fragment. */
export function saveCodeFromHash(hash: string): string | null {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  return body.startsWith(FRAGMENT) ? body.slice(FRAGMENT.length) : null;
}

/** The parts of `value` that differ from `base`, object by object; `version` always stays. */
function settingsDiff(value: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    const b = base[key];
    if (key === 'version') out[key] = v;
    else if (isRecord(v) && isRecord(b)) {
      const inner = settingsDiff(v, b);
      if (Object.keys(inner).length > 0) out[key] = inner;
    } else if (JSON.stringify(v) !== JSON.stringify(b)) out[key] = v;
  }
  return out;
}

/**
 * The base that version 2 codes store their settings differences against: the version 6 defaults, frozen (review T1).
 * Writer and reader both use it, whatever the current defaults are, so changing a default later never changes what an
 * existing code means. The settings version travels in the differences, and the reader migrates from it.
 * Amendment 18 adds `pointAfterFullHelp: true`: older codes hold no such field and the version 8 to 9 step gives the same
 * value, so no existing code changes meaning, and a code with the setting on leaves the field out.
 */
export const TRANSFER_V2_SETTINGS_BASE = deepFreeze({
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
  pointAfterFullHelp: true,
});

function deepFreeze<T extends Record<string, unknown>>(o: T): Readonly<T> {
  for (const v of Object.values(o)) if (isRecord(v)) deepFreeze(v);
  return Object.freeze(o);
}

const EMPTY_WINDOW = '';

/** Transfer version 2: `[settings, garage, records, skills, sessions]` (T305). */
function compact(t: TransferV1): unknown[] {
  const skills = Object.entries(t.skills)
    .filter(([, s]) => s[0] !== 0 || s[1] !== 0 || s[2] !== 0 || s[3] !== 0 || s[4] !== 0 || s[5] !== EMPTY_WINDOW)
    .map(([key, s]) => [key, ...s]);
  let previous = 0;
  const sessions = t.sessions.map(([id, startedAt, lastActiveAt, attempts, independentCorrect, assisted]) => {
    const counter = id.startsWith(`${startedAt}-`) ? id.slice(String(startedAt).length + 1) : null;
    const shortId = counter !== null && /^(0|[1-9]\d{0,5})$/.test(counter) ? Number(counter) : id;
    const row = [startedAt - previous, lastActiveAt - startedAt, attempts, independentCorrect, assisted, shortId];
    previous = startedAt;
    return row;
  });
  const { color, flag, trail, hat } = t.garage.look;
  return [
    settingsDiff(t.settings as unknown as Record<string, unknown>, TRANSFER_V2_SETTINGS_BASE),
    [t.garage.stars, color, flag, trail, hat],
    Object.entries(t.records).map(([key, r]) => [key, r.enemies, r.ms, r.at]),
    skills,
    sessions,
  ];
}

const compactSchema = z.tuple([
  z.record(z.string(), z.unknown()),
  z.tuple([z.unknown(), z.string(), z.string(), z.string(), z.string()]),
  z.array(z.tuple([z.string(), z.unknown(), z.unknown(), z.unknown()])),
  z.array(z.tuple([z.string(), intMin0(), intMin0(), intMin0(), intMin0(), intMin0(), z.string()])),
  z.array(z.tuple([z.number(), z.number(), intMin0(), intMin0(), intMin0(), z.union([intMin0(), z.string()])])),
]);

/** A version 2 payload in the shape of version 1. The settings differences are laid over the frozen version 6 defaults. */
function expand(raw: unknown): unknown {
  const parsed = compactSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const [diff, [stars, color, flag, trail, hat], records, skills, sessions] = parsed.data;
  let startedAt = 0;
  return {
    v: 1,
    settings: mergeDeep(TRANSFER_V2_SETTINGS_BASE, diff),
    garage: { stars, look: { color, flag, trail, hat } },
    records: Object.fromEntries(records.map(([key, enemies, ms, at]) => [key, { enemies, ms, at }])),
    skills: Object.fromEntries(skills.map(([key, ...s]) => [key, s])),
    sessions: sessions.map(([startDelta, activeDelta, attempts, independentCorrect, assisted, id]) => {
      startedAt += startDelta;
      return [typeof id === 'number' ? `${startedAt}-${id}` : id, startedAt, startedAt + activeDelta, attempts, independentCorrect, assisted];
    }),
  };
}

async function codeOf(t: TransferV1, codec: Codec | null): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(compact(t)));
  return `v${TRANSFER_VERSION}.${toBase64url(codec ? await codec.deflate(json) : json)}`;
}

function trimmed(t: TransferV1, sessionsDropped: number, windowLength: number): TransferV1 {
  const skills: Record<string, SkillTuple> = {};
  for (const [key, s] of Object.entries(t.skills)) {
    skills[key] = [s[0], s[1], s[2], s[3], s[4], windowLength >= s[5].length ? s[5] : s[5].slice(s[5].length - windowLength)];
  }
  return { ...t, skills, sessions: t.sessions.slice(sessionsDropped) };
}

/**
 * The link for a save. When it is longer than `maxBytes`, the oldest session totals are left out first, then every
 * mastery window is cut to its newest entries, one entry at a time (FR-118).
 */
export async function encodeTransfer(
  data: SaveData,
  pageHref: string,
  opts: { codec?: Codec | null; maxBytes?: number } = {},
): Promise<EncodedTransfer> {
  const codec = opts.codec === undefined ? browserCodec() : opts.codec;
  const maxBytes = opts.maxBytes ?? TRANSFER_MAX_LINK_BYTES;
  const full = toTransfer(data);
  // The searches below ask for some sizes twice (the check after the binary search, the last session count), so each
  // result is compressed once.
  const tried = new Map<string, Promise<EncodedTransfer>>();
  const attempt = (dropped: number, windowLength: number): Promise<EncodedTransfer> => {
    const key = `${dropped}|${windowLength}`;
    let r = tried.get(key);
    if (!r) {
      r = codeOf(trimmed(full, dropped, windowLength), codec).then((code) => {
        const link = transferLink(pageHref, code);
        return { link, code, fits: new TextEncoder().encode(link).length <= maxBytes, sessionsDropped: dropped, windowLength };
      });
      tried.set(key, r);
    }
    return r;
  };

  const first = await attempt(0, WINDOW_MAX);
  if (first.fits) return first;

  // The fewest dropped sessions that fit: a binary search, then a check, because compressed sizes are not strictly
  // monotonic.
  const n = full.sessions.length;
  let lo = 1;
  let hi = n;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await attempt(mid, WINDOW_MAX)).fits) hi = mid;
    else lo = mid + 1;
  }
  for (let d = lo; d <= n; d++) {
    const r = await attempt(d, WINDOW_MAX);
    if (r.fits) return r;
  }
  let last = await attempt(n, WINDOW_MAX);
  for (let w = WINDOW_MAX - 1; w >= 0; w--) {
    last = await attempt(n, w);
    if (last.fits) return last;
  }
  return last;
}

const transferSchema = z.object({
  v: z.literal(1),
  settings: z.unknown(),
  garage: z.object({ stars: z.unknown(), look: z.unknown() }),
  records: z.unknown(),
  skills: z.record(z.string(), z.tuple([intMin0(), intMin0(), intMin0(), intMin0(), intMin0(), z.string().regex(/^[icau]{0,10}$/)])),
  sessions: z.array(z.tuple([z.string(), z.number(), z.number(), intMin0(), intMin0(), intMin0()])),
});

/** Uncompressed data starts with '{' (version 1) or '[' (version 2). */
function isJsonStart(bytes: Uint8Array): boolean {
  return bytes.length > 0 && (bytes[0] === 0x7b || bytes[0] === 0x5b);
}

function parseObject(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

async function readJson(bytes: Uint8Array, codec: Codec | null): Promise<unknown> {
  // Uncompressed data is JSON; anything else is compressed.
  if (isJsonStart(bytes) && bytes.length <= TRANSFER_MAX_JSON_BYTES) {
    const plain = parseObject(bytes);
    if (plain !== undefined) return plain;
  }
  if (!codec) return undefined;
  try {
    return parseObject(await codec.inflate(bytes, TRANSFER_MAX_JSON_BYTES));
  } catch {
    return undefined;
  }
}

/**
 * Reads `v1.<data>` (still accepted) or `v2.<data>` (written since T305) with the same schemas and migrations as storage (FR-120); any failure refuses the
 * whole code. Codes longer than 8192 characters, and compressed data that unpacks to more than 64 KB, are refused
 * (review R3).
 */
export async function decodeTransfer(code: string, opts: { codec?: Codec | null } = {}): Promise<DecodedTransfer> {
  const codec = opts.codec === undefined ? browserCodec() : opts.codec;
  if (code.length > TRANSFER_MAX_CODE_LENGTH) return { ok: false };
  const m = /^v(\d+)\.(.+)$/.exec(code);
  const version = m ? Number(m[1]) : 0;
  if (!m || (version !== 1 && version !== 2)) return { ok: false };
  const bytes = fromBase64url(m[2]!);
  if (!bytes) return { ok: false };
  const json = await readJson(bytes, codec);
  const parsed = transferSchema.safeParse(version === 2 ? expand(json) : json);
  if (!parsed.success) return { ok: false };
  const t = parsed.data;

  const settings = parseSettings(t.settings);
  if (!settings) return { ok: false };

  const garage = parseGarage({ version: 1, stars: t.garage.stars, look: t.garage.look });
  if (!garage) return { ok: false };

  const records = recordsSchema.safeParse({ ...emptyRecords(), best: t.records });
  if (!records.success) return { ok: false };

  const skills: Record<string, unknown> = {};
  for (const [key, [step, attempts, independentCorrect, assisted, guesses, window]] of Object.entries(t.skills)) {
    skills[key] = { step, recent: [], masteryWindow: [...window].map((c) => OUTCOME[c]), guesses, attempts, independentCorrect, assisted };
  }
  const sessions = t.sessions.map(([id, startedAt, lastActiveAt, attempts, independentCorrect, assisted]) => ({
    id,
    startedAt,
    lastActiveAt,
    attempts,
    independentCorrect,
    assisted,
  }));
  const progress = progressSchema.safeParse(migrate({ version: 1, attempts: [], skills, sessions }, 'progress'));
  if (!progress.success) return { ok: false };

  const data: SaveData = { settings, progress: progress.data, records: records.data, garage };
  return { ok: true, data, summary: transferSummary(data) };
}

export function transferSummary(data: SaveData): TransferSummary {
  const record = Object.values(data.records.best).reduce((most, b) => Math.max(most, b.enemies), 0);
  return { stars: data.garage.stars, record, min: data.settings.range.min, max: data.settings.range.max };
}
