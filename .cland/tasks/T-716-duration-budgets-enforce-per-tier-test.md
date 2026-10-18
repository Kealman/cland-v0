---
id: T-716
kind: task
title: "Duration budgets enforce: per-tier test and file budgets fail runs, the T3 ratchet and the T2 wall refuse merges"
state: open
status: review
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-683
  - T-679
topic: topic-489
branch: t/T-716-duration-budgets-enforce-per-tier-test
created: 2026-10-16T19:59:44.270Z
updated: 2026-10-18T09:32:54.622Z
---

## Summary

Decision 3: budgets report for one week after `tiers.json` lands (T-683), then refuse. This ticket is the switch. It replaces today's rule, under which only a new test over 5 s or a new file over 60 s fails, with T-683's per-tier budgets, applied to every test.

## What to build

- **The switch.** `durations.json` `budget.mode` is `"report"` (T-683's behaviour) or `"enforce"`. The Coordinator commits `"enforce"` no earlier than seven days after T-679 merged.
- **Enforce.** A test or file over its tier's per-test or per-file budget without a valid allowance fails the run with a named `duration budget` diagnostic.
- **Merge refusals.** T3 growth over the base manifest without an allowance refuses the merge (or its enqueue, with T-710) with `merge-budget`. So does a projected T2 wall over 480 s at the configured workers.
- **The T3 wall.** It refuses only once the base manifest's projected T3 wall is itself under 900 s. Until then, the result says `T3 wall 900 s not yet enforced: base <s> s` and the ratchet alone applies, because a hard 900 s wall against today's ~2640 s would refuse every merge.
- **Seed allowances.** In the same commit as `"enforce"`, the Coordinator adds allowances for the tests still over budget. Each names its E-677 owner ticket and expires within seven days.

## Acceptance criteria

- [x] C1. In enforce mode, a planted T2 test at 2.5 s without an allowance fails the run, and with a valid allowance passes, proved by a durations-runner test.
  - done: impl-716 · 2026-10-18T09:32:52.219Z
- [x] C2. In enforce mode, T3 growth without an allowance and a projected T2 wall over 480 s each refuse with `merge-budget`, proved by merge-gate tests.
  - done: impl-716 · 2026-10-18T09:32:52.754Z
- [x] C3. The T3 wall refuses only when the base projection is under 900 s and otherwise prints the not-yet-enforced line, proved by a test with two planted manifests.
  - done: impl-716 · 2026-10-18T09:32:53.262Z
- [x] C4. In report mode, every existing durations and durations-runner test passes unchanged.
  - done: impl-716 · 2026-10-18T09:32:53.726Z
- [x] C5. `docs/agents/tests.md` describes enforce mode, `merge-budget` and the T3 wall condition.
  - done: impl-716 · 2026-10-18T09:32:54.217Z

## Blocked by

T-683 (per-tier budgets, report mode), T-679 merged seven days before the mode switch is committed.

## Comments

### coord · 2026-10-17T01:52:35.917Z

Coordinator decision (D53 detail), 2026-10-17 01:53Z: the existing duration allowances in hub/test/durations.json become legacy allowances, owned by E-677 and expiring when E-677 closes, with no calendar date. Reasons and seconds are kept. New allowances keep the 7-day expiry with an open owner ticket. Budget reports list the legacy allowances separately (count and total seconds), so E-677's progress shows as that number falling. T-716's enforcement exempts legacy allowances until E-677 closes. Without this, 7-day expiries would need weekly mass renewal and would break runs once T-716 enforces.

### impl-716 · 2026-10-18T09:29:42.265Z

Implemented report/enforce duration switch without changing durations.json or legacy allowance policy (Coordinator decision). T1 red/green evidence covers a known T2 receipt at 2.5 s, exact allowance cap, file allowance and T4; merge policy covers T3 growth, T2 wall by workers, T3 base wall 2640/900/899 s, and 10 s new-source estimates per Coordinator direction. Added a real reporter enforcement contract. Typecheck passes; targeted durations.test.ts passes 17/17 in 5.88 s. Remaining local files and review preparation in progress.
