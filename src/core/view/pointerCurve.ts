/**
 * Pointer line styles (amendment 21, FR-144 to FR-146).
 */
import type { Settings } from '../types';

export type LineStyle = Settings['lineStyle'];

/** The style drawn: "Gebogen und verschlungen" needs 2 or more enemies at once; with 1 it is drawn as "Gebogen". */
export function effectiveLineStyle(settings: Pick<Settings, 'lineStyle' | 'enemiesAtOnce'>): LineStyle {
  return settings.lineStyle === 'tangled' && settings.enemiesAtOnce < 2 ? 'curved' : settings.lineStyle;
}
