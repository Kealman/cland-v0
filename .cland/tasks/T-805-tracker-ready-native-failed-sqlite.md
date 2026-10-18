---
id: T-805
kind: task
title: 'tracker-ready-native: "failed SQLite identity adoption…" asserts the injected failure right after presence, before adoption has run (macOS under load)'
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-511
branch: t/T-805-tracker-ready-native-failed-sqlite
created: 2026-10-18T13:55:15.045Z
updated: 2026-10-18T14:55:46.071Z
closed: 2026-10-18T14:55:46.071Z
---

## Summary

hub/test/tracker-ready-native.test.ts:481 failed in E-678's macOS stage run 262de16a (A-5335), at peak load 15. `assert.ok(failures >= 1)` runs right after `rev.waitForPresence(['rev'])`, but the identity-adoption transaction that hits the mocked `update tracker_written_verdicts set session_id` runs asynchronously after presence, so under load the counter is still 0. Alone on the Mac it passes 5/5 (15/15 tests each).

## Acceptance criteria

- [x] C1. The test waits on an observed adoption attempt (failures ≥ 1, through the existing eventually helper or an adoption event) before its assertions, keeping every assertion. It passes 20/20 under a planted delay of the adoption step.
  - done: impl-805 · 2026-10-18T14:41:21.148Z
  - verified: rev-30 [reviewer] · run rev-20261018-805-final · 2026-10-18T14:47:00.274Z · commit 6a27d97f53425dd65bed2674ce4a6035ae4dfb73

## Comments

### impl-805 · 2026-10-18T14:28:17.746Z

Inspecting existing adoption-failure test; will prove the race with controlled adoption delay, retain all assertions, and wait on failures >= 1. Local test execution held until cover-quiet lifted.

### impl-805 · 2026-10-18T14:41:21.706Z

Implemented at 6a27d97f53425dd65bed2674ce4a6035ae4dfb73; branch t/T-805-tracker-ready-native-failed-sqlite pushed to origin after fetch/merge origin/dev. Red proof A-5346: original assert fails with 100 ms planted adoption delay. Fixed delayed repetition A-5348: 20/20. Temporary delay removed; final diff is one comment and one eventually wait, every assertion retained. npm run test:lint and npm run typecheck exit 0. Whole tracker-ready-native.test.ts: 15/15, 31.564 s (A-5350). QA policy none, no QA criteria. Requesting source review, then exact-head mode-free droplet verification.

### rev-30 · 2026-10-18T14:42:28.985Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-805-source
commit: 6a27d97f53425dd65bed2674ce4a6035ae4dfb73
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Two-line test-only diff against 2a3aa788: existing bounded eventually helper observes the SQLite mock's failures >= 1 before the unchanged assertion sequence. Native T3 classification/lifecycle and cleanup remain intact; no process, permanent timer, allowance or production change. Standards/spec: no findings. A-5346 red proof reviewed; independently parsed A-5348 twenty delayed positive runs, all pass with no skips/failures, and A-5350 whole-file 15/15 in 31.564s. Temporary instrumentation is absent from the committed diff. C1 final verification remains pending one exact-head post-source mode-free droplet receipt. No reviewer execution or per-item QA.

### impl-805 · 2026-10-18T14:46:15.341Z

Same reviewed head 6a27d97f53425dd65bed2674ce4a6035ae4dfb73 passed the single mode-free droplet verify f8e7c249-03d4-43bd-8b1f-a51c8b8ecf52: hub-selected, exit 0, 29/29 tests, no skips; A-5369. Linux x64, c-8 lon1, lifetime 123 s, cost $0.0086. Admission reply timed out but original request persisted; no duplicate submitted. Awaiting Reviewer final verdict and C1 verification; claim retained until merge.

### rev-30 · 2026-10-18T14:47:00.274Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-805-final
commit: 6a27d97f53425dd65bed2674ce4a6035ae4dfb73
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear. A-5369/f8e7c249 passes at unchanged source-reviewed head: selected hub 23/23 plus Neovim smoke 6/6, total 29 pass, zero fail/cancelled/skips. Independent raw timing and positive reporters confirm all fifteen tracker-ready-native cases execute; affected adoption identity passes 0.296302062s. Correct tier-mismatch parsing finds zero rows; no hard budget failure. C1 verified with source A-5356, preserved assertion diff, documented red A-5346 and independently parsed twenty delayed passes A-5348. Existing identity receives no new-name repetitions; only reported inherited workbench group is 5/5. No full-suite claim, source change, allowance, Reviewer execution or per-item QA.

Criteria: C1 verified.

### coord · 2026-10-18T14:55:46.071Z

Merged 59337a6e6e3bbcd8971b33a3aa7b3080958583a4 onto dev.
