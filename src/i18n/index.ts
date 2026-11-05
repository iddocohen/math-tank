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

/** Keys of the comparison prompts (amendment 09): the banner adds the options after the question. */
const COMPARISON_KEYS = ['greater', 'smaller', 'largest3', 'smallest3', 'closestTo', 'between', 'middle3'];

/**
 * A comparison prompt in parts, so the banner can mark each option (FR-026, FR-031): the question, the options in
 * banner order and what stands between them (" oder " for two, ", " for three). Null for other prompts.
 */
export function comparisonPrompt(prompt: PromptSpec): { lead: string; options: number[]; separator: string } | null {
  if (!COMPARISON_KEYS.includes(prompt.key)) return null;
  const p = prompt.params;
  const options = [p.o1, p.o2, p.o3].filter((o): o is number => o !== undefined);
  const entry = (active.challenge as Record<string, unknown>)[prompt.key];
  let lead = String(entry);
  if (typeof entry === 'function') {
    const call = entry as (...args: Array<number | undefined>) => string;
    lead = prompt.key === 'between' ? call(p.a, p.b) : call(p.n);
  }
  return { lead, options, separator: options.length === 2 ? ` ${active.challenge.optionsOr} ` : ', ' };
}

/**
 * The banner text of a challenge prompt (T068, T069): the translation under `prompt.key`, called with the parameters
 * in the order the builders use (n, k) or (a, b, c). An unknown key gives an empty string.
 */
export function promptText(prompt: PromptSpec): string {
  const comparison = comparisonPrompt(prompt);
  if (comparison) return `${comparison.lead} ${comparison.options.join(comparison.separator)}`;
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
