/**
 * PO2: on an iPhone held sideways the notch and the rounded corners cover the left or right edge, and the home bar
 * the bottom edge (`viewport-fit=cover` in index.html lets the page draw there). The battlefield keeps out of these
 * areas through `env(safe-area-inset-*)`; the number pad and the bottom bar already do. Playwright cannot show safe
 * areas, so this checks the rules in styles.css; a real iPhone check stays in T155.
 */
import { describe, expect, it } from 'vitest';

const css = Object.values(import.meta.glob<string>('./styles.css', { query: '?raw', import: 'default', eager: true }))[0] ?? '';

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('safe-area insets on a phone held sideways (PO2)', () => {
  it('the battlefield keeps out of the left and right insets', () => {
    const r = rule('.game-parent');
    expect(r).toContain('env(safe-area-inset-left)');
    expect(r).toContain('env(safe-area-inset-right)');
  });

  it('in the side layout with the number pad the battlefield also keeps out of the bottom inset', () => {
    expect(rule(".battle[data-layout='side'][data-number-pad='true'] .game-parent")).toContain('env(safe-area-inset-bottom)');
  });

  it('the pad column keeps out of the right and bottom insets', () => {
    const r = rule(".battle[data-layout='side'][data-number-pad='true'] .controls");
    expect(r).toContain('env(safe-area-inset-right)');
    expect(r).toContain('env(safe-area-inset-bottom)');
  });
});
