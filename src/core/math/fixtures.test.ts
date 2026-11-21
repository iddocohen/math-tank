import { describe, expect, it } from 'vitest';
import { validateSettings } from '../settings/validate';
import { COMPARISON_47_74, SUBTRACTION_43_MINUS_7 } from './fixtures';

/**
 * The e2e specs store these settings before the page loads. Settings that fail a check load as the defaults, and the
 * first search is then not the fixture's (amendment 27: a mode offered without its challenge types fails, FR-162).
 */
describe('fixture settings', () => {
  it.each([
    ['SUBTRACTION_43_MINUS_7', SUBTRACTION_43_MINUS_7.settings],
    ['COMPARISON_47_74', COMPARISON_47_74.settings],
  ])('%s passes the settings check', (_name, settings) => {
    expect(validateSettings(settings)).toEqual({ ok: true });
  });
});
