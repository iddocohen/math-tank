# Amendment 20: the ruler always shows all its lines; harder levels show fewer numbers

**Date**: 2026-11-05
**Requested by**: the product owner: "I think it is however unreasonable to ask to find the exact number when there are no lines whatsoever, so here, I think an approximation of 1 difference should be considered, or what do you suggest. The idea is that he learns the ruler and no ruler has really no lines, maybe no numbers but no lines none. Hence I think we should remove the difficulty of having no lines at all but just less and less numbers. What do you think."
**Changes**: [amendment 02](./amendment-02-ruler-ranges-and-detail.md) item 4 (ruler detail levels), FR-017, and the level-dependent enemy placement (amendment 02 item 3).

## Decision (orchestrator recommendation, explained to the product owner)

- Lines are never removed: every level draws all major, medium and minor lines of the range (FR-016 steps, plus the medium half-step lines from Phase 22b).
- Levels only reduce the numbers (labels).
- The exact-number rule stays (no ±1 tolerance): with all lines visible, the exact number can always be found by counting from the nearest labeled line; the step count after a miss already shows "1 Schritt" when the child was close.

## Ruler levels (all levels: every line drawn)

| Level | Labels |
|---|---|
| 1 | every number (two rows where needed, as today) |
| 2 | major lines only (the tens at 0 to 100) |
| 3 | every second major line, plus both ends |
| 4 | both ends and the middle major line |
| 5 | only the two ends |

## Other rules

1. The enemy (and comparison tanks) always stand on a visible line. Where the range is too wide for a line per unit (minor step 10 or more), they stand only on minor lines, as today, so the exact number stays findable at every level.
2. The aiming cross setting (amendment 19, "Zielkreuz") is independent of these levels.
3. Help steps unchanged; help step 2 still shows all labels of the zoomed ten.
4. Settings: `rulerLevelStart` and `rulerLevelMax` keep their values; levels 4 and 5 now look different (all lines, fewer numbers). No migration needed beyond documenting it.
5. The ruler previews on the settings page follow the new levels.
6. Tests first: for every level and range preset, every line is drawn (no line hidden), labels match the table, both ends are always labeled at levels 3 to 5, enemy positions are always on a drawn line; update e2e and screenshot checks that expected hidden lines.
