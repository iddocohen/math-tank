# Amendment 24: keeping the child's progress, restoring kept copies and resetting everything

**Date**: 2026-11-06
**Requested by**: the product owner:
- "When a new CI pushes the pages will the browser delete the old page saves? I want to ensure this does not happen, so kids do not lose their game play"
- after the answer, "Yes" to the README changes and the restore of kept copies
- "Also a reset button for all progress should be offered"

**Changes**: FR-048 and FR-048a (stored data), [amendment 11](./amendment-11-tank-garage.md) ("Sterne zurücksetzen"), the review fix M2 (copies under `<key>.unreadable`) and the README.

## What already protects the saves

- A new version replaces only the game's files in the offline cache (`cleanupOutdatedCaches` in `vite.config.ts`). The saves are in `localStorage` under keys starting with `mathtanks.`, and no update removes them.
- Each kind of saved data carries a version number. A new version converts older data when it loads it.
- Data written by a newer version is never saved over (review M2).
- Data that cannot be read is copied to `<key>.unreadable` before anything is saved over it (review M2). Until this amendment, nothing could bring that copy back.
- The game asks the browser to keep its data permanently (`navigator.storage.persist()`).

## Where progress can still be lost

- Safari deletes all data a website stored with scripts after 7 days of Safari use without a visit to that website. A web app added to the Home Screen keeps its own count, which only moves on days the app itself is used ([WebKit blog, "Full Third-Party Cookie Blocking and More"](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).
- Clearing the browser's data deletes the saves. The README's iPhone troubleshooting section told parents to clear data without saving first.

## Decisions

1. **Restore a kept copy.**
   - The settings page lists the kinds of data whose copy under `<key>.unreadable` this version of the game can read.
   - "Kopie wiederherstellen" saves those copies as the current data, all or none, and removes the copies.
   - The page then reloads.
   - If the save fails, nothing changes and a notice says so.
   - A copy that this version cannot read, or that comes from a newer version, is not offered.
2. **"Alles zurücksetzen"** on the progress page clears progress, personal bests, stars and the garage, including the total ever earned. The settings stay.
   - It asks first, and the question reminds the parent to save the data before.
   - All four are saved together or not at all.
   - The existing "Fortschritt zurücksetzen" and "Sterne zurücksetzen" stay.
3. **README:**
   - a section "Keeping the child's progress"
   - the Home Screen advice for iPhone and iPad
   - "save first" before every step that clears browser data

## Tests

- Unit tests in `src/app/persistence.test.ts` cover restoring kept copies and `resetAll`:
  - offered and restored
  - not offered when unreadable, newer or made in this session
  - all or none on a failed write
  - the settings stay after `resetAll`
- Unit tests in `src/app/SettingsPage.test.tsx` and `src/app/ProgressPage.test.tsx` cover the notice, the buttons, the confirmation and the failure notices.
- `tests/e2e/persistence.spec.ts` restores a kept garage copy from the settings page, and the start screen then shows its stars.
