import type { PromptSpec } from '../core/types';
import { de } from './de';

/** The shape every translation table must have; de.ts is the source of truth for keys. */
export type Messages = typeof de;

const active: Messages = de;

/** The active translation table. */
export function t(): Messages {
  return active;
}

/** Encouraging phrases shown after a wrong answer (FR-033). */
export const encouragements: readonly string[] = active.encouragements;

/** No child-facing string may contain one of these, case-insensitive, also inside compounds (FR-033, SC-006). */
export const forbiddenWords: readonly string[] = ['falsch', 'verloren', 'Fehler', 'versagt', 'schlecht', 'dumm'];

/**
 * The banner text of a challenge prompt (T068, T069): the translation under `prompt.key`, called with the parameters
 * in the order the builders use (n, k) or (a, b). An unknown key gives an empty string.
 */
export function promptText(prompt: PromptSpec): string {
  const entry = (active.challenge as Record<string, unknown>)[prompt.key];
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'function') return '';
  const p = prompt.params;
  const args = 'a' in p ? [p.a, p.b] : [p.n, p.k];
  return (entry as (...args: Array<number | undefined>) => string)(...args);
}
