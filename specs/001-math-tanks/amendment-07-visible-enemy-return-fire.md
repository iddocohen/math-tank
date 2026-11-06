# Amendment 07: the enemy is always visible and fires back after every shot

**Date**: 2026-11-05
**Requested by**: the product owner.
**Changes**: the hidden enemy of amendment 01 item 4 and FR-010; the enemy fire rhythm of [amendment 06](./amendment-06-one-hit-lives.md) item 6; T215 (shell from the top while hidden); the T068/T215 rule that hides the step count during a search.

## Decision (user's words and answers)

"When I refresh the page, the enemy tank is not there aka out of bound this needs fixing. Also the enemy tank should fire immediately after my kid tried to shoot at him, but on purpose miss him slightly. Also the calculation of how many steps away he is on the bottom of the ruler was a nice feature that is now gone and would like to have it back."

The enemy was not out of bounds: guided searches hid it by design. The product owner chose:
- The enemy is always visible, with its dashed pointer line, in every challenge kind.
- The enemy fires after every shot of the child, usually missing slightly on purpose, and hits sometimes depending on difficulty.

## Behavior

1. **Always visible.** The enemy tank and its dashed pointer line to the ruler (FR-073, no number) are visible in every mode and every challenge kind, from the moment it appears. There is no hidden search any more. The challenge banner ("Der Gegner ist bei 43 − 7", "Welche Zahl kommt nach 49?", "Wo steht der Gegner?") stays as the task; the child may solve it or read the ruler, both practise the number line.
2. **Comparison turns** are unchanged: the enemy and its decoys stand at their numbers and look the same; which tank is the enemy is the task.
3. **Step count after every miss, again.** After a miss or a near miss, the ruler shows the bracket from the landing number to the enemy with "N Schritte", in every mode, and near misses show "Du: 30 · Gegner: 31 · 1 Schritt". In comparison turns the step count refers to the tank that was shot at, not to which tank is the enemy.
4. **Enemy fires after every shot of the child**, right after the child's shell has landed, unless that shot destroyed the enemy (then the new enemy appears and the child shoots next).
5. **Deliberate near misses.** The enemy's shell usually lands slightly beside the child's tank: outside the tank's hit area, 40 to 100 world units away from its center, on either side, so it is visibly close but harmless.
6. **Sometimes it hits**, decided per shot by a seeded random draw: "Leicht" about 1 in 6 shots, "Normal" 1 in 4, "Herausfordernd" 1 in 3. A hit takes one heart. The first enemy shot of a round always misses. The draw never depends on the child's answers, help use or mistakes (PRD section 8).
7. **Shell origin.** The enemy fires from its own tank in every mode except comparison turns, where the shell still enters from the top edge so it does not reveal which tank is the enemy.
8. **Removed**: hidden searches, the "every 2 shots" rhythm, shells from the top while hidden (outside comparison), and the rule that hides the step count during a search. FR-038's guess rule and all other rules stay.
