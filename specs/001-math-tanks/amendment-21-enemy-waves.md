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
