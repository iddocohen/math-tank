# Amendment 12: iPad and phone screens, with an on-screen number pad

**Date**: 2026-11-05
**Requested by**: the product owner: "It must also run on a IPAD resolution and/or phone resolution".
**Changes**: FR-050, FR-053, FR-058 and the minimum screen size of 768 by 600 (spec Assumptions); amendment 05 item 3 (input methods).

## Behavior

1. **On-screen number pad.** On touch devices (no fine pointer, or a screen narrower than 1100 CSS px), the battle screen shows a number pad: keys 0 to 9, a minus key only when the range has negative numbers, ⌫ (delete), and the fire key ("Feuer!"). Each key is at least 48 by 48 CSS px, ideally 56 or more. The pad can also be shown on desktop through a parent setting (`numberPad`: auto (default), always, never).
2. **Number pad counts as typing.** Pad keys behave exactly like the keyboard digits, Backspace and Enter (the typed number shows large; fire at it). For the input-method rule of amendment 05, the pad counts as keyboard input, so "Finde N" is not generated while the child uses the pad.
3. **Layouts.**
   - iPad landscape (for example 1024 by 768, 1180 by 820, 1366 by 1024): battlefield and ruler on top, number pad and fire key in the bottom bar.
   - iPad portrait (768 by 1024, 820 by 1180): battlefield and ruler on top at full width, number pad below in a large grid.
   - Phone landscape (for example 844 by 390, 932 by 430): battlefield and ruler on the left, a compact number pad in a column on the right; the challenge banner stays readable (at least 16 px text).
   - Phone portrait (narrower than 600 CSS px and taller than wide): a friendly full-screen picture "Bitte dreh das Handy" with a rotating phone icon; the game pauses until the phone is turned. Settings and the progress page work in portrait.
4. **Nothing is cut off.** In every listed size, the whole ruler with its labels, both tanks, the hearts, the banner, the help button, the gear and the new-scene button are visible without scrolling, and no two interactive targets overlap. The parent gate (press and hold 2 s) works by touch.
5. **Fullscreen and Home Screen.** The fullscreen button works where the browser allows it; on iPhone, where fullscreen is not available to web pages, the button is hidden and the Home Screen note applies.
6. **Tests.** Playwright projects with device emulation for iPad landscape, iPad portrait and iPhone landscape (WebKit), plus an iPhone portrait check for the rotate picture. One full round is played with the number pad only (taps on pad keys), and screenshots of each size are checked for cut-off or overlapping elements.
