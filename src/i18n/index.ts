import type { FeedbackMessage, HelpContent, PromptSpec } from '../core/types';
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
 * in the order the builders use (n, k) or (a, b, c). An unknown key gives an empty string.
 */
export function promptText(prompt: PromptSpec): string {
  const entry = (active.challenge as Record<string, unknown>)[prompt.key];
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'function') return '';
  const p = prompt.params;
  const args = 'a' in p ? [p.a, p.b, p.c] : [p.n, p.k];
  return (entry as (...args: Array<number | undefined>) => string)(...args);
}

/** The feedback line after a miss (FR-033): an encouraging phrase, or "Ganz knapp! Triff die Linie." after a near miss. */
export function messageText(m: FeedbackMessage): string {
  if (m.key === 'near') return active.battle.near;
  return active.encouragements[m.index % active.encouragements.length]!;
}

/** The text line of a help step (FR-031), or null when the step has nothing to say. */
export function helpText(h: HelpContent): string | null {
  const s = active.helpSteps;
  if (h.order && h.order.length === 3) return s.order(h.order[0]!, h.order[1]!, h.order[2]!);
  if (h.solution !== null) return s.solution(h.solution);
  if (h.direction) return s.direction[h.direction];
  if (h.nearestMajor !== null) return s.nearestTen(h.nearestMajor);
  if (h.tensDigits) return s.tensDigits;
  if (h.count) return s.countFrom(h.count.from, h.count.steps);
  if (h.stepPath) return s.stepAnimation;
  if (h.zoom) return s.zoom;
  if (h.optionMarkers) return s.optionMarkers;
  return null;
}
