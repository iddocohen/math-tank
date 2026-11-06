# Amendment 15: move a save to another browser with a QR code or link

**Date**: 2026-11-05
**Requested by**: the product owner: "But what about if a user wants to pick up his save from one browser to the next one", then "Yes do that, QR code is good choice".
**Builds on**: FR-048a (export and import as a file), which stays.

## Behavior

1. **"Spielstand übertragen"** (transfer save) on the settings page (behind the parent gate) shows a QR code and a "Link kopieren" button for the current save.
2. **What the transfer contains** (compact, versioned): settings; garage stars, unlocked items and the chosen look; personal bests; per skill and range the current difficulty step, attempts, independent correct, with help, and the mastery window; session totals. It does NOT contain the detailed attempt history (up to 2000 entries); the file export keeps carrying that.
3. **Format.** JSON → deflate (browser `CompressionStream`, fallback: uncompressed) → base64url, placed in the URL fragment: `https://iddocohen.github.io/math-tank/#save=v1.<data>`. Browsers never send the fragment to the server, so GitHub never receives the save. The link works from any address of the game (it uses the current page's address).
4. **Size.** The QR code is generated locally in the browser (bundled library with an MIT or similar license, or code-generated), error correction level M or L, and stays scannable by an iPad or phone camera. If the compressed save is too large for one QR code (more than about 2.3 KB), the oldest per-session totals are dropped first, then the mastery windows are shortened, and the settings page says that the detailed history only travels with the file export.
5. **Receiving.** When the game opens with `#save=` in the address, it shows a parent-facing dialog (no browser `confirm()`): "Spielstand übernehmen? Sterne: N, Rekord: M, Zahlenraum: A bis B". "Übernehmen" (take over) replaces this browser's settings and progress summary and keeps no other data; "Abbrechen" (cancel) leaves everything unchanged. In both cases the fragment is removed from the address (history.replaceState), so a reload does not ask again and the link does not stay in the address bar.
6. **Safety.** Data is validated with the same schemas and migrations as loading from storage; an invalid or damaged code shows "Dieser Code passt nicht" and changes nothing. A child opening the link sees the dialog but needs a parent to decide; the dialog uses the parent gate (press and hold 2 s on "Übernehmen") so a child cannot take over a save by accident.
7. **Offline.** Generating the QR code and receiving a save work offline (all code bundled).
8. **Tests.** Unit: encode/decode round trip, size limits and trimming order, invalid codes, migration of an older transfer version. E2E: copy the link from settings in one browser context, open it in a fresh context, take it over via the hold gesture, and see the same stars, look, settings and records; cancel leaves the fresh context unchanged; the address no longer contains `#save=`.
