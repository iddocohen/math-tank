/**
 * Moving a save to another browser with a link or a QR code (amendment 15, FR-115 to FR-120, data-model.md
 * "Transfer code"). Engine-free: no React, no Phaser, no storage access.
 *
 * The transfer is a compact JSON object (transfer version 1) with the settings, the garage, the personal bests and the
 * progress summary, without the attempt history. It is compressed with `deflate-raw` through the browser's
 * CompressionStream (or sent uncompressed when there is none), encoded as base64url and put into the link's fragment
 * as `#save=v1.<data>`. Browsers never send the fragment to the server.
 *
 * Receiving checks every part with the same schemas and migrations as loading from storage (FR-048), so a damaged or
 * foreign code is refused as a whole and changes nothing.
 */
import { z } from 'zod';
import { emptyRecords, recordsSchema, type Records } from '../records/records';
import { parseGarage, type Garage } from '../rewards/garage';
import type { Look } from '../rewards/items';
import { settingsSchema, type Settings } from '../settings/schema';
import { validateSettings } from '../settings/validate';
import { migrate } from '../storage/migrate';
import { progressSchema } from '../storage/progressSchema';
import type { Progress, RecentOutcome } from '../types';

export const TRANSFER_VERSION = 1;
/** The whole link, in bytes: below the 2331 bytes of a version 40 QR code with error correction M (FR-118). */
export const TRANSFER_MAX_LINK_BYTES = 2300;
/** Longest stored mastery window (data-model.md SkillProgress). */
const WINDOW_MAX = 10;
const FRAGMENT = 'save=';

export interface SaveData {
  settings: Settings;
  progress: Progress;
  records: Records;
  garage: Garage;
}

type SkillTuple = [step: number, attempts: number, independentCorrect: number, assisted: number, guesses: number, window: string];
type SessionTuple = [id: string, startedAt: number, lastActiveAt: number, attempts: number, independentCorrect: number, assisted: number];

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
    v: TRANSFER_VERSION,
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

async function codeOf(t: TransferV1, codec: Codec | null): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(t));
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

const intMin0 = z.number().int().min(0);
const transferSchema = z.object({
  v: z.literal(1),
  settings: z.unknown(),
  garage: z.object({ stars: z.unknown(), look: z.unknown() }),
  records: z.unknown(),
  skills: z.record(z.string(), z.tuple([intMin0, intMin0, intMin0, intMin0, intMin0, z.string().regex(/^[icau]{0,10}$/)])),
  sessions: z.array(z.tuple([z.string(), z.number(), z.number(), intMin0, intMin0, intMin0])),
});

function isJsonObjectStart(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes[0] === 0x7b; // '{'
}

function parseObject(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

async function readJson(bytes: Uint8Array, codec: Codec | null): Promise<unknown> {
  // Uncompressed data is a JSON object; anything else is compressed.
  if (isJsonObjectStart(bytes)) {
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

/** Reads `v1.<data>` with the same schemas and migrations as storage (FR-120); any failure refuses the whole code. */
export async function decodeTransfer(code: string, opts: { codec?: Codec | null } = {}): Promise<DecodedTransfer> {
  const codec = opts.codec === undefined ? browserCodec() : opts.codec;
  const m = /^v(\d+)\.(.+)$/.exec(code);
  if (!m || Number(m[1]) !== TRANSFER_VERSION) return { ok: false };
  const bytes = fromBase64url(m[2]!);
  if (!bytes) return { ok: false };
  const parsed = transferSchema.safeParse(await readJson(bytes, codec));
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
