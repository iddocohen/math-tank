import { z } from 'zod';

/**
 * Structural schema for persisted settings (`mathtanks.settings.v1`, research R11).
 * Cross-field rules (range order, linked limits) live in validate.ts.
 */
export const rangePresetSchema = z.enum(['0-10', '0-20', '0-50', '0-100', '0-1000', 'custom']);

export const rangeSchema = z.object({
  preset: rangePresetSchema,
  min: z.number().int(),
  max: z.number().int(),
});

export const settingsSchema = z.object({
  version: z.literal(1),
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
  labelLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  enemyDifficulty: z.enum(['easy', 'normal', 'challenging']),
  help: z.object({
    nearestTen: z.boolean(),
    countSteps: z.boolean(),
    zoom: z.boolean(),
    stepAnimation: z.boolean(),
  }),
  beginnerAssist: z.boolean(),
  aimCorrection: z.boolean(),
  sound: z.object({
    effects: z.boolean(),
    music: z.boolean(),
    speech: z.boolean(),
  }),
  roundLength: z.number(),
  adaptive: z.boolean(),
  freePlay: z.boolean(),
  noDamage: z.boolean(),
  timeLimitSeconds: z.number().nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type RangePreset = z.infer<typeof rangePresetSchema>;
export type SettingsRange = z.infer<typeof rangeSchema>;
