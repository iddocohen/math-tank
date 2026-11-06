# Amendment 23: open the garage from the battle

**Date**: 2026-11-06
**Requested by**: the product owner: "I would like to have an icon e.g. next to settings where one can go the the garage easily, as today it is not possible."
**Changes**: [amendment 11](./amendment-11-tank-garage.md) (the garage opens from the start screen only) and [amendment 19](./amendment-19-star-shop-aim-cross.md).

## Decisions (answers)

- Where: an icon in the battle, next to the gear (top right). The start screen keeps its "Garage" button; no icon is added there or on the round end screen.
- A running round pauses while the garage is open and continues where it was when the child leaves the garage.

## Behavior

1. **Garage icon.** With the garage on (parent setting "Garage"), the battle shows a garage icon button beside the gear, at the same size as the other top-right buttons, in every layout (wide, portrait, side). With the garage off, the icon does not show. The button has an accessible name from `src/i18n/de.ts` ("Garage").
2. **Opening.** One tap or click opens the garage over the battle. There is no 2-second hold, because the garage is for the child, not the parent. The battle stays loaded underneath.
3. **Pause.** While the garage is open, a running round is paused the same way as for a parent screen: the timer stops, no enemy fires, and the battle's keys do nothing. If the child had already paused the round with the pause button, it stays paused after the garage closes.
4. **Closing.** "Zurück" (and the garage's existing back key) closes the garage and the round continues.
5. **New look at once.** A look equipped, bought or returned in the garage shows on the child's tank and on its shell trail when the garage closes, without starting a new round.
6. **Stars.** Buying and returning work exactly as on the start screen (amendment 19). Stars earned in the running round are already in the balance.
7. **Tests first**:
   - The battle shows the icon only with the garage on.
   - Opening pauses a running round, and closing resumes it. A round the child paused stays paused.
   - Keys do nothing in the battle while the garage is open.
   - A look equipped from the battle shows on the tank after closing (`data-player-look`).
   - e2e: open the garage from a running round by tap, equip a look, close, and the round continues with the new look. Run it in desktop and in the device projects.
