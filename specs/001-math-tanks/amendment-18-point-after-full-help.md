# Amendment 18: parent setting for a point after the full help

**Date**: 2026-11-05
**Requested by**: the product owner: "If the whole help was provided after timer is gone, a point should be provided if then hitting the enemy. This is a setting I would like to have, same as the timer itself how long the child has."

## Current behavior (orchestrator code check)

- Every destroyed enemy increments `enemiesDestroyed` and gives a star, also when the hit came after help step 3 (solution shown), whether reached by misses, help requests or the optional time limit (`controller.ts`).
- The time limit already exists: settings "Zeitlimit" (`timeLimitSeconds`, off by default, 10 to 120 seconds per challenge); when it runs out, the next help step appears without penalty; a thin time bar shows the remaining time.

## Behavior

1. New parent setting **"Punkt nach voller Hilfe"** (`pointAfterFullHelp`, boolean, default **on**), in the "Hilfe" group next to "Zeitlimit".
2. **On** (as today): a hit after help step 3 destroys the enemy, increments the tank counter, gives a star, and counts toward "Gegner pro Runde".
3. **Off**: a hit after help step 3 still destroys the enemy and a new enemy appears (new hills as usual), the miss streak resets, but the tank counter does not increase, no star is given, it does not count toward "Gegner pro Runde" or the personal best, and the feedback line is "Getroffen, mit Hilfe." instead of the celebration. Hits after help steps 1 or 2 count as today.
4. Learning records are unchanged: an attempt that reached help step 3 is recorded as "with help" in both cases.
5. Settings version increases by one with a migration that adds the field with its default; export, import and the QR transfer include it (the transfer's frozen defaults gain the field as on).
6. The settings page shows the "Zeitlimit" switch and its seconds field and the new switch together, with a one-line explanation each.
7. Tests first: controller (counter, star, round goal and record unchanged with the setting off after a solution-shown hit; unchanged with it on; hits after help steps 1 and 2 always count), settings migration and transfer round trip, settings page.
