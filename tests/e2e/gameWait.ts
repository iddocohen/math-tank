/**
 * How long a spec waits for a game state that depends on game time: a shell in flight, the enemy's turn, a new enemy,
 * the end of a round (P6, T303). Phaser caps the time step of a slow frame, so game time runs slower than wall time
 * when several browsers render at once; 15 seconds was sometimes too short in Chromium under that load. The waits
 * still end on a game state (`data-phase`, `data-last-landing` and the like), never after a fixed time. Real
 * slowdowns are caught by tests/e2e/performance.spec.ts (start time and frame rate), not by these waits.
 * playwright.config.ts sets it as the timeout of every `expect`; `page.waitForFunction` takes it explicitly.
 */
export const GAME_WAIT = 30_000;
