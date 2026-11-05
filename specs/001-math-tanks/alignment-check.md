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

## Amendment 12

**Date**: 2026-11-05

The product owner said: "It must also run on a IPAD resolution and/or phone resolution". This is an intended change, not drift.

- **PRD section 11 (accessibility and usability)** says "Desktop and tablet support", and section 12 (technical requirements) says "Maintain smooth animation on typical desktop and tablet hardware". [Amendment 12](./amendment-12-tablet-phone.md) keeps both and adds phones held sideways (FR-050). The performance target SC-002 names tablets and desktops; no frame-rate target is set for phones.
- **Tablet support before this amendment** assumed a minimum screen of 768 by 600 CSS pixels and touch on the ruler, with the fire button as the only touch control. The amendment adds an on-screen number pad on touch devices (FR-102, FR-103) and layouts for an iPad held sideways or upright and for a phone held sideways (FR-104). The 768 by 600 minimum is replaced by the tested sizes 1024 by 768, 768 by 1024 and 844 by 390.
- **A phone held upright is not a play layout.** The amendment asks for a picture "Bitte dreh das Handy" that pauses the game; the settings and progress pages still work upright.
- **Amendment 05 item 3 (input methods)** is extended, not changed: the number pad counts as keyboard input, so "Finde N" is not generated while the child uses it (FR-076, FR-103).
- **Fullscreen (FR-054)**: on iPhone the Fullscreen API is not available to web pages, so the fullscreen button is hidden there (FR-106) and the Home Screen note of FR-048a applies.
- Decisions of this update that the amendment does not state: the layout limits (a phone held sideways is at most 500 CSS pixels tall; a phone held upright is narrower than 600 pixels); "touch device" uses the main pointer (`pointer: fine`), so an iPad with a trackpad counts as a touch device unless its screen is at least 1100 pixels wide and the trackpad is the main pointer; with "Zahlenfeld" set to "Nie" every size uses the bar at the bottom; the pad's "Feuer!" key is the only fire button while the pad shows; the picture "Bitte dreh das Handy" also covers the start screen and the garage, with the gear on it so the parent can reach the settings upright; the smallest tested screen is 844 by 390.

The spec (US8, Edge Cases, FR-046, FR-050, FR-053, FR-058, FR-076, new FR-102 to FR-106, Assumptions, Amendments), the data model (Settings version 6 with `numberPad`, the screen layout rule), the contracts (screens, layouts and the number pad, the keyboard map note, the input method), quickstart (scenario 12 and new scenarios 25 to 27) and tasks (Phases 22g and 22h, Phase 23 tasks T136 and T141) were updated to match.

## Amendment 14

**Date**: 2026-11-05

The product owner asked whether the tanks and terrain could look better without too much complexity and whether it fits the garage (amendment 11); they accepted code-drawn tanks and effects with one CC0 ground texture. This is an intended change, not drift.

- **PRD section 12 (technical requirements)** asks for smooth animation on typical desktop and tablet hardware. SC-002 stays: the textured ground is drawn once per landscape and per crater, not in every frame (FR-107).
- **PRD section 11 (accessibility)**: the screen shake and the larger particle bursts follow the operating system's reduced-motion setting (FR-113). The amendment asks for this; the PRD does not mention motion sensitivity.
- **The assumption "graphics are original and drawn by the game"** is changed for one asset: the dirt texture "dirt" by Drummyfish (CC0, https://opengameart.org/node/84103). Its OpenGameArt page states CC0 and "not required, you can credit drummyfish"; the README and the settings page credit it anyway (FR-114). The research decision R13 is changed to match.
- **Amendment 05 item 6 and amendment 10** (the enemy and the decoys are red, angular, with a black flag) are kept (FR-109). **Amendment 11** is kept: the flag and hat anchor points do not move and the garage preview draws the same tank as the battle (FR-110).
- Decisions of this update that the amendment does not state: the contrast rule is a CIE76 color difference of at least 30 between every garage color shade and every enemy shade and ground color (FR-109); "fewer particles" means at most 40 % of the usual number; a hit on any tank means the enemy destroyed, a heart of the child lost and a decoy burst, not a near miss, which already shakes the tank itself; the screen shake is 2.5 CSS pixels for 150 ms; the grass edge is at least 10 world units thick; the shell trails are 5 world units thick; the wheels, recoil, muzzle flash and smoke stay with reduced motion, because they are small and short.

The spec (new FR-107 to FR-114, SC-002, Assumptions, Amendments), research R13, the contracts (battlefield look and effects, the test attributes, the settings credits), quickstart (scenario 28) and tasks (Phase 22i) were updated to match.

## Amendment 15

**Date**: 2026-11-05

The product owner asked how a child can pick up a save in another browser and chose a QR code. This is an intended change, not drift.

- **PRD section 12 (technical requirements)** asks for local storage without a server. The transfer keeps that: the save travels in the link's fragment, which browsers never send to the server, and the QR code is drawn in the browser (FR-117, FR-118).
- **PRD section 9 (parent controls)**: taking over a save replaces the parent's settings, so the dialog uses the 2-second hold of the parent gate (FR-119), as for the settings themselves (FR-045).
- **FR-048a (export and import as a file)** stays; the transfer leaves out the attempt history, which only the file carries (FR-116).
- Decisions of this update that the amendment does not state: the limit is 2300 bytes for the whole link (the amendment says "about 2.3 KB"); error correction M for every size; the transfer also carries the guesses per skill, because the progress page shows them; `SkillProgress.recent` is not carried and starts empty; mastery windows are shortened together, one entry at a time from the oldest; when the link is still too long with empty windows, the QR code is not shown and "Link kopieren" stays; the fragment is removed when the dialog closes, not when the page opens, so a reload before the decision asks again; "Rekord" in the dialog is the most enemies of any personal best; the QR library is uqr 0.1.3 (MIT); deflate is used in its raw form (`deflate-raw`), which saves the 6 bytes of the zlib header and checksum.

The spec (US6 scenarios 11 and 12, new FR-115 to FR-120, Key Entities, Assumptions, Amendments), the data model (Transfer code), the contracts (`core/transfer`, the receive dialog, the settings group), quickstart (scenario 29) and tasks (Phase 22j) were updated to match.

## Amendment 17

**Date**: 2026-11-05

The product owner asked for a mode that plays only on the ruler and a mode that asks only questions without a ruler, and asked whether difficulty rises at all. The code check found that free play recorded no attempts (decision D8), and that guided mode needed 5 of the last 6 answers independent per skill, which took 30 to 40 or more destroyed enemies per step. This is an intended change, not drift.

- **PRD section 2.2 (core loop) and FR-010** stay for "Gemischt". "Nur Zahlenstrahl" and "Nur Rechnen" are practice modes the parent offers; the PRD's guided loop stays the first mode and Enter starts it by default (FR-121).
- **PRD section 8 (adaptive difficulty)** asks for gradual raising after repeated independent success and for guesses to be ignored. 3 independent answers in a row is still repeated success, and guesses still neither count nor break the row (FR-037, FR-038). FR-018's "never after a single correct answer" holds. Mastery (FR-039) is unchanged, so the progress page stays strict.
- **FR-015 (the number line is always shown)** does not hold in "Nur Rechnen" by the product owner's choice; help step 2 shows a zoomed piece of ruler around the answer (FR-123).
- **Decision D14 (free play records no attempts)** is reversed: every mode records attempts (FR-124). Decision D8's `aiming` phase is no longer entered, because every mode is a search in `challenge`.
- Decisions of this update that the amendment does not state: the mode identifiers `mixed`, `ruler` and `math`; keys 1, 2 and 3 are fixed per mode and start it at once (a key for a mode that is not offered does nothing); the settings field `playModes` replaces `freePlay` in settings version 8, and stored settings migrate to all three modes unless the parent offered only free play (no challenge type on), which migrates to "Nur Zahlenstrahl" only; the row of correct answers is read from `SkillProgress.recent` instead of a new stored field; personal bests of "Gemischt" keep the key without a mode part, so existing bests stay; in "Nur Rechnen" the number pad shows unless "Zahlenfeld" is "Nie", help step 1 shows no ruler highlight and help step 2 no step count, and comparison help keeps its option markers; the battle overlay carries `data-mode` and `data-skill-step` for the end-to-end tests; `?mode=mixed|ruler|math` replaces `?mode=free`.

The spec (User Story 7 scenarios 1, 2 and 5, new User Story 11, FR-014 replaced, FR-037, FR-040, FR-046, FR-047, FR-062, FR-086, new FR-121 to FR-124, Amendments), the data model (Settings version 8 with `playModes`, the adaptive rule, `RoundState.mode`, the records key, help in "Nur Rechnen"), the contracts (play modes, the start screen, the keyboard map, `generateChallenge`, `nextHelp`, `recordKey`, `summarize`), quickstart (scenario 30) and tasks (Phase 24a) were updated to match.

## Amendment 16

**Date**: 2026-11-05

The product owner asked that the game also work in Amazon Silk, the browser on their son's Fire Kids tablet. The model is not known. This is an intended change, not drift.

- **PRD section 12 (technical requirements)** names desktop and tablet browsers. Silk on Fire tablets is a tablet browser based on Chromium, so FR-050 adds it without new technology (FR-125).
- **The amendment's sizes are estimates.** Amazon's Fire tablet specifications give the Fire HD 10 the density class hdpi (ratio 1.5), not ratio 2, so its CSS size is 1280 by 800, not 960 by 600. Sources:
  - [Fire HD models](https://developer.amazon.com/docs/device-specs/ft-device-specifications-firehd-models.html)
  - [Fire 7 models](https://developer.amazon.com/docs/device-specs/ft-device-specifications-fire-models.html)
  - [Silk user agent strings](https://docs.aws.amazon.com/silk/latest/developerguide/user-agent.html)
- **Browser bar height is not published.** The tests subtract an estimated 128 CSS pixels (status bar 24, navigation bar 48, Silk's address bar 56). With all bars, a Fire 7 or Fire HD 8 held sideways is 472 pixels tall, which FR-104 gives the "side" layout; the amendment's estimate of 552 gives "wide". The amendment accepts both, and both are tested.
- **Speed (amendment item 3).** With the processor slowed 4 times, the check passes with a wide margin: 4.4 ms of main-thread time per frame against a budget of 33 ms. The light-graphics measures are therefore not built (FR-128). The canvas already draws at most 1600 by 900 pixels, whatever the device pixel ratio. A 4 times slower Apple M4 Pro is still faster than the Fire 7's Cortex-A53 cores, so the product owner's check on the child's tablet (quickstart scenario 33) remains the deciding test.
- **Silk's desktop view.** Silk's desktop view sends a desktop user agent; the game never reads the user agent, so the layout and the number pad stay. Whether desktop view also widens the layout is not documented; the test also checks 980 pixels wide (FR-126).
- Decisions of this update that the amendment does not state:
  - The Fire Max 11 has no test of its own, because Amazon lists no density class for it. It is larger than the Fire HD 10 at any likely ratio.
  - The offline check runs on the Fire 7 size only.
  - The speed check measures main-thread time per frame in every environment, and the frame rate only with a graphics card.
  - The example Silk version in the user agent (Silk 130, Android 11 for Fire OS 8) is illustrative.

The spec (FR-050, new FR-125 to FR-128, US8 scenario 13, SC-002, Assumptions, Amendments), the contracts (Fire sizes in the screen layouts), quickstart (scenarios 31 to 33) and tasks (Phase 24b) were updated to match.

## Amendment 18

**Date**: 2026-11-05

The product owner asked for a parent setting that decides whether a hit after the full help gives a point: "If the whole help was provided after timer is gone, a point should be provided if then hitting the enemy. This is a setting I would like to have, same as the timer itself how long the child has." The code check found that every destroyed enemy already raised the tank counter and gave a star, also after help step 3. This is an intended change, not drift.

- **PRD section 7.1 (low-frustration design)** asks for progressively more explicit help and that the child can always continue. Both stay: the help steps, the shown solution and the one-tap fire at it do not change, and the round goes on after the hit (FR-031, FR-129).
- **PRD section 7.3 (rewards)** says rewards must not depend on perfect mathematical performance. With the setting off, a hit after the shown solution gives no star, so the stars depend a little more on solving without the full help. Hits after help steps 1 and 2 still count, the setting is on by default, and the parent turns it off on purpose, which the product owner asked for.
- **FR-034 (time limit without penalty)** stays: when the time limit reaches help step 3 and the setting is off, the child loses no heart and no star already earned; only the next hit does not count.
- **PRD section 10 (learning progress)** is unchanged: an attempt that reached help step 3 is recorded as with help either way (FR-035).
- **FR-089 (stars never go down)** holds: with the setting off, the hit adds no star, and no star is taken away.
- Decisions of this update that the amendment does not state:
  - The setting is called `pointAfterFullHelp` in settings version 9.
  - "Zeitlimit" moves from the group "Runde" to the group "Hilfe", so the two switches stand together, as the amendment asks.
  - The explosion, the hit sound and the new hills stay for a hit that does not count; only the feedback line changes. The line still names the enemy's number after "Getroffen, mit Hilfe.", as FR-068 asks for every hit.
  - The round state keeps two counts: `enemiesDestroyed` (the score, which the stars, the round goal and the personal best read) and `enemiesHit` (every destroyed enemy, which seeds the new hills). The hit carries `lastShot.uncounted`.
  - The frozen transfer base gains `pointAfterFullHelp: true`, so a code with the setting on leaves the field out, and a code made before amendment 18 reads as on.

The spec (User Story 5 scenario 8, FR-046, FR-082, FR-083, FR-086, FR-089, new FR-129, Amendments), the data model (Settings version 9, `RoundState.enemiesHit`, `LastShot.uncounted`, the transfer base), the contracts (`renewTerrain`, `newScene`, the settings group "Hilfe"), quickstart (scenario 34) and tasks (Phase 24c) were updated to match.

## Amendment 19

**Date**: 2026-11-05

The product owner asked that stars be spent: "Today stars are not getting spent and I would like that when he spends stars for something that he needs to earn new ones for it, or reset others to buy something new, would that work?" They also asked for an option to remove the yellow aiming cross: "it should be enabled, enabled only for given difficulty or disabled completely." Before this amendment, stars only unlocked items by total (amendment 11) and were never spent, and the cross always showed. This is an intended change, not drift.

- **PRD section 7.3 (rewards)** allows "stars or achievement badges" and "unlockable cosmetic upgrades", and asks to "avoid aggressive reward schedules, gambling-like mechanics, and monetization". The star shop stays inside these rules:
  - Stars are earned only by playing: 1 star per destroyed enemy that counts (FR-089, amendment 18).
  - No real money exists in the game, and nothing can be bought with money.
  - No chance: every item has a fixed price, and the child chooses what to buy. There are no random items, loot boxes or timers, and no offers that end.
  - Items are looks only and never change how the game plays.
  - Returning gives every star back, so a purchase is never lost.
  - The end screen names at most one item the balance now reaches and says nothing about missing stars, so it does not push the child to play for stars.
- **PRD section 7.3** also says rewards must not depend on perfect mathematical performance. That stays: every counted hit gives a star, also after help steps 1 and 2.
- **Amendment 11 (FR-090, the fixed unlock order)** is replaced by prices. FR-087 is changed from "no shop" to a star shop without money and without chance, because the product owner asked for spending.
- **PRD section 3 (number line learning)** is not weakened by the aiming cross setting: the ruler, the pointer lines and the help steps stay. The setting removes a visual aid that shows on the battlefield where the shell will land, which the parent can use to make the child read the ruler instead.
- Decisions of this update that the amendment does not state:
  - The price of every item (data-model.md "Garage"): simple 10 (sky blue, rocket flag, football flag, sparkle trail, helmet), better 20 (blue-green, turquoise, dragon flag, lightning flag, bubble trail), special 40 (crown, rainbow trail, dark blue with stripes). The amendment names only the special items.
  - The stored garage keeps its key `mathtanks.garage.v1` with `version: 2`, as settings keep their key across versions.
  - "Sterne zurücksetzen" keeps the total stars ever earned, because the amendment keeps it for the progress page and resets only the balance and the owned items.
  - "Genug Sterne für: X" names the most expensive item the balance reached during the round, and of equal prices the first in garage order, and only when the round crossed its price, so the same item is not named after every round.
  - Returning an item starts with a tap on "Zurückgeben"; there is no key for it. The question that follows works with Enter and Escape.
  - The aiming cross covers the guide line, the target marker on the battlefield, the yellow point on the ruler and the label of a typed number on the ruler. Hidden, a number chosen by pointing still shows no number in "Deine Zahl", as amendment 05 asks; the amendment's "shows only in the Deine Zahl readout" is read as applying to typed numbers.
  - The setting is `aimCross: { mode, level }` in settings version 10. The level is kept when another mode is chosen. The frozen transfer base gains the default, so codes made before amendment 19 read as "Immer".
  - The transfer garage part gets its own payload number: payload 1 (the star total) is still read and migrated; payload 2 carries the balance, the total ever earned, the owned items and the equipped look.

The spec (User Story 10, FR-046, FR-048a, FR-087, FR-089, FR-090 replaced, FR-091, FR-092, FR-094 to FR-097, FR-116, FR-119, new FR-130 to FR-135, Edge Cases, Key Entities, Amendments), the data model (Settings version 10, Garage version 2 with the price list and the migration, the transfer garage payload), the contracts (`core/rewards`, `core/battle/aimCross`, the garage dialogs and keys, the aiming cross, the settings page), quickstart (scenarios 23, 28 and 35) and tasks (Phase 24d) were updated to match.
