# Amendment 25: saved settings apply to the running round at once

**Date**: 2026-11-06
**Requested by**: the product owner: "I would like that if save is done in the menu that the change occurs immediately in the game, can that also be implemented accordingly without spec?"
**Changes**: FR-049 ("settings apply from the next round") and US6 scenario 6.

## Decision (answer)

"New scene, keep score": when the parent presses "Speichern" during a running round, the round gets a new scene with the new settings, the same way "Neue Landschaft" does. Hearts, destroyed tanks and the round time stay.

## Behavior

1. **A running round** (any phase except round over) takes the saved settings when the settings page closes after a save. The round then shows a new scene, as the "Neue Landschaft" button does:
   - new hills
   - the child's tank and new enemies (a wave of "Gegner gleichzeitig" in the ruler modes)
   - a new challenge built with the new settings: number range, ruler levels, task types and their limits, help settings, enemies at once and pointer lines

   Hearts, destroyed tanks, the round time, the turn and the enemy's shot count stay. The unfinished challenge is dropped without recording an attempt, as with "Neue Landschaft".
2. **Settings that shape the whole round stay until the next round**:
   - round type and length ("Rundenende", number of enemies or minutes)
   - the countdown timer and its duration
   - "Keine Treffer" (no damage)

   This way a round in progress keeps its goal and its time limit.
3. **Settings that change no task** apply at once without a new scene:
   - sound, music and speech
   - "Zahlenfeld"
   - "Zielkreuz"
   - the garage on or off (the garage icon shows or hides)

   If only such settings changed, the scene stays as it is.
4. **Several saves while the settings page is open** count as one change. The new scene comes once, when the page closes, and only if a task-shaping setting changed.
5. **On the start screen, the garage and the round end screen**, nothing changes: the next round uses the saved settings, as before.
6. **The paused state** stays. A round that the settings page paused continues with the new scene when the page closes. A round the child paused stays paused with the new scene.
7. **Tests first**:
   - Controller unit tests: applying settings mid-round builds a new scene with the new range and ruler level, and keeps lives, destroyed count, time and turn. The round goal and timer settings keep their round-start values. Display-only changes keep the scene.
   - App unit tests: the change is applied when the page closes after a save, once for several saves, and not when nothing was saved.
   - e2e: during a round, change the range from 0 to 100 to 0 to 20 and save. After closing, the ruler shows 0 to 20 and the enemy stands within 0 to 20, while the hearts and the destroyed count stay. Run it in desktop and device projects.
