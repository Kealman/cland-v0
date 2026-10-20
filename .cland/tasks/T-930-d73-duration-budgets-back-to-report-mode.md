---
id: T-930
kind: task
title: "D73: duration budgets back to report mode until the v0.1.4 release"
state: open
status: in progress
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
regression_of: T-915
topic: null
branch: t/T-930-d73-duration-budgets-back-to-report-mode
created: 2026-10-20T02:57:12.479Z
updated: 2026-10-20T02:57:17.658Z
---

## Summary

D73 (stand-in under D24, ask 8fe184d2, 2026-10-20 02:56Z): duration budgets go back to report mode until the v0.1.4 release. Under enforce mode (T-915) every stage cover went red only on duration-budget lines, with zero test failures, because tests near their budget cross it by load variance (±15–20 %), and the headroom rounds (T-923, T-929) were overtaken by each next run.

## What to build

Set `budget.mode` in `hub/test/durations.json` back to `"report"`, or remove it, whichever the manifest validator treats as report. Change nothing else in the manifest: all allowances, baselines, owners and the D72 legacyOwner stay. Update the wording in docs/agents/tests.md (and hub/README.md if it says budgets enforce) to "report mode until after v0.1.4 (D73); enforcement returns under E-880".

## Acceptance criteria

- [ ] C1. The manifest diff is exactly the mode line, and a dry-run shows `budget (report only)` lines.
- [ ] C2. The docs state D73.
- [ ] C3. A mode-free verify at the reviewed head is green.
