# Amendment 06: hit the line, one hit destroys the enemy, the child has 3 lives

**Date**: 2026-11-05
**Requested by**: the product owner.
**Replaces**: [amendment 04](./amendment-04-hit-rule.md) items 1, 2, 3, 6 and 7 (body hits, Volltreffer, double damage, the `'close'` outcome and the "Genau treffen" setting). Amendment 04 item 5 (the pointer line without a number) stays and becomes the target.

## Decision (user's words)

"The enemy tank should not have any health bar, my son should exactly try to hit him at the position of the line. My son tank though should have a health bar and if the enemy tank hits him he has 3 hits until he dies. When an enemy tank is hit exactly a new enemy tank is spawned and only then, so one hit one death. I think it is much easier to understand and easier."

Follow-up answer: the enemy fires once after every 2 shots of the child, hit or miss.

## Behavior

1. **The line is the target.** The enemy is destroyed only by a shell at exactly the enemy's number (the number under the dashed pointer line). Where the pointer line meets the enemy tank, a small target ring marks the spot.
2. **One hit, one destroyed enemy.** An exact hit destroys the enemy with a large explosion and an encouraging message ("Getroffen!"). Then, and only then, a new enemy appears at a new position (hidden in a guided search, visible in free play and read-the-ruler).
3. **No enemy health bar.** The enemy has no health and no bar.
4. **Near miss on the tank body.** A shell that lands on the enemy tank's body but not on its number makes the tank shake, and the game shows "Ganz knapp! Triff die Linie." with the step count on the ruler ("Du: 30 · Gegner: 31 · 1 Schritt"). No damage. In a guided search this counts as a miss for the help steps.
5. **The child's tank has 3 lives**, shown as 3 hearts above the child's tank (no text). Each enemy hit removes one heart. Near misses by the enemy do nothing. When all 3 hearts are gone, the round ends with the encouraging end screen. In no-damage mode the hearts never go down.
6. **Enemy fire rhythm.** The enemy fires once after every 2 shots of the child, whether they hit or missed. When the child destroys an enemy, the count restarts for the new enemy. The enemy's accuracy still depends on the difficulty ("Leicht" misses most shots; its first shot of a round always misses).
7. **Round goal.** A round ends when the child has destroyed the number of enemies set by the parent (the round length setting, now "Gegner pro Runde", default 5, range 1 to 20), or when the child's 3 hearts are gone. The end screen shows how many enemies the child destroyed, with no comparison or ranking.
8. **Learning records.** A search is solved independently when the exact hit comes without help; as before, help use makes it "with help". The `'close'` outcome is removed; a near miss is a miss.
9. **Removed.** Volltreffer, double damage, body-hit damage, the enemy health bar, the `exactHit` ("Genau treffen") setting (settings migration drops the field), and the `'close'` outcome.

## Additions: score, personal best and clock (same session)

User's words: "I want to have a timer and highest score, aka how many tanks he managed to kill at that given time until he died, I think this is rewarding." Follow-up answers: first a running clock visible during play, then corrected by the product owner to "end of the screen as you suggested": the time is shown only on the end screen; the default round type is "until all hearts are gone".

10. **Round types.** A parent setting `roundType` with two values:
    - `'untilHearts'` ("Bis alle Herzen weg", the default): enemies keep coming; the round ends only when the child's 3 hearts are gone. In no-damage mode this round type is not offered, because it would never end.
    - `'enemyCount'` ("Gegner pro Runde"): the round ends after the parent's number of destroyed enemies (default 5, 1 to 20) or when the hearts are gone.
    This replaces item 7's single round goal.
11. **Score.** The score of a round is the number of enemies destroyed. A small tank counter is shown at the top during play (a tank icon and the number, no text).
12. **Time.** The game measures the time played in a round (minutes and seconds). It is not shown during play by default and never ends a round. It stops while the game is paused, while settings are open and while the tab is hidden. The end screen always shows it. A parent setting `showClock` (default off) shows an up-counting clock at the top during play, for children who handle it well. There is no countdown.
13. **End screen.** It shows the tanks destroyed and the time played, for example "9 Panzer getroffen in 6:12". Wording stays encouraging and never says "lost" or "verloren".
14. **Personal best.** Stored locally per range (min and max), ruler starting level and round type: the most enemies destroyed in one round, with its time. On a new record the end screen celebrates with "Neuer Rekord!" and a short effect. When the record is not beaten, the end screen shows only the child's own result with an encouraging phrase and the record in small, neutral form ("Dein Rekord: 12"), never "nicht geschafft" or any comparison wording. There is no list and no comparison with other people.
15. **Parent options**: `showClock` (default off) and `showRecords` (default on). Export and import include the records. The progress page (later phase) lists the records per range.
16. Rewards follow PRD section 7.3: the score counts only exact hits, does not require perfect play, and has no gambling or comparison elements.
