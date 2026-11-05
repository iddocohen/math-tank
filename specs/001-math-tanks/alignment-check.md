# Spec/Ask Alignment Check: Math Tanks

**Date**: 2026-11-05

## Source

The inline PRD passed to `/speckit.opsmill.auto`, stored verbatim in [source-prd.md](./source-prd.md). No URLs were given.

## Verdict

⚠️ MINOR DRIFT (proceeding)

Every PRD section and acceptance criterion AC-01 to AC-10 maps to spec requirements. The differences below are deferrals the PRD itself allows, or interpretations of open PRD wording. None removes or weakens a PRD requirement.

## Findings

| Severity | Category | PRD reference | Spec reference | Description |
|----------|----------|---------------|----------------|-------------|
| Minor | dropped (allowed) | 7.3 Rewards | Assumptions, "Deferred" | Stars, badges and cosmetic unlocks are deferred. The PRD marks all rewards "optional" and section 14 defers cosmetic unlocks. Stars and badges are not in the section 14 MVP list. |
| Minor | changed | 5 Subtraction configuration ("0–10, 0–20, 0–100, custom range") | FR-023, FR-046 | Subtraction uses the global number range plus its own maximum operand, not a separate subtraction range. Section 9 asks for separate operand limits, which the spec has. |
| Minor | changed | 3.3 Major ticks "such as 0, 10, 20, 30" | FR-016 | For a whole range of width 20 or less, major ticks are every 5 (or every 10 when the range contains a multiple of 10 and is wider than 10). A custom range of exactly 30 to 40 therefore shows a major tick at 35 as well. AC-03 is met in the default 0 to 100 range, where 30 and 40 are the major ticks and 31 to 39 are minor. |
| Minor | added | 2.2, 3.1 | FR-010a | The enemy stays for up to 3 shots and the player keeps one side per round. This was added after the critique so the child can learn from misses, as PRD 2.2 requires. It is an interpretation, not new scope. |
| Minor | added | 11, 12 | FR-048a, FR-051a | Export and import of data, Home Screen instructions, and updates only on the start screen. These protect the PRD's persistence and offline requirements (AC-08, AC-10) on Safari. |
| Minor | changed | 7.2 "Reduce difficulty or offer support" | FR-037 | Support on struggle is given by lowering the difficulty step and by the always-available help. The spec does not show help earlier when a child struggles. |
| Info | changed | 12 "Phaser 3 or an equivalent" | plan.md, research.md R2 | Phaser 4.2 is used. The PRD allows an equivalent engine and asks for validation during planning. |

## Action

Proceed to implementation. No remediation pass is needed (0 of 2 used).
