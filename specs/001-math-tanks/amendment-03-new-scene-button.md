# Amendment 03: new scene button

**Date**: 2026-11-05
**Requested by**: the product owner.

## Decision (user's words)

"Also I would like to have a refresh button on the right which regenerates a new scene."

## Behavior

1. The battle screen has a "Neue Landschaft" (new landscape) button with a refresh icon at the right side of the screen, at least 48 by 48 CSS pixels.
2. Pressing it starts a new round at once, in the same mode and with the same settings: a new random landscape, a new enemy position, full health for both tanks, the turn count reset, and a new challenge in guided mode. The player's tank switches sides, as for any new round.
3. It is disabled while a shell is in flight (player or enemy) and while the game is paused.
4. An unfinished challenge is discarded: no attempt is recorded, so it counts neither as success nor as a mistake, and no learning progress is lost. The session continues.
5. It is a mouse and touch button. It has no key, so a child playing with the keyboard never starts a new scene by accident; keyboard players get a new scene through Enter at the round end, as before.
