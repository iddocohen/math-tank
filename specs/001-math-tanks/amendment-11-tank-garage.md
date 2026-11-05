# Amendment 11: tank garage with looks earned by playing

**Date**: 2026-11-05
**Requested by**: the product owner. They asked "What is one missing feature that would make this game from good to great for a child", accepted the recommended tank garage, and said "Yes do it".
**Builds on**: PRD section 7.3 (rewards: new tank appearances, projectile visual effects, unlockable cosmetic upgrades; must not depend on perfect performance; no gambling-like mechanics or monetization), which section 14 had deferred until the core experience works.

## Behavior

1. **Stars.** Every destroyed enemy (not decoys) gives the child 1 star, in every mode. Stars are counted for the child across all rounds and sessions and are never lost: not by mistakes, lost hearts, round end, a reset of learning progress, or a change of settings.
2. **Unlocks.** Every 10 stars unlock the next item, in a fixed order (no chance, no choice of random boxes, no shop). About 12 items in 4 kinds, all drawn in code:
   - tank colors (keeping the child's tank clearly blue-ish so it never looks like the red enemy: sky blue, teal, turquoise, navy with stripes);
   - flags on the antenna (star is the default; then rocket, dragon, football, lightning);
   - shell trails (sparkles, rainbow, bubbles);
   - a hat on the turret (crown, helmet).
   The first unlock comes at 10 stars, so a typical first session reaches it.
3. **Garage.** A large "Garage" button on the start screen (mouse, touch, and Enter is not mapped to it; Space and Enter keep starting the game). The garage shows all items: unlocked ones can be chosen with one tap or click per kind; locked ones are shown as a grey silhouette with how many stars are still needed ("noch 4 Sterne"). A preview tank shows the current choice. A keyboard child can open it with the G key on the start screen and choose with digits 1 to 9 for the item and Enter to equip (keyboard-only play, amendment 01).
4. **In battle.** The child's tank uses the chosen color, flag and hat, and its shells use the chosen trail. The enemy and decoys never change look.
5. **End screen.** After a round, if the child crossed a 10-star mark, the end screen shows one line with the new item and a short celebration ("Neu freigeschaltet: Raketen-Flagge!"), plus the star total. If several items unlocked in one round, all are listed in one line. No other pressure messages.
6. **Star counter.** A small star icon with the total shows on the start screen and the end screen (not during play, so play stays focused on the ruler).
7. **Parent options.** `garage` on or off (default on). When off, the garage button, stars and unlock messages are hidden; stars still accumulate silently so turning it back on loses nothing. Export and import include stars and the chosen look. "Reset progress" does NOT reset stars or unlocks (only a separate, confirmed "Sterne zurücksetzen" does).
8. **Storage.** Stars, unlocked items and the chosen look are stored locally with the progress data (versioned, with migration).
