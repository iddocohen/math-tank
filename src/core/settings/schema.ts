import { z } from 'zod';

/**
 * Structural schema for persisted settings, version 7 (`mathtanks.settings.v1`, research R11 and R23; amendments 06, 11 and 12; version 7 for PO1).
 * Cross-field rules (range order, linked limits) live in validate.ts.
 */
export const rangePresetSchema = z.enum(['0-10', '0-20', '0-50', '0-100', '0-1000', 'custom']);

export const rangeSchema = z.object({
  preset: rangePresetSchema,
  min: z.number().int(),
  max: z.number().int(),
});

/** Ruler detail level (FR-017). */
export const rulerLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const settingsSchema = z.object({
  version: z.literal(7),
  challengeTypes: z.object({
    numberLine: z.boolean(),
    addition: z.boolean(),
    subtraction: z.boolean(),
    comparison: z.boolean(),
  }),
  range: rangeSchema,
  addition: z.object({
    maxOperand: z.number().int(),
    maxResult: z.number().int(),
    steps: z.union([z.literal(1), z.literal(2)]),
  }),
  subtraction: z.object({
    maxOperand: z.number().int(),
    steps: z.union([z.literal(1), z.literal(2)]),
  }),
  crossTens: z.boolean(),
  crossHundreds: z.boolean(),
  negativeResults: z.boolean(),
  rulerLevelStart: rulerLevelSchema,
  rulerLevelMax: rulerLevelSchema,
  enemyDifficulty: z.enum(['easy', 'normal', 'challenging']),
  help: z.object({
    nearestTen: z.boolean(),
    countSteps: z.boolean(),
    zoom: z.boolean(),
    stepAnimation: z.boolean(),
  }),
  beginnerAssist: z.boolean(),
  sound: z.object({
    effects: z.boolean(),
    music: z.boolean(),
    speech: z.boolean(),
  }),
  /** How a round ends (amendment 06, FR-082): until the 3 hearts are gone, or after `roundLength` destroyed enemies. */
  roundType: z.enum(['untilHearts', 'enemyCount']),
  /** Enemies per round for `roundType: 'enemyCount'`, 1 to 20. */
  roundLength: z.number().int(),
  adaptive: z.boolean(),
  freePlay: z.boolean(),
  noDamage: z.boolean(),
  /** An up-counting clock at the top during play (FR-084). */
  showClock: z.boolean(),
  /** "Neuer Rekord!" or "Dein Rekord: N" on the end screen (FR-086). */
  showRecords: z.boolean(),
  timeLimitSeconds: z.number().int().nullable(),
  /** "Garage und Sterne" (amendment 11, FR-096): the garage, the star total, the unlock line and the chosen look. */
  garage: z.boolean(),
  /** "Zahlenfeld" (amendment 12, FR-102): the on-screen number pad in battle, automatic, always or never. */
  numberPad: z.enum(['auto', 'always', 'never']),
});

export type Settings = z.infer<typeof settingsSchema>;
export type RoundType = Settings['roundType'];
export type RangePreset = z.infer<typeof rangePresetSchema>;
export type SettingsRange = z.infer<typeof rangeSchema>;
