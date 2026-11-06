# Amendment 17: three play modes on the start screen, and faster adaptive difficulty

**Date**: 2026-11-05
**Requested by**: the product owner: "I would like to also have a mode where he just plays on the ruler to understand where the tank is without the questions on the top, the same way I would like to have a mode where no ruler is and he answers the questions. Would that work? Also I think it does not automatically increase the difficulty over time or very slow and only at reload, can you double check the code."

## Findings from the code check (orchestrator, 2026-11-05)

- Free play records no attempts (decision D8), so difficulty and the ruler level never change in free play or "Wo steht der Gegner?" rounds started from "Freies Spiel".
- In guided mode the stored steps are read again after every destroyed enemy (`controller.ts` `difficulty()` at round start, new scene and after each destroyed enemy), so it is not "only at reload". But each of 8 skills needs 5 of its last 6 non-guess attempts independent, the counting window is cleared after each step change, and challenges rotate over about 10 kinds, so one step takes 30 to 40 or more destroyed enemies.

## Decisions (answers)

- Modes are chosen with big picture buttons on the start screen; the parent chooses in settings which buttons are shown.
- Raise one step after 3 correct answers in a row without help; lower after 2 of the last 3 needed help. Every mode counts.

## Behavior

1. **Three modes.**
   - **"Gemischt"** (mixed, the current guided mode): ruler and question banner.
   - **"Nur Zahlenstrahl"** (ruler only): the enemy is visible with its pointer line; there is no question banner and no challenge text at all. The child reads the number under the line on the ruler and fires. Every shot is a `readPosition` attempt. This replaces "Freies Spiel" (free play) as a mode: free play's settings toggle becomes the "Nur Zahlenstrahl" button toggle; stored `freePlay` settings migrate to it.
   - **"Nur Rechnen"** (questions only): the question banner is shown; the ruler band is not drawn (no lines, no labels, no pointer line). The enemy is visible on the battlefield at the answer. The child computes the answer and types it (number pad or keyboard). Kinds that need the ruler to be meaningful (`readPosition`, `findNumber`) are not generated in this mode. After a miss the feedback still shows the landing number and "N Schritte". Help step 1 gives the direction in words; help step 2 shows a small zoomed ruler segment around the answer temporarily (the only time a ruler appears in this mode); help step 3 shows the solution.
2. **Start screen.** One big picture button per enabled mode (ruler icon, question-mark icon, both), each with a short label; the parent chooses in settings which modes are offered (default: all three). Keyboard: 1, 2, 3 select a mode on the start screen; Enter and Space start the first offered mode ("Gemischt" by default). G still opens the garage. If only one mode is enabled, the start screen shows a single "Spielen" button as before.
3. **Faster adaptive difficulty** (changes FR-037 and amendment 13's unchanged rules):
   - Raise a skill one step after **3 correct answers in a row without help** (non-guess, independent) in that skill.
   - Lower a skill one step when **2 of its last 3** non-guess attempts needed help or were not solved.
   - The in-a-row count restarts after a step change; guesses neither count nor break the row.
   - Mastery (FR-039) stays at 8 of the last 10 non-guess attempts independent, with at least 10 independent attempts.
4. **Every mode records attempts** and counts toward adaptive difficulty and the progress page, including "Nur Zahlenstrahl" (positions skill) and "Nur Rechnen" (the kind's main skill). The ruler level still follows the positions skill between the parent's start and hardest level.
5. **Visible progress for the parent**: the progress page shows each skill's current step and how many more correct answers in a row raise it.
6. Records and stars work in every mode (records per range, ruler start level, round type and mode).
