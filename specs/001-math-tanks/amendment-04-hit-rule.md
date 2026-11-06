# Amendment 04: a hit is what the child sees, with a bullseye for the exact number

**Date**: 2026-11-05
**Requested by**: the product owner, after a demo shot at 30 landed on the tank body while the enemy stood at 31 and counted as a miss.
**Changes**: [amendment 01](./amendment-01-number-aiming.md) item 3 ("exact numbers hit") and [amendment 02](./amendment-02-ruler-ranges-and-detail.md) item 3 (read-the-ruler hit tolerance).

## Decision

The product owner asked for a recommendation "from the child's perspective" and accepted this one: what the child sees must decide the hit. Rationale: a shell that visibly lands on the tank but counts as a miss feels unfair to a 6 to 9 year old with low frustration tolerance. At 0 to 100 a tank is about 4 numbers wide, and at 0 to 1000 about 40, so an exact-only rule cannot be shown honestly. Precision is rewarded and made visible instead of being required for a hit.

## Behavior

1. **Hit**: a shell whose landing point is on the enemy tank's body (within half the tank's drawn width of its center, measured along the battlefield) is a hit and does damage. This applies in every mode and to every challenge kind, and replaces the read-the-ruler tolerance rule of amendment 02 at all ruler levels.
2. **Volltreffer (bullseye)**: a shell at exactly the enemy's number does double damage, a larger explosion and the message "Volltreffer!".
3. **Feedback on a hit that is not exact**: the ruler shows both numbers and the distance, for example "Du: 30 · Gegner: 31 · 1 Schritt". Wording is encouraging, never "falsch".
4. **Feedback on a miss** (off the tank body): as before, the landing number, the direction and the help steps. In free play the distance in steps is shown.
5. **Pointer line**: whenever the enemy is visible (free play, read-the-ruler, comparison tanks, and after a guided search reveals it), a thin vertical line runs from the tank's center down to the ruler, so the tank stands on one clear number. In a guided search the enemy is hidden, so there is no line until it is revealed.
6. **Learning records stay strict**: only the exact number counts as an independent correct answer for progress, adaptive difficulty and mastery. A body hit that is not exact without help is recorded as a new outcome `'close'`: it counts neither toward raising nor toward lowering difficulty, and not toward mastery. A body hit after help is recorded as `'assisted'`, as before. In a guided search, a close hit ends the search like any hit (the enemy is damaged and takes its turn).
7. **Parent setting "Genau treffen" (aim exactly)**, default off:
   - Only the exact number does damage; a body hit shows "Ganz knapp!" and the step count, with no damage, and the search continues with the help steps.
   - The enemy tank shows a bullseye on its center line, so the rule is visible.
   - Adaptive difficulty never switches this setting.
   - Settings version 3 with a migration adds `exactHit: boolean` (default `false`).
8. **Comparison**: tapping or typing a tank's number fires at that number, which is the tank's center, so it is always a Volltreffer on the chosen tank; the rule matters only for decoys versus the enemy, unchanged.
