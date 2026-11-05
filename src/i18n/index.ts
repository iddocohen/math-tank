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
