# Amendment 21: waves of several enemy tanks in the ruler modes

**Date**: 2026-11-05
**Requested by**: the product owner: "I think I would like to have multiple tanks as well as an option, where he needs to hit several when the ruler is there at one go. Is that possible?"

## Decisions (answers)

- Wave: several enemies are visible; the child shoots them one after another, one number per shot, until all are destroyed; then a new wave and new hills come.
- Only in the ruler modes: "Nur Zahlenstrahl", and the "read the ruler" turns of "Gemischt". Math questions keep one enemy, because one question has one answer.

## Behavior

1. **Parent setting "Gegner gleichzeitig"** (enemies at once): 1 to 4, default 1 (today's behavior). Settings version increases with a migration (default 1).
2. **A wave.** In "Nur Zahlenstrahl", and in "Gemischt" when the turn is "Wo steht der Gegner?", N enemy tanks stand on the battlefield at once, each on a drawn ruler line, all with their dashed pointer line and target ring, each at least `minTankGap` from every other tank and from the child's tank. If the range cannot fit N tanks, fewer are placed (at least 1).
3. **Shooting.** The child types or picks one number and fires one shell. An exact hit on any enemy's number destroys that enemy (counts like any destroyed enemy: tank counter, star, round goal, records, subject to amendment 18). The others stay in place.
4. **Banner.** "Nur Zahlenstrahl" shows no question, as before. In "Gemischt" the banner reads "Wo stehen die Gegner?" while more than one remains.
5. **Misses and enemy fire.** A shot that destroys no enemy is a miss: miss feedback shows the landing number and the steps to the nearest remaining enemy ("Du: 30 · 2 Schritte", no enemy number, product-owner rule from the code-review round); the miss streak and zero-in rules of amendment 13 apply, and one remaining enemy (chosen by a seeded draw) fires back from its own barrel. A shot that destroys an enemy resets the miss streak; no enemy fires after it.
6. **Help** works on one target at a time: the remaining enemy nearest to the child's last landing point (or the leftmost one before any shot) is the help target; its target ring pulses while help is shown.
7. **Wave cleared.** When the last enemy of the wave is destroyed, the hills renew (amendment 13) and the next wave appears. Hearts, counter, time and records continue.
8. **Learning records.** Each destroyed enemy is one `readPosition` attempt; a miss counts as a wrong answer for the attempt of the help target.
9. **Neue Landschaft** replaces the whole wave (new hills, a new wave of the same size).
10. **Tests first**: placement (N tanks on lines, gaps, fewer when the range is too small), hit removes only the hit tank, counting per destroyed enemy, enemy fire only after a shot that destroys nothing, help target choice, wave cleared renews terrain, setting 1 behaves exactly as today; e2e: a 3-enemy wave cleared with the keyboard in "Nur Zahlenstrahl".

## Addition: curved pointer lines (same day)

The product owner: "Regarding the multiple tanks that he needs to hit, I would like to have one more difficult level and not have a straight line but a curved line from the ruler to a tank, such that he does not follow just a straight line down and see what ruler it is, but he needs to think where the curved line is actually landing."

11. **Parent setting "Linien"** (pointer line style) with three values:
    - "Gerade" (straight, default): the dashed vertical pointer line as today.
    - "Gebogen" (curved): each pointer line is a smooth curve from the tank's center to its number on the ruler; the end on the ruler is offset sideways from the tank by a seeded amount between a few numbers and about one fifth of the range width (the tank stays at its number's battlefield position; only the line bends). The end keeps the small triangle.
    - "Gebogen und verschlungen" (curved and tangled), offered only when "Gegner gleichzeitig" is 2 or more: curves of different tanks may cross. Each line and a small flag on its tank share one color from a color-blind safe set, so lines stay traceable.
12. **Fairness rules.** Curves end exactly on a drawn ruler line at the tank's number; ends of different curves never coincide; curves stay inside the battlefield and never pass through the ruler labels at their own end point; they do not pass behind other tanks' bodies.
13. **Help step 1** lights up the help target's curve from tank to end (a moving highlight along the curve) for about 2 seconds, in addition to today's step 1 hint.
14. "Zielkreuz" (amendment 19) is independent. The line style applies in every mode that shows pointer lines.
15. **Tests first**: curve end x equals numberToX(enemy number) within 0.5 units; ends distinct; curves inside bounds; label-avoidance; setting migration (default "Gerade"); tangled option hidden unless 2+ enemies; screenshot check of each style with 3 enemies.

## Addition: "Keine Linien" (same day)

The curved styles always end straight below their tank, because every tank stands above its own number (the core rule that the shell lands at the typed number's battlefield position). So curves only distract; looking straight down still finds the number. The product owner chose to keep "Gerade", "Gebogen" and "Gebogen und verschlungen" and to add:

16. **"Keine Linien"** (no lines): no pointer line at all, for every enemy; the target ring stays on the tank. The child must judge which ruler number is straight below the tank. This is the hardest line level. Help step 1 shows the help target's straight pointer line briefly (about 2 seconds) and then hides it again; help steps 2 and 3 are unchanged.
17. Settings migration: none needed beyond adding the new value to `lineStyle` (`'none'`); default stays "Gerade".
