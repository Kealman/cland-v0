---
id: T-1655
kind: task
title: host-allow-list 'immediate merge revokes every host lease' runs 5.1–6.7 s on macOS against its 5 s budget
state: open
status: ready
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1597
topic: topic-1684
branch: t/T-1655-host-allow-list-immediate-merge-revokes
created: 2026-11-03T05:03:24.374Z
updated: 2026-11-20T18:15:25.571Z
---

## Summary

`hub/test/host-allow-list.test.ts` :: "immediate merge revokes every host lease before landing the task" exceeds its 5 s per-test budget on macOS: 6.678 s in the E-1536 stage-4 macOS cover (A-16171) and 5.117 s in impl-1654's local run (load 4.88). Budgets are report-only today, but this case would fail once enforcement returns (T-931).

## What to build

Find what dominates the case's time on macOS (a real merge, process spawns, lock waits) and cut it so the case stays under its budget on macOS with headroom, or move it to the tier and budget its cost justifies. Record the choice.

## Acceptance criteria

- [x] C1. The case runs under its budget with at least 30% headroom in five local macOS repetitions under ordinary load, or sits in a tier whose budget it meets, with the reason recorded (test).
  - done: impl-1655 · 2026-11-20T17:46:13.504Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1655-final · 2026-11-20T18:15:25.009Z · commit 6ad08b886c25cf658cf00abbe958e5378177517c

## Comments

### impl-1655 · 2026-11-20T17:37:50.661Z

Inspection: existing T3 native hook/socket lifecycle header retained; docs and durations manifest now give T3 10 s rather than ticket-era 5 s. Baseline 6.678/5.117 s historical receipts exceed original 5 s target. Proposed optimization stays at existing immediate-merge public seam, replacing unnecessary CLI launches where socket requests suffice; native merge and denied push assertions retained. Awaiting native slot for baseline.

### impl-1655 · 2026-11-20T17:46:29.317Z

Implementation head6ad08b886 pushed; source review assigned to Reviewer. Removed3 unnecessary CLI startups; retained native merge/socket proof. Coordinator-directed allowance10.017s uses quiet/historical worst6.678s rather than crew-load timings. Evidence A-22190 records exact sample/load pairs and earlier quiet-cover heads; busy samples are explicitly not budget passes. Full local changed T3 file12/12, T1 duration controls28/28, full test:lint/typecheck exit0. Awaiting source verdict before verify-window request.

### rev-40 · 2026-11-20T17:47:10.276Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-source
commit: 6ad08b886c25cf658cf00abbe958e5378177517c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; standards and spec have no findings. Existing public socket path replaces three CLI startups, retaining two native commits, merge identity, durable empty lease list and denied host push. Coordinator decision 7d13a9a6 independently confirmed; dated allowance follows historical/quiet sizing as directed. Checked all five cited historical generated-case suite timing receipts. C1 remains unverified/run-dependent: busy local samples are functional passes only and include over-budget timings. Historical covers do not prove this head. Await ordinary cland verify including changed T3 file at 6ad08b886c25cf658cf00abbe958e5378177517c before final evidence verdict. Reviewer ran no tests or browser; A-22190 is partial local macOS arm64 Node24.21.0 evidence.

### impl-1655 · 2026-11-20T18:14:52.965Z

Same-head verify0b3be164 passed at6ad08b886; A-22206. Exact merge-case timing1.754324867s outcome pass on Linuxx64 droplet c-8 ams3 Node24.21.0. All7139 pass,0 fail/skips; T0,T1,fallbackallT2,changedT3(one execution12/12),Web completed; remainingT3 in batch,T4 unexecuted. Web Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. Duration policy report-only. Reviewer notified for final C1 settlement; no source change.

### rev-40 · 2026-11-20T18:15:25.009Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1655-final
commit: 6ad08b886c25cf658cf00abbe958e5378177517c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Exact-head run0b3be164-c6ef-4703-84c6-61aa41f23fbd passed, independently inspected A-22206 producer timing and provenance; branch remains6ad08b886c25cf658cf00abbe958e5378177517c, tree3a61f308bb348350d5fcdcff9bd7f7527c7e0ad7. C1 satisfied via documented T3 tier/budget alternative: exact generated immediate-merge identity pass1.754324867s, below10s T3 default and10.017s dated allowance; changed file12/12 in one base execution, no repetitions. This is Linux evidence, not five ordinary-load macOS passes or a speedup claim; earlier busy macOS overages remain disclosed in A-22190. Configured T0/T1/fallback-all-T2/changed-T3/Web exit0;7139 pass,0 failed/cancelled/skipped; remainingT3 deferred to batch, T4 unexecuted. Report-only budget advisories do not establish enforced budget compliance elsewhere. Executor droplet c-8 ams3 Linuxx64 6.8.0-149-generic, Node24.21.0, workers2; Web binary chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. No cache reuse. Existing source review has no findings; no new source changes. Reviewer ran no tests/browser.

Criteria: C1 verified.
