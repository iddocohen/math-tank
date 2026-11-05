import { z } from 'zod';
import type { Attempt, Progress, SessionSummary, SkillProgress } from '../types';

/** Zod schemas for persisted progress (`mathtanks.progress.v1`, research R11). */

export const skillSchema = z.enum([
  'positions',
  'countForward',
  'countBackward',
  'tens',
  'crossTens',
  'addition',
  'subtraction',
  'comparison',
]);

export const challengeKindSchema = z.enum([
  'findNumber',
  'after',
  'before',
  'stepsRight',
  'stepsLeft',
  'missingBetween',
  'midpoint',
  'addition',
  'subtraction',
  'greater',
  'smaller',
  'equal',
  'order3',
  'largest3',
  'smallest3',
  'closestTo',
  'between',
]);

export const recentOutcomeSchema = z.enum(['independent', 'close', 'assisted', 'unsolved']);

export const attemptSchema: z.ZodType<Attempt> = z.object({
  challengeId: z.string(),
  seed: z.number(),
  kind: challengeKindSchema,
  skills: z.array(skillSchema),
  rangeKey: z.string(),
  difficultyStep: z.number().int().min(0),
  solved: z.boolean(),
  independent: z.boolean(),
  /** Missing in attempts stored before amendment 04, which needed the exact number to hit. */
  exact: z.boolean().default(true),
  helpLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  wrongAnswers: z.number().int().min(0),
  responseMs: z.number().min(0),
  guess: z.boolean(),
  sessionId: z.string(),
  at: z.number(),
});

export const skillProgressSchema: z.ZodType<SkillProgress> = z.object({
  step: z.number().int().min(0),
  recent: z.array(recentOutcomeSchema).max(6),
  masteryWindow: z.array(recentOutcomeSchema).max(10),
  guesses: z.number().int().min(0),
  attempts: z.number().int().min(0),
  independentCorrect: z.number().int().min(0),
  assisted: z.number().int().min(0),
});

export const sessionSummarySchema: z.ZodType<SessionSummary> = z.object({
  id: z.string(),
  startedAt: z.number(),
  lastActiveAt: z.number(),
  attempts: z.number().int().min(0),
  independentCorrect: z.number().int().min(0),
  assisted: z.number().int().min(0),
});

export const progressSchema: z.ZodType<Progress> = z.object({
  version: z.literal(1),
  attempts: z.array(attemptSchema),
  skills: z.record(z.string(), skillProgressSchema),
  sessions: z.array(sessionSummarySchema),
});
