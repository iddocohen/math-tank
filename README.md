# Mathe-Panzer (Math Tanks)

A browser artillery game that teaches children aged 6 to 9 how numbers map to positions on a ruler (number line). The child aims by choosing a number: the cannon stays fixed, and the shell lands exactly at that number on the battlefield.

**Play it:** https://iddocohen.github.io/math-tank/

The game runs fully in the browser. It needs no account, no server and no internet connection after the first load. The interface is in German.

## Why this game exists

Many children learn number lines on worksheets. Some children, especially those with low frustration tolerance, refuse those exercises. This game puts the number line inside a game they want to play: every shot is a number, and every miss shows on the ruler how far off it was.

The goals, from the [product requirements](specs/001-math-tanks/source-prd.md):

- Understand that every position on a ruler is a number, and what the long (major) and short (minor) lines mean.
- Build confidence with addition, subtraction, comparing numbers and crossing tens.
- Keep frustration low: no timers by default, no "wrong", no public scores, help that grows step by step, and the child can always continue.

The [PRD success criteria](specs/001-math-tanks/source-prd.md#15-product-success-criteria) measure success by whether a child who avoided number lines chooses to play another round, not by the number of correct answers.

## How to play (tutorial for the child)

1. Press **Enter** (or click **Spielen**). Your blue tank with the star flag is marked "Du".
2. Read the task at the top, for example **"Der Gegner ist bei 43 − 7"** or **"Wo steht der Gegner?"**.
3. The red enemy tank stands somewhere on the hills. A dashed line runs from the enemy down to the ruler.
4. Work out the number, or read it from the ruler under the dashed line.
5. Type the number with the number keys. Press **Backspace** to fix a digit.
6. Press **Enter** to fire. The shell lands exactly at your number.
7. **Exact number:** the enemy is destroyed and a new one appears.
   **Not exact:** the ruler shows how many steps you were away, for example "3 Schritte". Try again.
8. Stuck? Press **H** (or the yellow **?** button) for help: first a hint, then the ruler zooms in and counts with you, then it shows the answer.
9. The enemy shoots back after your shots, but it usually misses. You have **3 hearts**. The round ends when they are gone, and you see how many tanks you destroyed.

Mouse and touch work too: tap the ruler to choose a number, then tap **Feuer!**.

## Tutorial for parents

- **Open the settings:** press and hold the **gear** (top right) for 2 seconds. A short click does nothing, and no key opens it, so the child cannot open it by accident.
- **Number range:** choose 0 to 10, 0 to 20, 0 to 50, 0 to 100, 0 to 1000, or your own range such as 550 to 780. The battlefield always covers exactly this range.
- **Ruler level ("Zahlenstrahl"):** 5 levels, from every number labeled (level 1) to only the two end points (level 5). Set a starting level and the hardest level. The two previews show what the child will see.
- **Tasks:** turn on or off reading the ruler, before and after, steps, plus, minus and comparing numbers, and set their limits (largest number, crossing tens, negative results).
- **Adaptive difficulty** (on by default) makes tasks a little harder after repeated success without help, and easier when the child struggles, never beyond your limits.
- **Progress ("Fortschritt")** shows, per skill, how many tasks were solved alone and how many with help, which skills are mastered, and the personal bests.
- **Back up your data:** "Daten sichern" downloads settings and progress as a file. "Daten laden" restores them. On an iPad, add the game to the Home Screen so Safari keeps the data.

## Status

This is the first release and is still being built. Working now: number aiming, all ruler levels, any number range, reading the ruler, before and after, steps, plus and minus with a step animation, comparison, help steps, hearts and personal bests, adaptive difficulty, the progress page, settings with export and import, and keyboard-only play.

In progress: comparison turns with decoy tanks, a tank garage with looks earned by playing, layout fixes, and offline play, pause, fullscreen and spoken tasks. The full task list is in [tasks.md](specs/001-math-tanks/tasks.md).

## Run it locally

Requirements: Node.js 22 or later and pnpm 10.

```bash
pnpm install
pnpm dev          # development server
pnpm test         # unit tests (Vitest)
pnpm build        # production build in dist/
pnpm preview      # serve the production build
pnpm exec playwright install chromium webkit firefox
pnpm e2e          # browser tests in Chromium, WebKit and Firefox
pnpm lint && pnpm typecheck
```

## How it is built

- TypeScript, [Phaser 4](https://phaser.io/) for the battlefield, React 19 for menus and settings, Vite for the build, and a service worker for offline play.
- All learning and game logic (task generation, ruler mapping, adaptive difficulty, terrain, shell paths) lives in `src/core/` without any framework code, is deterministic for a given seed, and is covered by unit tests.
- Settings and progress are stored in the browser's local storage. Nothing is sent anywhere.

The game was specified and built with [GitHub spec-kit](https://github.com/github/spec-kit) and the [OpsMill spec-kit workflow](https://github.com/opsmill/opsmill-speckit). The specification, plan and design decisions are in [specs/001-math-tanks/](specs/001-math-tanks/). Changes made while playtesting are recorded as numbered amendments in the same folder.

## Credits

- Ground texture: "dirt" from [4 hand-painted ground textures](https://opengameart.org/node/84103) by Drummyfish, released under [CC0](http://creativecommons.org/publicdomain/zero/1.0/). CC0 does not require credit; it is given anyway. The file is `src/assets/textures/dirt.png`.
- Everything else (tanks, effects, sky, sounds) is drawn or generated by the game's own code.

## License

[MIT](LICENSE)
