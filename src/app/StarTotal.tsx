/**
 * The star total (amendment 11, FR-095): a star symbol with the number, on the start screen, the end screen and in
 * the garage, never during play. Screen readers read "12 Sterne".
 */
import type { ReactElement } from 'react';
import { t } from '../i18n';

export function StarTotal({ stars }: { stars: number }): ReactElement {
  return (
    <p className="star-total" data-testid="star-total" aria-label={t().garage.stars(stars)}>
      <span aria-hidden="true" className="star-symbol">
        ★
      </span>
      <span aria-hidden="true">{stars}</span>
    </p>
  );
}
