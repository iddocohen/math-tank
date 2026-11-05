# Amendment 08: "Neue Landschaft" keeps the round going

**Date**: 2026-11-05
**Requested by**: the product owner.
**Changes**: [amendment 03](./amendment-03-new-scene-button.md) item 2 (the button started a new round).

## Decision (user's words and answers)

"When I do refresh, it will spawn the tanks for exact position and all of them, that was not the idea of the refresh. A refresh should just create a new landscape with the new enemy tank in a given position."

Follow-up answers: the refresh should make new hills; exactly one enemy at a new position (never several numbered tanks right after a refresh); hearts, tank counter and time continue. The product owner did not ask the child's tank to keep its side.

## Behavior

1. Pressing "Neue Landschaft" during a round:
   - generates a new landscape (new terrain seed);
   - places exactly one enemy tank at a new position, with its pointer line, and starts a new challenge for it whose kind is not a comparison kind (no decoys right after a refresh; later searches may be comparisons again);
   - keeps the round going: hearts, the destroyed-tank counter, the round time, the round type progress and the personal-best tracking continue unchanged;
   - may place the child's tank on the other side, as for a new round.
2. An unfinished challenge is discarded without an attempt, as before (amendment 03 item 4). The enemy does not fire because of a refresh.
3. Still disabled while a shell is in flight and while paused; still mouse and touch only, no key.
4. A new round (with full hearts and a reset counter and time) starts only from the round-end screen ("Nochmal", Enter) or from the start screen.
