# Amendment 19: spend stars in the garage, and a setting for the aiming cross

**Date**: 2026-11-05
**Requested by**: the product owner: "Today stars are not getting spent and I would like that when he spends stars for something that he needs to earn new ones for it, or reset others to buy something new, would that work? Also the yellow cross that has a line down, I would like to remove as well via an option, aka it should be enabled, enabled only for given difficulty or disabled completely."
**Changes**: [amendment 11](./amendment-11-tank-garage.md) items 2, 5 and 6 (unlocks by star total).

## Decisions (answers)

- Returning an item gives all its stars back.
- Rising prices: simple items 10, better items 20, special items 40.
- "Only up to a given difficulty" is decided by the ruler level.

## Star shop

1. **Balance.** Every destroyed enemy that counts (amendment 18) adds 1 star to the child's balance. The start screen and end screen show the balance.
2. **Free basics.** The basic look is owned from the start: blue color, star flag, simple trail, no hat.
3. **Prices.** Every other garage item has a price: simple items 10 stars, better items 20, special items 40 (the crown, the rainbow trail and the navy stripes are special; the exact list per item is fixed in data-model.md). Items are shown sorted by price within each kind.
4. **Buying.** In the garage, an item the child does not own shows its price. Choosing it (tap, or number key plus Enter) when the balance is high enough asks once "Für N Sterne kaufen?" with "Ja" and "Nein" (large buttons; Enter = Ja, Escape = Nein); "Ja" deducts the price, adds the item to the owned items and equips it. When the balance is too low, the item shows "noch N Sterne" and cannot be bought. No timers, no random items, no real money.
5. **Owned items** can be equipped and swapped freely at no cost.
6. **Returning.** An owned item that is not a free basic can be returned: "Zurückgeben" asks once "Zurückgeben? Du bekommst N Sterne." and gives the full price back. If the returned item was equipped, the free basic of that kind is equipped.
7. **End screen.** Shows the stars earned in the round and the new balance; when the balance now reaches the price of an item not owned yet, one line "Genug Sterne für: Krone" (at most one item named). No pressure messages.
8. **Migration from amendment 11.** Existing players keep every item they had unlocked, now as owned. Their balance becomes their star total minus the price of the owned items, at least 0. Total stars ever earned is kept for the progress page.
9. **Parent options.** "Garage und Sterne" (on/off) stays; "Sterne zurücksetzen" resets the balance to 0 and owned items to the free basics, after a confirmation. Export, import and the QR transfer include balance, owned items and the equipped look.

## Aiming cross

10. **Setting "Zielkreuz"** (the yellow crosshair marker with its vertical guide line down to the ruler, shown at the chosen or typed number) with three values: "Immer" (always, default), "Bis Zahlenstrahl-Stufe N" (shown only while the round's ruler level is at most N, N from 1 to 5, default 2), "Nie" (never).
11. When the cross is hidden, choosing a number still works (typing, the number pad, tapping the ruler); the chosen number shows only in the "Deine Zahl" readout; the landing marker, the step bracket and the help steps are unchanged (help step 3 still marks the solution).
12. With adaptive difficulty, the cross disappears automatically once the ruler level rises above N.
13. Settings version increases with a migration (default "Immer").

## Tests

Shop: buying deducts and equips, too-low balance refuses, returning refunds fully and re-equips the basic, migration keeps owned items and computes the balance, counted kills only, export/import/transfer round trip. Cross: each setting value, the level threshold with an adaptive level change, choosing still works with the cross hidden. E2E: earn stars, buy an item, return it, buy another; play a round with the cross set to "Nie".
