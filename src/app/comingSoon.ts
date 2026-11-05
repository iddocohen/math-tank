/**
 * Settings whose feature is not built yet (amendment 05, FR-079). The settings page shows each of them disabled
 * with the note "kommt bald" and keeps its stored value on save. Each later phase that builds a feature removes its
 * entries here.
 */

/** Every field on the settings page, by its path in `Settings` (FR-046). */
export const SETTING_FIELDS = [
  'challengeTypes.numberLine',
  'challengeTypes.addition',
  'challengeTypes.subtraction',
  'challengeTypes.comparison',
  'freePlay',
  'range',
  'negativeResults',
  'addition.maxOperand',
  'addition.maxResult',
  'addition.steps',
  'subtraction.maxOperand',
  'subtraction.steps',
  'crossTens',
  'crossHundreds',
  'rulerLevelStart',
  'rulerLevelMax',
  'help.nearestTen',
  'help.countSteps',
  'help.zoom',
  'help.stepAnimation',
  'beginnerAssist',
  'enemyDifficulty',
  'noDamage',
  'sound.effects',
  'sound.music',
  'sound.speech',
  'roundType',
  'roundLength',
  'showClock',
  'showRecords',
  'adaptive',
  'timeLimitSeconds',
] as const;

export type SettingField = (typeof SETTING_FIELDS)[number];

export const COMING_SOON: readonly SettingField[] = [
  // Phase 20: help visuals. Phase 19 built the help logic (nextHelp honors these switches), but the child sees no
  // help step until Phase 20 draws them, so the switches stay disabled until then.
  'help.nearestTen',
  'help.countSteps',
  'help.zoom',
  'help.stepAnimation',
  // Phase 23: spoken instructions. Music has no task yet.
  'sound.speech',
  'sound.music',
  // Phases 21 and 22: adaptive difficulty.
  'adaptive',
  // Phase 20: time limit. Phase 19 built tick() (decision D1); the overlay calls it and shows the limit in T101.
  'timeLimitSeconds',
];

export function isComingSoon(field: SettingField): boolean {
  return COMING_SOON.includes(field);
}
