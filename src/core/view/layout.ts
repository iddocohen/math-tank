/**
 * Screen layout of the battle (screen coordinates: y grows downward from the top of the world).
 * The ruler sits in a band below the battlefield; the ground and the tanks must stay above it
 * (product owner request, tasks.md T184, FR-015, FR-058). physics/terrain.ts FLOOR is chosen to match.
 */

/** Top and bottom of the ruler band, in world units from the top. */
export const RULER_TOP = 720;
export const RULER_BOTTOM = 820;

/** The lowest ground and every tank's bottom stay at least this far above RULER_TOP. */
export const GROUND_ABOVE_RULER_MARGIN = 12;
