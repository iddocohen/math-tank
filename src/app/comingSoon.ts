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
  'playModes.mixed',
  'playModes.ruler',
  'playModes.math',
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
  'garage',
  'numberPad',
] as const;

export type SettingField = (typeof SETTING_FIELDS)[number];

/** Empty since Phase 23 built spoken instructions and the music loop (T138, T142). */
export const COMING_SOON: readonly SettingField[] = [];

export function isComingSoon(field: SettingField): boolean {
  return COMING_SOON.includes(field);
}
