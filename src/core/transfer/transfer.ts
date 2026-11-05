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
import { defaultSettings } from '../settings/defaults';
import { emptyRecords, recordsSchema, type Records } from '../records/records';
import { parseGarage, type Garage } from '../rewards/garage';
import type { Look } from '../rewards/items';
import { settingsSchema, type Settings } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import { migrate } from '../storage/migrate';
import { progressSchema } from '../storage/progressSchema';
import type { Progress, RecentOutcome } from '../types';

/** The version this game writes; version 1 codes are still read. */
export const TRANSFER_VERSION = 2;
/** The whole link, in bytes: below the 2331 bytes of a version 40 QR code with error correction M (FR-118). */
export const TRANSFER_MAX_LINK_BYTES = 2300;
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
  inflate(bytes: Uint8Array): Promise<Uint8Array>;
}

export interface EncodedTransfer {
  link: string;
  /** `v1.<data>`, the part after `#save=`. */
  code: string;
  /** False when the link is longer than the limit even with no sessions and empty mastery windows. */
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

/** `deflate-raw` through CompressionStream and DecompressionStream; null when the browser has neither. */
export function browserCodec(): Codec | null {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') return null;
  return {
    deflate: (bytes) => pipe(bytes, new CompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>),
    inflate: (bytes) => pipe(bytes, new DecompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>),
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The parts of `value` that differ from `base`, object by object; `version` always stays. */
function settingsDiff(value: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    const b = base[key];
    if (key === 'version') out[key] = v;
    else if (isPlainObject(v) && isPlainObject(b)) {
      const inner = settingsDiff(v, b);
      if (Object.keys(inner).length > 0) out[key] = inner;
    } else if (JSON.stringify(v) !== JSON.stringify(b)) out[key] = v;
  }
  return out;
}

/** `base` with every part of `diff` laid over it; keys that would change an object's prototype are skipped. */
function withDiff(base: Record<string, unknown>, diff: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, v] of Object.entries(diff)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const b = Object.hasOwn(base, key) ? base[key] : undefined;
    out[key] = isPlainObject(v) && isPlainObject(b) ? withDiff(b, v) : v;
  }
  return out;
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
    settingsDiff(t.settings as unknown as Record<string, unknown>, defaultSettings() as unknown as Record<string, unknown>),
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

/**
 * A version 2 payload in the shape of version 1. The settings differences are laid over the defaults of this game's
 * settings version; a later settings version must keep the version 6 defaults for codes written with them.
 */
function expand(raw: unknown): unknown {
  const parsed = compactSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const [diff, [stars, color, flag, trail, hat], records, skills, sessions] = parsed.data;
  let startedAt = 0;
  return {
    v: 1,
    settings: withDiff(defaultSettings() as unknown as Record<string, unknown>, diff),
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
  const attempt = async (dropped: number, windowLength: number) => {
    const code = await codeOf(trimmed(full, dropped, windowLength), codec);
    const link = transferLink(pageHref, code);
    return { link, code, fits: new TextEncoder().encode(link).length <= maxBytes, sessionsDropped: dropped, windowLength };
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
  if (isJsonStart(bytes)) {
    const plain = parseObject(bytes);
    if (plain !== undefined) return plain;
  }
  if (!codec) return undefined;
  try {
    return parseObject(await codec.inflate(bytes));
  } catch {
    return undefined;
  }
}

/** Reads `v1.<data>` or `v2.<data>` with the same schemas and migrations as storage (FR-120); any failure refuses the whole code. */
export async function decodeTransfer(code: string, opts: { codec?: Codec | null } = {}): Promise<DecodedTransfer> {
  const codec = opts.codec === undefined ? browserCodec() : opts.codec;
  const m = /^v(\d+)\.(.+)$/.exec(code);
  const version = m ? Number(m[1]) : 0;
  if (!m || (version !== 1 && version !== 2)) return { ok: false };
  const bytes = fromBase64url(m[2]!);
  if (!bytes) return { ok: false };
  const json = await readJson(bytes, codec);
  const parsed = transferSchema.safeParse(version === 2 ? expand(json) : json);
  if (!parsed.success) return { ok: false };
  const t = parsed.data;

  const settings = settingsSchema.safeParse(migrate(t.settings, 'settings'));
  if (!settings.success || !validateSettings(settings.data).ok) return { ok: false };

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

  const data: SaveData = { settings: settings.data, progress: progress.data, records: records.data, garage };
  return { ok: true, data, summary: transferSummary(data) };
}

export function transferSummary(data: SaveData): TransferSummary {
  const record = Object.values(data.records.best).reduce((most, b) => Math.max(most, b.enemies), 0);
  return { stars: data.garage.stars, record, min: data.settings.range.min, max: data.settings.range.max };
}
