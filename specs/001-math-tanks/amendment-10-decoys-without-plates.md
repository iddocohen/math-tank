# Amendment 10: decoy tanks return, without number plates

**Date**: 2026-11-05
**Requested by**: the product owner, after playing amendment 09: "I liked the decoy tanks, they were better than the implementation now as it feels boring."
**Changes**: [amendment 09](./amendment-09-comparison-one-enemy.md) items 1, 4 and 6 (one enemy only, options not drawn, enemy fire from its own tank in comparison turns). Items 2, 3, 5 and 7 (the banner question, removed "equal" and "order3", the "middle of three" kind, the help steps, learning records) stay.

## Decision

Follow-up answer: decoys come back without number plates. The comparison is asked in the banner; the child finds the right tank by reading the ruler.

## Behavior

1. **One tank per option.** A comparison turn shows one tank for each option named in the banner (2 or 3). The real enemy stands at the correct option; decoys stand at the other options. All look like the enemy, each with its dashed pointer line to the ruler and its target ring. **No number plates** on any tank.
2. **Choosing.** The child works out the correct number from the banner, then finds the tank standing at that number by reading the ruler. The child types the number and presses Enter, or clicks / taps the tank (a tank tap fires at that tank's number). Firing at any number works as in every other challenge.
3. **Hitting a decoy.** An exact hit on a decoy's number destroys the decoy as a cardboard dummy: it bursts into flat cardboard pieces with a light "plopp" sound, clearly different from the real enemy's explosion. It counts as a miss (wrong answer) for the help steps and the learning records, and the enemy fires back as after any miss (amendment 07). The decoy is gone for the rest of that search.
4. **Hitting the enemy** destroys it as usual; any remaining decoys fold away (fade out) with it, and the next search starts.
5. **Near misses** on any tank's body make that tank shake, with the step count to the tank nearest the landing number (as in amendment 07 for comparison turns, so the step count does not reveal which tank is the enemy).
6. **Enemy fire in comparison turns.** Because all tanks look the same, the enemy's shell enters from the top edge (as before amendment 09), so its origin does not reveal which tank is the enemy.
7. **Spacing.** All option tanks and the child's tank stand at least the minimum tank gap apart (`minTankGap`, FR-027); options that cannot be placed are not generated, and comparison is skipped when the range cannot fit them.
8. **Help** (amendment 09 item 5): step 1 highlights the tens digits of the options in the banner; step 2 puts markers on the ruler under each option's number; step 3 marks the correct tank and its number; one tap or Enter fires at it.
9. "Equal" and "order three by tapping" stay removed; "middle of three" stays (one tank at each of the three numbers).
10. **Refresh shows one tank again.** Because comparison turns have decoys again, "Neue Landschaft" must not start a comparison turn (restores amendment 08 item 1 "never several tanks right after a refresh", which Phase 22b task T243 had removed). Later searches may be comparisons.
