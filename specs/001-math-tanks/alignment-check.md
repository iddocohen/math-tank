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

## Amendment 07

**Date**: 2026-11-05

The product owner reported that the enemy tank was missing after a page refresh, asked for the enemy to fire right after each of the child's shots while missing on purpose most of the time, and asked for the step count under the ruler back. The enemy was not off the battlefield: guided searches hid it by design (amendment 01 item 4, FR-010). This is an intended change, not drift.

- **[Amendment 07](./amendment-07-visible-enemy-return-fire.md)** makes the enemy and its pointer line visible in every mode and challenge kind. The challenge banner stays the task; the child may solve it or read the ruler, and both practise the number line (PRD section 3.1). It replaces amendment 01 item 4 (the hidden enemy) and FR-010's rule that the enemy's position is not inferable during a search. Comparison turns keep the enemy among identical decoys.
- After every miss or near miss, the ruler shows the bracket from the landing number to the enemy with the step count, in every mode. This removes the rule of tasks T068 and T215 that hid the step count during a search.
- The enemy fires right after every shot of the child that does not destroy it. This replaces amendment 06 item 6 (one enemy shot after every 2 shots). Its shell usually lands 40 to 100 world units beside the child's tank, and a seeded draw makes it hit about 1 in 6 ("Leicht"), 1 in 4 ("Normal") or 1 in 3 ("Herausfordernd") shots; the first shot of a round always misses. PRD section 8 is kept: the enemy fires with visible trajectories (from its own tank, except in comparison turns, where the shell enters from the top edge so it does not show which tank is the enemy), its accuracy varies by difficulty, and the draw never depends on the child's answers, help use or mistakes, so the enemy does not exploit the child's mathematics difficulties. "Leicht" stays forgiving: about 1 hit in 6 shots, and never on the first shot.
- `RoundState` loses `shotsSinceEnemyFire` and `enemyFound`; `getState()` no longer reduces the enemy during a search. The enemy no longer aims with random error added to `solveAim`: research R18's error model is replaced by the hit draw and a deliberate near miss.

The spec (Overview, US1, US2, US4 scenario 2, US5, Edge Cases, FR-002, FR-010, FR-010a, FR-013, FR-014, FR-041, FR-042, FR-043, FR-066, FR-072, FR-073, FR-081, SC-005, Key Entities, Assumptions, new FR-043a), data model, contracts, quickstart and tasks (Phase 18b) were updated to match.

## Amendment 08

**Date**: 2026-11-05

The product owner reported that "Neue Landschaft" put several numbered tanks on the field and reset the round, which was not the idea of the button. This is an intended change, not drift.

- **[Amendment 08](./amendment-08-refresh-keeps-round.md)** keeps the round going when the child presses "Neue Landschaft": new hills and exactly one enemy at a new position, with a new challenge of any enabled kind (since Phase 22b, T243, a comparison is allowed, because a comparison turn has one enemy since amendment 09). Hearts, the destroyed-tank counter, the round time and the personal-best tracking continue, and the enemy does not fire because of the press. It replaces amendment 03 item 2 (the button started a new round). A new round starts only from the round-end screen or the start screen.
- PRD section 7.3 is kept: a refresh cannot be used to reset a lost heart or the time, so the score and the personal best still count only exact hits within one round.

The spec (FR-070), contracts and tasks (T232 in Phase 22) were updated to match.

## Amendment 09

**Date**: 2026-11-05

The product owner saw three identical red tanks with number plates in a comparison turn and asked why there was more than one enemy. They also saw an "equal" challenge that gave its answer away ("Welche Zahl ist gleich 57?" next to a tank labelled 57). This is an intended change, not drift.

- **[Amendment 09](./amendment-09-comparison-one-enemy.md)** shows exactly one enemy in comparison turns, at the correct option, like in every other turn. The banner names the options ("Der Gegner steht bei der größeren Zahl: 47 oder 74"), and the child types the number or picks it on the ruler and fires.
- PRD section 6 asks the child to "select between two or more target objects" in comparison challenges and lists "equal to" and "ordering three numbers". The product owner's decision replaces these parts: the options are named in the banner instead of standing on separate tanks, "equal to" is removed because the question names its own answer, and "ordering three numbers" becomes "middle of three", which needs no tapping order.
- Decoy tanks, number plates, tank tapping, order badges and the shell from the top edge in comparison turns are removed. `RoundState` loses `decoys`, `orderTaps` and `notOnTank`; `Challenge` loses `orderAnswer`.
- Comparison options stay in range, distinct, at least 2 numbers apart (more at larger ranges) and with exactly one correct answer. Help step 1 highlights the tens digits in the banner, step 2 marks each option on the ruler, step 3 shows the solution.
- The learning records, adaptive difficulty and the comparison skill stay. Attempts stored with the removed kinds still load.

The spec (US4, Edge Cases, FR-026, FR-027, FR-031, FR-043a, FR-064, FR-066, FR-070, FR-077, FR-081, Key Entities, Assumptions), data model, contracts, quickstart and tasks (Phase 22a) were updated to match.

## Amendment 10

**Date**: 2026-11-05

After playing amendment 09, the product owner said: "I liked the decoy tanks, they were better than the implementation now as it feels boring." The follow-up answer: decoys come back without number plates. This is an intended change, not drift.

- **[Amendment 10](./amendment-10-decoys-without-plates.md)** shows one tank per option named in the banner: the real enemy at the correct option and identical decoys at the others, each with its pointer line and target ring and no number plate. The child reads the ruler to find the tank at the answer, then types the number, picks it on the ruler or taps the tank.
- PRD section 6 asks the child to "select between two or more target objects" in comparison challenges. Amendment 10 brings back the target objects; the options are still named in the banner, so the child reads them from the question and finds their positions on the ruler instead of reading number plates.
- A shot at a decoy bursts it like a cardboard dummy with a light "plopp" sound. It counts as a miss for the help steps and the learning records, and the enemy fires back (amendment 07). PRD sections 7.3 and 8 are kept: the sound is light, not negative, and the score still counts only destroyed enemies.
- The enemy's shell enters from the top edge in comparison turns again, and the step count after a miss refers to the nearest standing tank, so neither shows which tank is the enemy.
- All option tanks and the child's tank keep the minimum tank gap, so `minOptionGap` becomes at least `minTankGap`.
- Item 10 restores amendment 08 item 1: "Neue Landschaft" never starts a comparison turn, so right after it exactly one enemy stands on the field. Phase 22b task T243 had removed that rule after amendment 09; amendment 10 reverts T243.
- Unchanged from amendment 09: the banner question, the removed kinds "equal" and "order3", the "middle of three" kind, help steps 1 and 2, and the learning records.

The spec (US4, Edge Cases, FR-010, FR-026, FR-027, FR-031, FR-043a, FR-064, FR-066, FR-070, FR-072, FR-073, FR-077, FR-081, Key Entities, Assumptions), amendment 08 item 1, the data model, the contracts, quickstart (AC-06) and tasks (Phase 22c) were updated to match.

## Amendment 11

**Date**: 2026-11-05

The product owner asked: "What is one missing feature that would make this game from good to great for a child", accepted the recommended tank garage, and said "Yes do it". This is an intended addition, not drift.

- **[Amendment 11](./amendment-11-tank-garage.md)** implements PRD section 7.3 (rewards: new tank appearances, projectile visual effects, unlockable cosmetic upgrades), which PRD section 14 had deferred until the core experience works. The spec's Assumptions listed these rewards as deferred; that entry now names only what stays deferred (achievement badges, advanced AI, detailed analytics, battlefield themes).
- PRD section 7.3 requires that rewards do not depend on perfect performance and have no gambling-like mechanics or monetization. Stars come from every destroyed enemy, mistakes never cost stars, items unlock in a fixed order every 10 stars, and there is no chance, no shop and no comparison with other people (FR-087, FR-089, FR-090).
- PRD section 8 (low frustration) is kept: the end screen names only new items and the star total, never how many stars are missing, and nothing is shown during play (FR-094, FR-095).
- The parent can turn the garage off, export and import the stars, and reset them separately from the learning progress (FR-096).
- Decisions of this update that the amendment does not state: 13 items (the amendment says "about 12" and names 4 colors, 4 new flags, 3 trails and 2 hats); unlocked items are derived from the star total and not stored separately; the garage numbers items 1 to 17, so items above 9 take two digits; with the garage off the child's tank uses the standard look; stars live under their own storage key `mathtanks.garage.v1` so "Fortschritt zurücksetzen" cannot touch them.

The spec (new US10, Edge Cases, FR-040, FR-046, FR-048a, FR-062, FR-087, new FR-089 to FR-097, Key Entities, Assumptions), the data model (Settings version 5, Garage), the contracts (`core/rewards`, `core/storage`, garage screen, keyboard map), quickstart (scenario 23) and tasks (Phases 22d and 22e) were updated to match.

## Amendment 13

**Date**: 2026-11-05

The product owner said: "The enemy AI is too simple in the sense he never hits my tank no matter how many times I miss. My child will explore that and just guess all the time, how can this be fixed? Also the terrain after a while does not exist, does it make sense to regenerate the terrain after the enemy has died?" They chose "the enemy zeroes in visibly on consecutive misses; random hits are removed" and "a new landscape after every destroyed enemy". This is an intended change, not drift.

- **Trade-off with PRD section 8.** [source-prd.md](./source-prd.md) section 8 says "The AI must not exploit the player's mathematics difficulties." Since amendment 07, FR-042 kept the enemy's hits independent of the child's answers. [Amendment 13](./amendment-13-enemy-zeroes-in-new-terrain.md) makes the enemy's hits depend on the child's misses in a row (FR-098, FR-099), which include misses from real difficulty, not only guesses. The product owner decided that repeated misses should have a visible consequence, because otherwise a child can guess without cost. The spec limits the effect:
  - Help still reaches the shown solution at step 3, and firing at it destroys the enemy and sets the count to 0, so a child who uses help can always avoid losing a heart.
  - Asking for help never changes the enemy's shot, and attempts, progress and challenge data are not inputs to it (FR-042).
  - The first enemy shot of a round always misses (FR-043), and the warning one miss before the hit is visible (FR-100).
  - No-damage mode (FR-044) still takes no heart.
- **Amendment 07 items 5 and 6 are replaced**: the random hit chance (1/6, 1/4, 1/3) and the near-miss band of 40 to 100 world units are removed.
- **PRD section 8 "Enemy accuracy should vary by difficulty"** is kept: the number of misses in a row before a hit is 4, 3 and 2 by difficulty.
- **PRD section 5 (terrain)** is extended: the landscape is renewed after every destroyed enemy (FR-101), which also stops craters from wearing the ground down to the bedrock strip.
- Decisions of this update that the amendment does not state: the shell lands about 35 world units away at 3 misses in a row, not 30, because the hit area reaches 30 world units from the tank's center; a fast guess that adds 2 can skip the warning; free play has no fast-guess rule, so every miss there adds 1; on the enemy's first shot of a round the count is kept even when it reached the limit, so the next miss hits; the new terrain seed comes from the round seed and the number of destroyed enemies, so the challenges stay as they were.

The spec (US1, US2, US5, Edge Cases, FR-041 to FR-044, FR-070, FR-081, Key Entities, new FR-098 to FR-101, Amendments), the data model (`RoundState.missStreak`, `RoundState.terrainSeed`), the contracts (`core/ai`, `isFastGuess`, `renewTerrain`, the battle flow and test attributes), quickstart (scenarios 22 and 24) and tasks (Phase 22f) were updated to match.
