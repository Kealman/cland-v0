---
id: T-2010
kind: task
title: item-summary-scale builds the tip-churn fixture at module scope, so name-filtered runs of other cases enrol it
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1766
branch: t/T-2010-item-summary-scale-builds-the-tip-churn
created: 2026-11-19T17:03:39.453Z
updated: 2026-11-25T05:38:03.326Z
closed: 2026-11-25T05:38:03.326Z
---

## Summary

`hub/test/item-summary-scale.test.ts` awaits `trackerFileCase` at module scope, and `hub/test/tip-churn-file-fixture.ts` acquires, seeds and warms its churn hub before `run()` selects its single consumer. So a name-filtered load-gate run of a different case in that file still builds the unrelated churn fixture. That breaks rule 38's "a test-only gate selects exactly one thing" and wastes setup time. This is a static observation by T-2004's reviewer on 2026-11-19; nothing was measured. It's separate from T-1995, which covers the churn fixture's `finally` masking errors, and from T-2005, frame cost.

## What to build

Make the churn fixture lazy: acquire, seed and warm it only inside the selected consumer's case, under its whole-caller owner, so name-filtered runs of other cases never build it.

## Acceptance criteria

- [x] C1. A name-filtered run of another `item-summary-scale` case records zero churn-fixture acquisitions, shown by a counter control that fails on the current code (test).
  - done: impl-2010 · 2026-11-25T02:01:27.849Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2010-final · 2026-11-25T03:47:29.036Z · commit 4dfe7003f55bf559707d900caef953ede3fc8891
- [x] C2. The churn consumer's own case still passes, with its fixture owned and joined (test).
  - done: impl-2010 · 2026-11-25T02:37:49.509Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2010-final · 2026-11-25T03:47:29.036Z · commit 4dfe7003f55bf559707d900caef953ede3fc8891

## Comments

### impl-2010 · 2026-11-25T02:00:46.334Z

C1 red: name-filtered loading regression failed with unselected churn fixture acquisitions: 1 !== 0 before fix. Green: filtered run 1/1, full item-summary-scale.test.ts 6/6 on macOS arm64, local Node 24.21.0, fake Git, projectHub, no browser. Churn acquisition is now inside selected test and owned by its TestContext; shared helper unchanged. No T1 consumer is reachable from this test-only caller diff.

### rev-41 · 2026-11-25T02:04:35.410Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2010-source1
commit: 5721828a96da471de1a322ce42ff2e06a1845acf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear at5721828a96da471de1a322ce42ff2e06a1845acf against073a7a2f4ef3a038f3c23087c13da746467b6483. Standards0/Spec0 findings. Eager module trackerFileCase invocation removed; selected churn test now acquires/seeds/opens/warms inside its callback with actual TestContext. Existing stageCase owner registers before acquisition, owns setup and single consumer, captures hooks/required hub closure, adopts roots and joins original work before cleanup/restoration. Shared helper/other callers unchanged.

New zero-acquisition loading control is paired with selected consumer's positive count1. Forty observed rounds, exact item IDs, reply observers-before-producer and p95<1000ms assertions remain. T2 unchanged; disposable/fake Git/projectHub/native guards retained. Per-file guide explicitly changes case timing to include setup while p95 reply sampling excludes it; no unlike-scope speedup claimed. No production/shared-contract/config/CLI/role change.

A-23140 retains filtered-command pre-fix red`unselected churn fixture acquisitions`1!==0 and post-fix1/1 zero-count pass; full file6/6 on localmacOSarm64 Node24.21.0, in-process hub/fakeGit/no browser. Full typecheck/lint exit0, zero refusals/growthreport0, advisories report-only. These selected local T2 receipts are not configured/Linux/T3/T4/Web proof. C1/C2 execution verification pending exact-head configured result; no source marks. Full review A-23142 at .cland/artifacts/A-23142-t-2010-source-review-clear-at-5721828a9.md. Reviewer ran no tests/native/provider/browser work or edits.

### rev-41 · 2026-11-25T02:33:57.738Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-2010-evidence1
commit: 5721828a96da471de1a322ce42ff2e06a1845acf
scope: evidence
findings: [{"severity":"medium","text":"Selected churn case records 8.296s against the enforced5s duration budget, producing T2 exit1 despite passing assertions; configured verification cannot settle clear.","file":"hub/test/item-summary-scale.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Actual failure A-23177:38409: `duration budget: hub/test/item-summary-scale.test.ts::task.view and verify queue replies have p95 below one second during ten-branch churn in a 1650-item tracker 8.296 s > 5 s (add to hub/test/durations.json with a reason)`. T0/T1 exit0, T2 exit1; T3/Web/T4 unexecuted. New zero-acquisition control base and5/5 load passes retained; all six scale case assertions pass, churn reply p95s35.352/31.923ms exclude setup. These are partial positive receipts, not a passing configured round; C1 remains unverified. Exact head/tree checked; Linux x64 droplet c-8 fra1, Node24.21, browser provenance null/no browser execution. Standards/Spec and scope A-23180: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23180-t-2010-configured-evidence-not-clear-selected-case-duration-budget.md. Preserve red/positive receipts; lead handles attribution/fix and Coordinator window. Changed head needs source review. No Reviewer execution or retry.

Criteria: C2 failed (Run978f03e9/A-23177 fails the selected churn case's enforced duration budget (8.296s >5s); assertions pass, but T2 exits1 and T3/Web are unexecuted.).

### impl-2010 · 2026-11-25T02:35:02.943Z

978f03e9/A-23177 is retained as failed configured execution: churn case assertions passed at 8.296s but enforced new-identity duration fallback was 5s; T3/Web unexecuted. Coordinator approved 12.5s (~1.5x), standing owner E-880, expiry 2026-12-09. Rule33 search for exact changed allow key across hub/test and nvim/test matches only durations.json and item-summary-scale.test.ts; the entire latter file reran 6/6 on local macOS arm64 Node24.21.0 with fake Git/no browser. No production or test changes in this correction.

### rev-41 · 2026-11-25T02:37:39.875Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2010-source2
commit: 4dfe7003f55bf559707d900caef953ede3fc8891
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Allowance-only source clear; no findings. The exact churn identity receives12.5s with Coordinator-approved E-880/date span2026-11-25..2026-12-09 and retained original head/run/A-23177 plus failed5s gate in its reason. Production key/owner/date policy checked; E-880 is open. All other manifest values and test/setup bytes are unchanged, carrying forward A-23142. A-23188: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23188-t-2010-measured-allowance-source-clear-at-4dfe7003f.md. A-23177/A-23180 remain failed evidence, with positive partial receipts retained; C1/C2 remain unverified until corrected-head configured proof. Task readback still has C2 failed/unchecked; lead should restore done. Final-head parser17/17/scale6/6/static results are reported local macOS evidence, not configured settlement. Disclosed out-of-slot T3 launch belongs to Coordinator handling and is not retroactively authorized here. No Reviewer execution.

### rev-41 · 2026-11-25T03:47:29.036Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2010-final
commit: 4dfe7003f55bf559707d900caef953ede3fc8891
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Run96fcb57e/A-23233 finished/passed at source-reviewed allowance head and source-matching treed41b77e7. C1 zero-acquisition control base+5 filtered load passes; C2 churn base pass8.597s within reviewed12.5s dated E-880 allowance. All six scale base cases/file cleanup pass with paired target receipts. Forty view/queue replies retain exact assertions and p95s25.451/21.264ms excluding setup;5s default unchanged. C1/C2 verified. Retain failed978f03e9/A-23177 and A-23180 with its8.296s/5s outcome and partial positives; this new-head pass does not reclassify it. T0/T1/all-fallback-T2/7 selected T3/Web exit0; selected T3 once, other T3 batch/integrated evidence, T4 unexecuted. Linux x64 droplet c-8 fra1 Node24.21/Neovim0.12.5, two workers, Chrome for Testing156.0.8078.4 Headless Shell1248 for Web;one prerequisite skip, cache unknown, advisory budgets/report-only suggestions retained. A-23235: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23235-t-2010-final-review-clear-at-4dfe7003f.md. No Reviewer execution or further run.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T05:38:03.326Z

Merged b653afb17ed4d598627efbe4d7408a1d5354bb1b onto dev.
