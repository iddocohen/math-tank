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

The first release is built. All 15 amendments made during playtesting are implemented ([amendments 01 to 15](specs/001-math-tanks/)). The game now has:

- Aiming by number on a fixed cannon, with any number range and 5 ruler levels.
- Tasks: reading the ruler, before and after, steps, plus and minus with a step animation, and comparing numbers with decoy tanks.
- Help in steps, hearts, personal bests, adaptive difficulty and the progress page.
- An enemy that fires back and aims closer after repeated misses, and new hills after every destroyed enemy.
- A tank garage with looks earned with stars.
- Play on iPad and phone with an on-screen number pad, keyboard-only play, offline play, pause, fullscreen and spoken tasks.
- Drawn tanks, a ground texture and effects.
- Moving a save to another browser with a QR code or a link, and a file export.

One check is still open: a walk through every [validation scenario](specs/001-math-tanks/quickstart.md) on a real iPad and iPhone, including offline play in Safari (task T155 in [tasks.md](specs/001-math-tanks/tasks.md)). The browser tests cover iPad and phone screen sizes with Playwright's device emulation, not real devices.

## Run it locally

Requirements: Node.js 22 or later and pnpm 10.

```bash
pnpm install
pnpm dev          # development server
pnpm test         # unit tests (Vitest)
pnpm build        # production build in dist/
pnpm preview      # serve the production build
pnpm exec playwright install chromium webkit firefox
pnpm e2e          # browser tests in Chromium, WebKit and Firefox, on iPad and phone sizes, and under /math-tank/
pnpm lint && pnpm typecheck
```

About the browser tests:

- They build the game and serve it on port 4173, and a second build for GitHub Pages under `/math-tank/` on port 4174. A server already running on one of these ports is used as it is, so stop it first to test fresh code.
- They run in 4 parallel browsers. Several browsers that draw the battlefield at once slow down the game, so more workers can make waits time out. `PW_WORKERS=2 pnpm e2e` changes the number for one run.
- The frame rate test (`tests/e2e/performance.spec.ts`) runs last, alone. It needs a graphics card and is skipped where the browser draws in software. `pnpm e2e --project=performance --no-deps` runs it on its own.

## Deployment

Every push to `main` (and, while the first release is built, to the branch `001-math-tanks`) publishes the game to https://iddocohen.github.io/math-tank/ with the workflow [.github/workflows/pages.yml](.github/workflows/pages.yml):

1. Install the packages with `pnpm install --frozen-lockfile`.
2. Run `pnpm lint`, `pnpm typecheck` and `pnpm test`.
3. Build with `vite build --base=/math-tank/`, because GitHub Pages serves the game under `/math-tank/`, not at the root.
4. Upload `dist/` and publish it with [actions/deploy-pages](https://github.com/actions/deploy-pages).

The browser tests do not run in the workflow. Locally, the Playwright project `base-path` builds the game the same way and checks that it loads, plays a round and requests nothing outside `/math-tank/` ([tests/e2e/basePath.spec.ts](tests/e2e/basePath.spec.ts)).

In the repository settings, Pages uses "GitHub Actions" as its source.

### How updates reach a device

- Each build carries its version: the short git commit (`GITHUB_SHA` in the workflow) and the build day. The settings page shows it at the top, for example "Version 1a2b3c4 vom 2026-11-05".
- The game asks for a new version when it opens, every 30 minutes while it is open, and when it comes back to the front.
- A new version found while the start screen shows is applied at once: the page reloads one time by itself. During a round, or while a parent screen or the transfer dialog is open, it waits for the start screen (FR-051a). A tab reloads by itself at most once per version, so a failed update cannot cause a reload loop.
- The new version removes the files of the old one from the offline cache.

### Troubleshooting on an iPhone or iPad

Each browser on an iPhone keeps its own data. Clearing Safari's data does not clear Chrome's, and the reverse.

- Safari: Settings app, then Apps, then Safari, then "Clear History and Website Data" (older iOS: Settings, then Safari). To clear only this game: Safari, then Advanced, then Website Data, then remove `iddocohen.github.io`.
- Chrome: in Chrome, the three dots, then "Delete browsing data", choose "All time", and tick "Cookies, site data" and "Cached images and files".

Then open the game again and check the version on the settings page. To see what the game measures on the screen, open https://iddocohen.github.io/math-tank/?debug=screen: a small box in the bottom left corner shows the version, the window size, the viewport size, the orientation, the media query results, the chosen layout and the last event.

## How it is built

- TypeScript, [Phaser 4](https://phaser.io/) for the battlefield, React 19 for menus and settings, Vite for the build, and a service worker for offline play.
- All learning and game logic (task generation, ruler mapping, adaptive difficulty, terrain, shell paths) lives in `src/core/` without any framework code, is deterministic for a given seed, and is covered by unit tests.
- Settings and progress are stored in the browser's local storage. Nothing is sent anywhere.

The game was specified and built with [GitHub spec-kit](https://github.com/github/spec-kit) and the [OpsMill spec-kit workflow](https://github.com/opsmill/opsmill-speckit). The specification, plan and design decisions are in [specs/001-math-tanks/](specs/001-math-tanks/). Changes made while playtesting are recorded as numbered amendments in the same folder.

## Credits

- Ground texture: "dirt" from [4 hand-painted ground textures](https://opengameart.org/node/84103) by Drummyfish, released under [CC0](http://creativecommons.org/publicdomain/zero/1.0/). CC0 does not require credit; it is given anyway. The file is `src/assets/textures/dirt.png`.
- QR code of "Spielstand übertragen": [uqr](https://github.com/unjs/uqr) 0.1.3 by Anthony Fu, based on the QR code generator by Project Nayuki, under the MIT license. It is bundled with the game.
- The tests decode QR codes with [jsQR](https://github.com/cozmo/jsQR) 1.4.0 (Apache License 2.0), a development dependency that is not bundled.
- Everything else (tanks, effects, sky, sounds) is drawn or generated by the game's own code.

## License

[MIT](LICENSE)
