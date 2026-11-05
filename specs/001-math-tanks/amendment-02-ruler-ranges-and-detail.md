# Amendment 02: any number range, reading the ruler, and ruler detail levels

**Date**: 2026-11-05
**Requested by**: the product owner, after amendment 01.
**Builds on**: [amendment-01-number-aiming.md](./amendment-01-number-aiming.md).

## Decision (user's words)

"The number scale should be then configurable where e.g. it starts at 0 100, 0 1000, 550 to 780, etc. such so, the child needs to think which number would make the tank suit best. The ruler should be displayed on screen and if needed and with parent supervision, maybe sub lines are shown on the number scale such so, he learns them and can gauge better which number to choose - maybe the difficulty level will decide that."

## Changes

1. **Any range, higher priority.** The parent can set any whole-number range with a width from 5 to 1000, including ranges that do not start at 0 (for example 550 to 780), besides the presets 0 to 10, 0 to 20, 0 to 50, 0 to 100 and 0 to 1000. The battlefield always spans exactly the chosen range. User Story 9 moves from P3 to P2, and its work is scheduled right after the number-aiming rework, before the other P2 stories.
2. **The ruler is always on screen** along the bottom of the battlefield, in every mode, aligned with the battlefield (FR-015).
3. **New challenge kind "read the ruler"** (`readPosition`, main skill `positions`). The enemy is visible, and no number is given. The child looks at where the enemy stands, reads the ruler, and types or picks the number under it. This is the reverse of "Finde 37": position to number instead of number to position.
   - It is a guided challenge kind, enabled by default, and it is the only kind used in free play.
   - **Hit tolerance**: when the enemy stands exactly on a visible tick line, only the exact number hits. At ruler detail levels where the enemy may stand between visible lines (levels 4 and 5 below), a shot within half of the smallest visible step counts as a hit. Feedback still shows the exact number, for example "Treffer! Der Gegner stand bei 637."
   - Where the enemy may stand depends on the ruler detail level: on levels 1 to 3, only on whole numbers that have a tick line; on levels 4 and 5, on any whole number.
4. **Ruler detail levels replace the four labeling levels.** A level now controls both the tick lines and their labels:
   - **Stufe 1**: major and minor lines; every line labeled. When the minor labels do not fit in one row, they are drawn in two staggered rows with a smaller font; major lines and end points keep the large font in the first row. Only when two rows do not fit either (for example 0 to 1000) is only the typed number labeled, under the marker (T203, because neighbouring labels ran together; T217, because at 0 to 100 level 1 looked the same as level 2).
   - **Stufe 2**: major and minor lines; only major lines labeled.
   - **Stufe 3**: major and minor lines; only some major lines labeled (always the two end points).
   - **Stufe 4**: major lines only, no minor lines; major lines labeled.
   - **Stufe 5**: only the two end points, labeled; no other lines.
   - Minor and major steps follow FR-016 for the range width (for 550 to 780, width 230: major every 50, minor every 10; the enemy stands on a minor line at levels 1 to 3).
5. **Who decides the level.**
   - The parent sets a starting level and a hardest allowed level (default: start at 1, hardest 5). Setting both to the same value locks the level.
   - With adaptive difficulty on, the level follows the `positions` skill: it goes one level harder after repeated independent hits, and one level easier when the child struggles, within the parent's two limits.
   - With adaptive difficulty off, the starting level is used.
   - The help steps (nearest major line, zoom, counting steps) show all lines of the zoomed area temporarily, whatever the level, so help always teaches the minor lines.
6. The settings page shows a small preview of the ruler for the chosen range and level, so the parent sees what the child will see.
