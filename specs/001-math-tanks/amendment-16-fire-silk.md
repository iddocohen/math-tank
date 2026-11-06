# Amendment 16: Amazon Fire tablets with the Silk browser

**Date**: 2026-11-05
**Requested by**: the product owner: "I want to ensure that everything also works on Amazon Fire Silk browser, as this is the browser my son is using." Their son uses a Fire Kids edition tablet; the size is not known, so all current sizes are covered.

## Background

Silk (Fire OS) is based on Chromium, so service worker, localStorage, WebGL/Canvas and pointer events work as in Chrome. Risks: small and low-resolution screens with browser bars, slow processors (Fire 7, Fire HD 8), Silk's optional desktop view on large tablets, and a coarse pointer (touch) so the number pad shows.

## Behavior and checks

1. **Supported sizes** (CSS pixels, browser bars subtracted as Silk shows them; landscape and portrait):
   - Fire 7: 1024 by 600 screen; about 1024 by 552 landscape, 600 by 976 portrait.
   - Fire HD 8: 1280 by 800 screen at device pixel ratio about 1.33; about 962 by 552 landscape, 600 by 914 portrait.
   - Fire HD 10 and Max 11: 1920 by 1200 at ratio 2; about 960 by 552 landscape, 600 by 912 portrait (Max 11: 1000 by 600 class).
   Exact values are chosen from the Silk user agent and screen data the agent can verify; the layout rule (amendment 12) must give a usable layout for each: landscape is "wide" or "side" with the number pad visible; portrait is "portrait" (600 px wide is not a phone), never the rotate picture. Nothing cut off or overlapping (ruler with labels, both tanks, hearts, banner, help, gear, new-scene, number pad).
2. **Number pad** shows on Fire tablets ("Automatisch": coarse pointer). One full round is played with the pad only on each size.
3. **Speed.** With CPU throttled 4 times (to approximate a Fire 7 or HD 8), a battle keeps at least 30 frames per second and the battlefield appears within 3 seconds of "Spielen". If not, reduce cost where it matters: fewer particles, cache the terrain texture, simpler sky, lower device pixel ratio for the canvas (render at most at ratio 1.5), and an automatic "light graphics" mode when frames drop below 30 for 2 seconds.
4. **Silk desktop view.** Loading with Silk's desktop user agent on a large tablet still uses the touch layout (detection is by pointer and size, not by user agent) and stays usable.
5. **Offline and saving** work in the Chromium engine (already covered by the Chromium tests); the Silk projects run the offline check once.
6. **Tests.** Playwright projects using Chromium with a Silk user agent string, the sizes above, `hasTouch: true`, `isMobile: true`, and a CPU throttling of 4 via the Chrome DevTools Protocol for the speed check. Screenshots of each size in landscape and portrait, checked for cut-off or overlap.
7. **Product owner check** (cannot be automated here): play one round on the son's Fire Kids tablet in Silk, landscape and portrait, and report the model and anything that looks wrong.
