# Amendment 05: no shortcuts to the answer, and parent settings early

**Date**: 2026-11-05
**Requested by**: the product owner.
**Changes**: [amendment 01](./amendment-01-number-aiming.md) item 10 (keyboard map) and the −1 / +1 controls.

## Decisions (user's words and answers)

"I do not want to have the option of the keys to go right or left as it will give my son the 'easy path' which I do not want. Also can I get a config button somewhere to be able to setup anything I need?"

Follow-up answers:
- "Finde N": mouse and touch only, with no live number while pointing.
- Settings: the gear icon, press and hold for 2 seconds (as already specified in FR-045).

## Changes

1. **No stepping shortcuts.** Remove the arrow-key actions (±1, ±10) and the on-screen −1 and +1 buttons. Arrow keys do nothing in the game.
2. **No live number while pointing.** When the child taps or drags on the ruler, the target marker and guide line follow, but no number is shown (no large readout, no label next to the marker) until the shot has been fired. After landing, the landing number is shown as before. Typed digits are still shown as they are typed, because the child produced that number.
3. **"Finde N" only for pointer input.** The challenge kind `findNumber` ("Finde 37") is generated only when the child chooses numbers with mouse or touch. Typing the given number needs no thinking.
   - The game tracks the input method of the current round: it is "keyboard" once the child types a digit or presses Enter to fire, and "pointer" once the child taps or drags on the ruler or taps the fire button. The latest method used decides the next search.
   - With keyboard input, `findNumber` is skipped like a kind that cannot be generated (FR-029). The other kinds stay, because they need thinking before typing: read the ruler, after, before, steps right, steps left, missing number, midpoint, addition, subtraction, comparison.
   - If `findNumber` is the only enabled kind and the child uses the keyboard, the game falls back to "read the ruler".
4. **Parent settings early.** The parent gate (press and hold the gear for 2 seconds), the settings page and the progress page are scheduled right after amendment 04, before the guided-mode phases, so the product owner can configure range, ruler levels, challenge types and limits, difficulty, sound, round length, free play and the other settings while the rest is built. Settings that belong to features not built yet are shown but marked "kommt bald" (coming soon) and disabled, rather than hidden.
5. Keyboard map after this amendment: digits, Minus (negative ranges only), Backspace, Enter, Space (start, continue, fire at a shown solution), H (help), Escape (pause). Nothing else.

## Additions (same session)

User's words: "Also I would like to have it make more obvious which tank is my child one and who is the enemy, as today it is not obvious. Also I would like to have a line from the enemy to the ruler, so that my son understands where it is but without telling him what the number is."

6. **Clear own tank and enemy tank.**
   - The child's tank is blue with a yellow star flag on its antenna. At the start of every round, and after every new scene, a large bouncing arrow with "Du" (you) points at it for 3 seconds.
   - The enemy tank is red, with a darker, angular body and a black flag, so the two differ by color, shape and flag, not by color alone (color-blind safe).
   - Each tank's health bar sits directly above that tank, in the tank's color, instead of in the screen corners. This also fixes the corner labels that were cut off at the screen edges. The bars have no text labels.
   - Decoy tanks in comparison turns look exactly like the enemy, as specified.
7. **Pointer line without a number.** This makes amendment 04 item 5 precise: whenever the enemy is visible, a thin dashed vertical line runs from the center of the enemy tank down to the ruler and ends in a small triangle on the ruler line. No number is drawn at or near it, and the ruler labels around it are not highlighted. The child must read the number from the ruler. In a guided search the enemy is hidden, so there is no line until it is revealed. After a hit, the number may be shown in the hit feedback, as before.
