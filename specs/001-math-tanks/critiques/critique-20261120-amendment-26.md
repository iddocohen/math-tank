# Critique Report: Amendment 26, plus and minus with two larger numbers

**Date**: 2026-11-20
**Feature**: [spec.md](../spec.md) (US3 scenarios 6 to 12, FR-148 to FR-157), [amendment 26](../amendment-26-two-number-arithmetic.md)
**Plan**: [plan.md](../plan.md) decision 12, [research.md](../research.md) R24, [data-model.md](../data-model.md), [core-api.md](../contracts/core-api.md)
**Verdict**: ⚠️ PROCEED WITH UPDATES

---

## Executive Summary

The amendment adds two-number plus and minus exercises inside the existing addition and subtraction kinds, with separate ranges for the first and second number, a carry switch per kind, place-value help and a 4-step ladder. Keeping the kinds avoids changes to progress, records, prompts and the amendment 25 change detection. One gap blocks implementation. The settings check runs at the parent's top step, but a lower ladder step that forbids carrying can have no exercise at all, for example first numbers 90 to 99 with carrying on. Four smaller risks should be covered by tests:

- the transfer code size limit
- the extra banner lines in the phone portrait layout
- spoken help with "Vorlesen"
- the enemy gap around the player's tank

The project constitution is an unfilled template, so no principle applies.

---

## Product Lens Findings 🎯

### Problem Validation
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P1 | 💡 | The need comes directly from the product owner, who plays the game with the child. The scope is plus and minus only, and no comparison or number-line kinds change. | None. Scope fits. |

### User Value Assessment
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P2 | 🤔 | The request "overflow is configurable as well with X digits, e.g. … 45 + 6, 52 + 9" can be read two ways: the second number has X digits, or carrying is allowed only in the lowest X columns. The spec chose separate ranges for the first and the second number. That covers the given examples and also allows other choices, such as 50 to 99. | Keep the reading and say it in the run summary, so the product owner can correct it. Resolved by the orchestrator. |

### Alternative Approaches
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P3 | 💡 | With 4 number fields per kind, the settings form grows. Quick choices such as "Zweistellig + einstellig" would be faster to set. | Defer. The ranges are enough for the requested cases. Note it as a possible follow-up. |

### Edge Cases & UX
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P4 | 💡 | Help step 2 adds 2 to 4 banner lines. On a phone held upright (amendment 22) the banner is narrow, and the lines can cover the battlefield or be cut off. | Add a requirement that the lines fit in every layout, wrapping as needed, and check it in the device projects of the e2e test. |
| P5 | 💡 | With "Vorlesen" (speech) on, the game reads the task aloud. The spec does not say whether the place-value lines are read. | Read the lines the same way the current help hint is read: if the hint is spoken, speak the lines in order. |

### Success Measurement
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| P6 | 💡 | The amendment has no success criterion of its own. The PRD measures success by whether the child plays another round, and that criterion covers this mode as well. | None needed. The quickstart row 37 gives the manual check. |

---

## Engineering Lens Findings 🔬

### Architecture Soundness
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E1 | 💡 | The `twoNumbers` flag on the challenge decouples help and validation from later settings changes. The plan states this. | None. |

### Failure Mode Analysis
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E2 | 🎯 | FR-152 checks that an exercise exists at the parent's settings, but FR-153's steps 1 and 2 forbid carrying. With carrying on and ranges where every pair carries, a lower step has no exercises. Example: first numbers 90 to 99 and second numbers 10 to 99 on the battlefield 0 to 200, where every tens column carries. The generator would then drop plus for the whole round, or fall back to other kinds. With only plus turned on, the child would never get the configured exercises. | When a ladder step has no exercise, use the next easier-to-harder step that has one, up to the parent's settings. In the clamped step, `allowCarry` turns on, then `secondFraction` widens. Add this to FR-153, data-model.md and the ladder tests. |
| E3 | 💡 | `allowedAnswers` drops answers near the player's tank (minimum enemy gap). With a small answer set, every answer can fall in the gap. | The generator already falls back to other kinds. Add a unit test where only plus is on and the answer set is narrow, so the round still produces a challenge. |

### Security & Privacy
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E4 | 💡 | Settings come from import files and transfer codes, so they are untrusted input. The new ranges are checked by the schema and by `validateSettings`. A range of 1 to 999 against 1 to 999 needs about 1 million checks, which is bounded. | Check the import path for the new fields, the same way the other fields are checked. No further action. |

### Performance & Scalability
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E5 | 💡 | Building the exact answer list takes up to about 1 million column checks. With memoization this runs once per settings and step, but the settings page runs `twoNumberFit` again on every change while the parent types. | Use the same memoized function on the settings page, and add a unit test that keeps the worst case under about 50 ms. |

### Testing Strategy
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E6 | 💡 | The amendment lists tests for each layer. The case in E2 and the transfer size limit are not in the list. | Add both (see E2 and E7). |

### Operational Readiness
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E7 | 💡 | Transfer codes must stay under 2300 bytes for the largest QR code. Eight more settings fields make the code longer. | Add a transfer test with the new fields set to values other than the defaults, and check that the link stays under the limit. |

### Dependencies & Integration
| ID | Severity | Finding | Suggestion |
|----|----------|---------|------------|
| E8 | 💡 | The amendment 25 change detection compares whole `addition` and `subtraction` objects, so the new fields are task-shaping without a code change (FR-157). | Add a controller test that changing `addition.carry` mid-round gives a new scene. |

---

## Cross-Lens Insights 🔗

| ID | Finding | Product Impact | Engineering Impact | Suggestion |
|----|---------|---------------|-------------------|------------|
| X1 | A ladder step with no exercises (E2) | The child never gets the configured exercise type, and the parent sees no error. | A silent fallback in the generator. | Apply the step fallback from E2. It keeps the parent's choice and keeps the generator total. |

---

## Findings Summary

| ID | Lens | Severity | Category | Finding | Suggestion |
|----|------|----------|----------|---------|------------|
| E2 | Engineering | 🎯 | Failure modes | A lower ladder step can have no exercises | Fall back to the next step that has exercises |
| P2 | Product | 🤔 | User value | Two readings of "overflow with X digits" | Keep separate ranges and report the reading |
| P4 | Product | 💡 | UX | The banner lines on a phone held upright | Require the lines to fit; check in the device e2e |
| P5 | Product | 💡 | UX | Speech for the help lines | Speak the lines like the current hint |
| E3 | Engineering | 💡 | Failure modes | The enemy gap with a small answer set | Unit test for the fallback |
| E5 | Engineering | 💡 | Performance | Fit checks while the parent types | Memoize; test the worst case |
| E7 | Engineering | 💡 | Operations | Transfer link length | Test with values other than the defaults |
| E8 | Engineering | 💡 | Integration | Mid-round change detection | Controller test |
| P3 | Product | 💡 | Alternatives | Quick choices in the settings | Defer |

## Applied (autonomous run)

- E2 is added to FR-153, to amendment 26 item 6 and to data-model.md.
- P4, P5, E3, E5, E7 and E8 are added to amendment 26 item 11 (tests) and item 7 (speech and layout).
- P5 was later overruled by the product owner ("No reading out loud needed"): the lines are not spoken.
- P3 is deferred.
- P2 is resolved by the orchestrator's reading and reported in the run summary.
