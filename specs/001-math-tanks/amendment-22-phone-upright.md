# Amendment 22: a phone held upright plays upright

**Date**: 2026-11-06
**Requested by**: the product owner: "Iphone still does not work for safari or chrome and even if I use debug=screen nothing changes from the debug, everything stays the same. It feels like that safari and chrome do not detect rotation at all, if that is the case, delete the iphone landscape functionality altogether, after you researched it and saw that this is a commen problem and if it is not and there is a solution try top find out what it is, if there isn't delete the functionality"
**Changes**: FR-104 (the layout "Turn the phone" is removed), [amendment 12](./amendment-12-tablet-phone.md) and the Phase 24 task "Bug: iPhone rotation in Chrome".

## What the report shows

- On a real iPhone, in Safari and in Chrome, the picture "Bitte dreh das Handy" stayed on screen when the phone was held sideways.
- With `?debug=screen`, none of the values in the box changed when the phone turned.
- Since the Phase 24 fix, the game hides the picture with the CSS media query `(orientation: landscape)` alone, without any script. The values staying the same in both browsers means the browser page itself did not turn.

## Research

- An iPhone with the portrait orientation lock on (Control Center) keeps Safari upright. Apple Community threads and support guides name this lock as the first thing to check when Safari does not turn ([Apple Community](https://discussions.apple.com/thread/253239833), [iGeeksBlog](https://www.igeeksblog.com/iphone-screen-wont-rotate/)).
- A web page cannot detect the lock and cannot turn itself. Safari on iOS does not support `screen.orientation.lock`, and on iPhone the method also needs the fullscreen API, which iPhone Safari does not offer ([WebKit bug 257695](https://bugs.webkit.org/show_bug.cgi?id=257695), [PlayCanvas forum](https://forum.playcanvas.com/t/landscape-screen-lock/3932)). The web app manifest's `orientation` is not supported in Safari on iOS ([Mendix forum](https://community.mendix.com/link/space/mobile/questions/115035)).
- So this is a known limit of the platform and not a bug the game can fix. A game that requires a sideways phone cannot be played on an iPhone whose lock is on.

It is not known whether the lock was on for this report. The test above (no values change in both browsers) matches it.

## Decision

The requirement to turn the phone is removed. A phone held upright plays in the portrait layout.

1. The picture "Bitte dreh das Handy", its pause and its text are deleted.
2. A screen taller than wide (or square) uses the portrait layout at any width.
3. Narrower than 600 pixels (a phone held upright), the portrait layout is narrower:
   - The battlefield and the ruler at full width on top.
   - The question just below the battlefield, at full width.
   - Then the number pad, 3 keys wide.
   - At the bottom, the readout and "Feuer!" side by side, and the help button at the bottom left.
4. A phone held sideways still uses the side layout, when the browser turns. With the lock off, turning the phone during a round changes the layout and the round goes on without a pause.
5. On a phone held upright, the battlefield is only as wide as the phone, so the ruler's numbers are small. Sideways gives a larger battlefield.
