/**
 * Amendment 12 (FR-104): a phone held upright shows a full-screen picture "Bitte dreh das Handy" with a turning phone,
 * and the gear, so the parent can still reach the settings and progress pages.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { RotateScreen } from './RotateScreen';

afterEach(cleanup);

describe('RotateScreen (amendment 12)', () => {
  it('shows the text, the turning phone and the gear', () => {
    render(<RotateScreen gear={<button type="button" data-testid="gear-stub" />} />);
    const root = screen.getByTestId('rotate-screen');
    expect(root.textContent).toContain(t().rotate.turnPhone);
    expect(root.querySelector('.rotate-phone')).not.toBeNull();
    expect(screen.getByTestId('gear-stub')).toBeTruthy();
    expect(root.getAttribute('role')).toBe('alert');
  });
});
