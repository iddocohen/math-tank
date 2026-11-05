# Amendment 09: comparison with one enemy, asked in the banner

**Date**: 2026-11-05
**Requested by**: the product owner, after seeing three identical red tanks with number plates ("why do I see tank 2x ranges? Should I not see only one enemy?") and an "equal" challenge that gives its answer away ("Welche Zahl ist gleich 57?" next to a tank labelled 57).
**Changes**: US4, FR-026, FR-027, the comparison parts of FR-031 and of amendments 01, 04, 05, 06 and 07 (decoy tanks, number plates, tank tapping, order badges, shells from the top in comparison turns).

## Decision

The product owner chose: always exactly one enemy; the comparison is the question in the banner.

## Behavior

1. **One enemy, no decoys.** Comparison turns show exactly one enemy tank, like every other turn: visible, with its dashed pointer line, no number plate. There are no decoy tanks, no number plates, no tank tapping and no order badges anywhere in the game.
2. **The question names the options; the answer is where the enemy stands.** The enemy stands at the correct option. The child types the number (or picks it on the ruler) and fires, as in every other challenge. Kinds and example wording (at most about 10 words, German):
   - greater: "Der Gegner steht bei der größeren Zahl: 47 oder 74"
   - smaller: "Der Gegner steht bei der kleineren Zahl: 18 oder 21"
   - largest of three: "... bei der größten Zahl: 38, 83, 58"
   - smallest of three: "... bei der kleinsten Zahl: 61, 16, 26"
   - closest to: "... bei der Zahl näher an 50: 46 oder 57"
   - between: "... bei der Zahl zwischen 30 und 40: 27, 35, 48"
   - middle of three (replaces ordering three numbers, which needs no tapping order now): "... bei der mittleren Zahl: 72, 27, 45"
3. **Removed kinds**: "equal" (it gives the answer away) and "order three by tapping".
4. **Options** stay in the configured range, are distinct, and have exactly one correct answer; options are at least a few numbers apart so the ruler can tell them apart (at least 2 units, more at larger ranges). Options other than the answer may stand anywhere in the range; they are not drawn on the battlefield.
5. **Help** for comparison: step 1 highlights the tens digits of the options in the banner; step 2 puts small markers on the ruler under each option's number (no number labels beyond the options already in the banner); step 3 shows the solution as for other kinds.
6. **Enemy fire** in comparison turns works as in all other turns (from the enemy's own tank; amendment 07). The special "shell from the top" case is removed.
7. Learning records, adaptive difficulty and the comparison skill stay; the ladder for comparison narrows the option spread at easy steps.
