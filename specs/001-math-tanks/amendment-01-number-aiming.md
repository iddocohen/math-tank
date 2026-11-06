# Amendment 01: aim by number, not by angle

**Date**: 2026-11-05
**Requested by**: the product owner (the PRD author), after viewing the free-play demo at commit c43f366.
**Replaces**: PRD section 2.2 bullets "Aim the cannon" and "Adjust shot power", and the PRD rule that a correct answer must not guarantee a hit.

## Decision (user's words)

"It should not be done via angles. The main objective is that my child learns the linear ruler, hence the angle of the cannons should stay fixed but he should say which number the placement should be."

Answers to follow-up questions:
- Wrong number: **fire and show the miss**. Every chosen number is fired; the shell lands at that number; the game shows how far off it was; help appears after repeated misses.
- Angle aiming: **remove completely**, including free play. No parent option.

## New behavior

1. **Aiming is choosing a number.** The child never sets angle or power. The child picks a number on the number line (preview, +1 / −1, then the fire button, which replaces the check button) and the shell lands at that number's battlefield position.
2. **Fixed cannon, automatic arc.** The cannon points up at a fixed steep angle toward the enemy side (65 degrees from horizontal). The game computes the power so the shell lands at the chosen x. If a hill blocks that arc, the game raises the angle in 5-degree steps up to 85 degrees, so the shell always lands at the chosen number. The cannon is not draggable.
3. **Exact numbers hit.** The enemy takes damage only when the chosen number equals the enemy's number. The explosion and crater still appear for every shot. A near miss within the blast radius makes the enemy tank shake with no damage.
4. **Guided search.**
   - The enemy is hidden; the challenge says where it is ("Finde 37", "Der Gegner ist bei 43 − 7").
   - Each fire is an answer. Correct: the shell hits and the enemy is revealed and damaged. Wrong: the shell lands at the chosen number, the landing number is shown large, and help escalates:
     - Miss 1: encouraging phrase and the direction ("Weiter nach rechts" or "Weiter nach links"), plus the nearest major tick highlighted.
     - Miss 2: zoom into the ten that contains the answer and count the steps from the landing number to the answer (or the step animation for addition and subtraction).
     - Miss 3: the solution is shown with an animated marker, and the child fires at it with one tap.
   - Misses never give the enemy a turn and never cost health (PRD 7.1 and 8: no loss due to math mistakes, the AI must not exploit math difficulties).
   - After the hit (or the shot at the shown solution), the enemy takes its turn with a visible arc. Then the enemy hides and moves, and a new search starts.
   - A player turn is one search. Round length counts searches.
5. **Comparison.** Tapping a numbered tank fires at that tank's number. A decoy is destroyed (a miss, help escalates). The real enemy is hit when the correct tank is tapped. For ordering three numbers, taps place order badges without firing; when the order is correct the cannon fires at the enemy (the tank with the largest number); a wrong order resets the badges and help escalates.
6. **Free play.** The enemy is visible. The child picks a number and fires; each shot is followed by an enemy turn. No challenge and no bonus challenge.
7. **Removed**: angle and power controls, cannon dragging, aim correction setting (FR-012), charged shots and their larger blast (FR-011), the bonus challenge (FR-014 part), the "enemy stays for 3 shots" rule (FR-010a part). The player tank still keeps one side per round.
8. **Number line in every mode.** The number line view and number selection are needed for free play too, so they move before any guided work.
9. **Attempt records**: `wrongAnswers` counts misses; a hit on the first shot without help is independent.

## Keyboard-only play (added by the user in the same session)

User's words: "Also ensure keyboard only can be used with numbers and the child does not need to click anything else."

10. **Every child action works with the keyboard alone, using number keys plus Enter.** Mouse and touch keep working for tablets.
    - Typing digits enters a number. The number appears large, and the preview marker on the number line and battlefield moves to it at once. Backspace deletes a digit. A minus key is accepted only when the range allows negative numbers.
    - Enter fires at the typed or previewed number.
    - Arrow left and right change the preview by 1. Arrow up and down change it by 10. Arrow keys are a convenience, not a requirement.
    - Comparison: the child types the number shown on a tank and presses Enter. For ordering three numbers, the child types the numbers one after another, pressing Enter after each.
    - On the start screen, the round-end screen and the "show solution" step, Enter starts, continues or fires. Space does the same.
    - Help appears by itself after misses, so the child never needs the help button. The H key also opens the next help step.
    - Escape pauses and resumes. The parent gate stays mouse or touch only (press and hold), so a child's key press never opens settings.
    - A typed number outside the range is not fired. The preview stays at the nearest end, with a friendly hint showing the range.
    - Focus starts in the game, so typing works without clicking first. There is no visible text field to click.
    - Large ranges (over 100): typing the full number skips the two-step zoom selection.
