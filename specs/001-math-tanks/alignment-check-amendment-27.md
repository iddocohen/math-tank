# Alignment check: amendment 27

**Date**: 2026-11-21

## Source

The inline request passed to `speckit-opsmill-auto`: the product owner's question "Can we split the Nur Rechnen into two categories, one with the addition and subtraction and one with what is between numbers?" and the orchestrator's reading in items 1 to 9. No URL.

## Verdict

⚠️ MINOR DRIFT (proceeding)

## Findings

| Severity | Category | Source reference | Spec reference | Description |
|----------|----------|------------------|----------------|-------------|
| Low | Changed | Item 7 ("a stored playModes.math value carries over to both new modes") | Amendment 27 Behavior item 9 | "Nur Rechnen" carries over only to a mode that can be offered with the stored settings, and "Gemischt" is turned on when no mode is left. The reason: settings that fail a check on load reset to the defaults, so carrying over to both modes unconditionally could reset a parent's settings. |
| Low | Changed | Item 8 ("a running Nur Rechnen round restored after a reload must still load") | Amendment 27 Decision 9 | The code check found that the game does not save a running round, and updates apply only on the start screen. No mapping is needed, so no task is planned. |
| Low | Added | Item 3 ("make the settings check catch the impossible case") | Behavior items 7 and 8, FR-158 to FR-167 | A new settings error for the distance from the child's tank, and a 3-stage generator fallback. This is the requested check in detail. |
| Low | Added (critique) | Not in the request | Behavior item 12, FR-167 | A round whose mode can no longer play keeps its task settings, and "Nochmal" shows the start screen (critique E2). |
| Low | Added | Not in the request | Behavior item 10 | Old "Nur Rechnen" bests stay and show as "Nur Rechnen" on the progress page (the decision that item 6 asked for). |

Items 1 to 6 and item 9, the labels, the German interface, the amendment convention and the test list appear in amendment 27 and FR-158 to FR-167.

## Action

Proceed to implementation. Report the reading of "what is between numbers", the labels, and the changes to items 7 and 8 to the product owner.
