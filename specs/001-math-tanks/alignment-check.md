# Spec/Ask Alignment Check: Math Tanks

**Date**: 2026-11-05

## Source

The inline PRD passed to `/speckit.opsmill.auto`, stored verbatim in [source-prd.md](./source-prd.md). No URLs were given.

## Verdict

⚠️ MINOR DRIFT (proceeding)

Every PRD section and acceptance criterion AC-01 to AC-10 maps to spec requirements. The differences below are deferrals the PRD itself allows, or interpretations of open PRD wording. None removes or weakens a PRD requirement.

## Findings

| Severity | Category | PRD reference | Spec reference | Description |
|----------|----------|---------------|----------------|-------------|
| Minor | dropped (allowed) | 7.3 Rewards | Assumptions, "Deferred" | Stars, badges and cosmetic unlocks are deferred. The PRD marks all rewards "optional" and section 14 defers cosmetic unlocks. Stars and badges are not in the section 14 MVP list. |
| Minor | changed | 5 Subtraction configuration ("0–10, 0–20, 0–100, custom range") | FR-023, FR-046 | Subtraction uses the global number range plus its own maximum operand, not a separate subtraction range. Section 9 asks for separate operand limits, which the spec has. |
| Minor | changed | 3.3 Major ticks "such as 0, 10, 20, 30" | FR-016 | For a whole range of width 20 or less, major ticks are every 5 (or every 10 when the range contains a multiple of 10 and is wider than 10). A custom range of exactly 30 to 40 therefore shows a major tick at 35 as well. AC-03 is met in the default 0 to 100 range, where 30 and 40 are the major ticks and 31 to 39 are minor. |
| Minor | added | 2.2, 3.1 | FR-010a | The enemy stays for up to 3 shots and the player keeps one side per round. This was added after the critique so the child can learn from misses, as PRD 2.2 requires. It is an interpretation, not new scope. |
| Minor | added | 11, 12 | FR-048a, FR-051a | Export and import of data, Home Screen instructions, and updates only on the start screen. These protect the PRD's persistence and offline requirements (AC-08, AC-10) on Safari. |
| Minor | changed | 7.2 "Reduce difficulty or offer support" | FR-037 | Support on struggle is given by lowering the difficulty step and by the always-available help. The spec does not show help earlier when a child struggles. |
| Info | changed | 12 "Phaser 3 or an equivalent" | plan.md, research.md R2 | Phaser 4.2 is used. The PRD allows an equivalent engine and asks for validation during planning. |

## Action

Proceed to implementation. No remediation pass is needed (0 of 2 used).

## Amendments 01 and 02

**Date**: 2026-11-05

The product owner (the PRD author) changed core requirements after viewing the free-play demo at commit c43f366. These are intended changes, not drift.

- **[Amendment 01](./amendment-01-number-aiming.md)** replaces PRD section 2.2 "Aim the cannon" and "Adjust shot power" (angle and power aiming) with number aiming: a fixed cannon, an automatic arc that lands the shell at the chosen number, and damage only for the exact number. It also replaces the PRD rule that a correct answer must not guarantee a hit: a correct number now always hits. These follow the product owner's instruction ("It should not be done via angles ... he should say which number the placement should be"). The finding above about FR-010a (the enemy staying for up to 3 shots) no longer applies: a player turn is now one search, and misses never give the enemy a turn, as PRD sections 7.1 and 8 require. Amendment 01 also adds keyboard-only play (number keys and Enter for every child action), which the PRD did not ask for.
- **[Amendment 02](./amendment-02-ruler-ranges-and-detail.md)** allows any range with a width from 5 to 1000 (for example 550 to 780) and raises User Story 9 from P3 to P2, which goes beyond the PRD section 14 MVP list; replaces the four labeling levels of PRD section 3.3 with five ruler detail levels set by a starting and a hardest level; removes the two-step zoom selection; and adds the "read the ruler" challenge kind, the only kind in free play.

The spec, plan, research, data model, contracts, quickstart and tasks were updated to match. Open point for the product owner: the read-the-ruler hit tolerance on ruler level 5 (spec Assumptions).

## Amendment 04

**Date**: 2026-11-05

The product owner changed the hit rule after a demo shot at 30 landed on the tank body while the enemy stood at 31 and counted as a miss. This is an intended change, not drift.

- **[Amendment 04](./amendment-04-hit-rule.md)** makes a shell on the enemy tank's body a hit in every mode, with double damage and the message "Volltreffer!" for the exact number. It replaces amendment 01 item 3 (only the exact number hits) and amendment 02 item 3 (read-the-ruler tolerance). It adds a pointer line from each visible tank to the ruler, a progress outcome `'close'` for a body hit that is not exact, and the parent setting "Genau treffen", which restores exact-only damage (settings version 3).
- PRD section 7.2 asks that progress reflects independent correct answers. The spec keeps this: only the exact number without help counts as independent (FR-075).
- The open point on the read-the-ruler tolerance on ruler level 5 is closed, because the tolerance no longer exists.

The spec (FR-066, FR-068, new FR-071 to FR-075), data model, contracts, quickstart and tasks (Phase 11a) were updated to match.

## Amendment 05

**Date**: 2026-11-05

The product owner asked to remove shortcuts to the answer and to have settings available early. This is an intended change, not drift.

- **[Amendment 05](./amendment-05-no-shortcuts-settings-early.md)** removes the arrow-key actions and the +1 and −1 buttons from amendment 01, shows no number while the child points on the ruler, and generates "Finde N" only when the child answers with mouse or touch (FR-076). The keyboard map is now digits, Minus, Backspace, Enter, Space, H and Escape. Keyboard-only play (FR-059) still works, because typing reaches every number.
- The additions make the child's tank and the enemy tank differ by color, shape and flag, add a "Du" arrow at the start of every round, and move the health bars above the tanks (FR-077, FR-078). The pointer line of FR-073 stays as built in Phase 11a.
- The parent gate and settings phases now run directly after Phase 11b, before guided mode; settings for features not built yet are shown disabled with "kommt bald" (FR-079). The progress page stays in Phase 22, because it needs the attempt records of guided mode; the amendment asks for it early, so the parent menu shows "Fortschritt" as "kommt bald" until then.
- PRD section 8 (keyboard and accessibility) is not weakened: every child action still works with the keyboard alone.

The spec (FR-017, FR-019, FR-020, FR-029, FR-053, FR-061, FR-062, new FR-076 to FR-079), data model, contracts, quickstart and tasks (Phase 11b and the moved settings phases) were updated to match.

## Amendment 06

**Date**: 2026-11-05

The product owner found the body-hit damage and the Volltreffer hard for a child to understand and asked for a simpler rule, with a score and a personal best as a reward. This is an intended change, not drift.

- **[Amendment 06](./amendment-06-one-hit-lives.md)** makes the pointer line the target: only the exact number destroys the enemy, one hit destroys it, and a new enemy appears. The enemy has no health bar. A shell on the tank body but not on the number shakes the tank and shows "Ganz knapp! Triff die Linie." as a miss. It replaces amendment 04 items 1, 2, 3, 6 and 7 (body-hit damage, the Volltreffer, double damage, the outcome `'close'` and "Genau treffen"). Amendment 04 item 5 (the pointer line) stays and gets a target ring.
- The child's tank has 3 hearts, and the enemy fires once after every 2 shots of the child, hit or miss. This changes amendment 01's rule that a miss never gives the enemy a turn (FR-013, SC-005, US5 scenario 7): a miss still never removes a heart by itself, but a second miss can be followed by an enemy shot. PRD section 6 (low frustration) is weighed against the product owner's explicit answer "hit or miss"; the spec follows the product owner.
- Rounds end when the hearts are gone (default) or after a parent-set number of destroyed enemies (1 to 20). The score is the number of destroyed enemies; the time is shown on the end screen only, unless the parent turns on the clock. A personal best per range, ruler starting level and round type is shown neutrally, or celebrated with "Neuer Rekord!". PRD section 7.3 (rewards without gambling or comparison) is kept: there is no list and no comparison with other people.
- Settings become version 4 (`exactHit` dropped, `roundType`, `showClock`, `showRecords` added, `roundLength` counts enemies). The personal bests are stored under a new key and are part of the export file.

The spec (US1, US2, US5, US6, US7, Edge Cases, FR-002, FR-006, FR-008, FR-010a, FR-013, FR-014, FR-043, FR-044, FR-046, FR-048a, FR-066, FR-068, FR-070, FR-072, FR-073, FR-075, FR-078, SC-005, SC-009, removed FR-071 and FR-074, new FR-080 to FR-087), data model, contracts, quickstart and tasks (Phase 13a) were updated to match.
