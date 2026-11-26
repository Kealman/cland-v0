---
id: T-2000
kind: task
title: durations-runner.test.ts's existing cases still use the legacy fixture path without a pre-acquisition owner
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1787
branch: t/T-2000-durations-runner-test-ts-s-existing
created: 2026-11-19T06:48:58.122Z
updated: 2026-11-26T02:02:51.369Z
closed: 2026-11-26T02:02:51.369Z
---

## Summary

The existing cases in `hub/test/durations-runner.test.ts` still use the legacy `fixture()`/`run()` path, with no whole-caller owner registered before acquisition and no separately named setup bound. T-1575 moved only its new wrapper case onto `suiteCase`, as its reviewer asked (impl-1575, 2026-11-19).

## What to build

Move the file's remaining cases onto `suiteCase`, with a whole-caller owner registered before any acquisition and named setup and native-completion bounds. Every assertion keeps its meaning, and the file stays in its tier.

## Acceptance criteria

- [x] C1. Every case in durations-runner.test.ts runs through `suiteCase` with a pre-acquisition owner and named setup bounds, and all assertions are unchanged (test, diff review).
  - done: impl-2000 · 2026-11-25T13:35:41.555Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2000-final · 2026-11-26T00:39:36.951Z · commit 8275662e883766daaf0326c9d5ce5585319034a5
- [x] C2. A positively controlled launch guard and the cleanup census still pass for the whole file (test).
  - done: impl-2000 · 2026-11-25T13:35:41.760Z
  - verified: rev-40 [reviewer] · run rev-40-20261126-2000-final · 2026-11-26T00:39:36.951Z · commit 8275662e883766daaf0326c9d5ce5585319034a5

## Comments

### impl-2000 · 2026-11-25T13:14:51.388Z

Red before migration on Node 24.21.0/macOS: named fixture setup entered 0 times, expected 1. Guard-only regression green after migration. All outer cases now use suiteCase, fixture setup and native completion bounds; awaiting native and lint slots. Existing runner assertions/tier preserved.

### impl-2000 · 2026-11-25T13:16:33.816Z

Consumer census for approved additive suiteCase timeoutMs: direct tests durations-runner, durations, dev-t3-search, hosts-state, suite-soak-component, suite-selection-fetch, suite-bundle-native, suite-soak, suite-cover; flaky-receipt-fixture adds suite-stage-rules, executor-droplet-component and merge-batches (12 reachable test files total). Searched helper name and suiteCase across hub/nvim/web/docs/.agents; no protocol, persisted shape, QA brief or frozen help consumer. Only opt-in slow probe supplies timeoutMs; all other callers preserve absent-option defaults. Existing caseDeadlines consumer owns parsing/deadline semantics.

### rev-35 · 2026-11-25T13:27:33.876Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2000-source-1
commit: 0fdc269605bd440e5edc759f3ace120d2f08b116
scope: full
findings: [{"severity":"medium","text":"M1: fixture.start executes native execFile before scope.step checks admission. An admitted configuration continuation can resume after teardown and launch a child before completion-step admission rejects. No retained native-start late-continuation control/exclusion covers C1.","file":"hub/test/durations-runner.test.ts","line":48},{"severity":"medium","text":"M2: Child ownProcess cleanup is registered on the fixture proxy behind caseDeadlines' pending-work join, while native completion is pending work. No releaseOnClose early child-stop action/control breaks the case-close held-child join cycle. Normal/explicit SIGTERM/SIGKILL green receipts do not establish case-owner cancellation cleanup.","file":"hub/test/durations-runner.test.ts","line":49}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23427 consolidates both medium findings/one correction bar; implementer confirms retained-source gaps. Preserve all original assertions/ESRCH/root census, positive guard and named setup/body observations. Controls must own complete callbacks/held releases before acquisition. Shared timeoutMs extension reviewed as approved: only optional600s probe uses it, absent defaults unchanged; no additional finding. Local21/21/124+43/typecheck/lint evidence scoped, optional slow probe unexecuted. Hold released for correction; fresh source review before configured verification, with midnight/Coordinator budget window retained. Reviewer ran no tests/lint/probes/native/browser.

Criteria: C1 failed (M1: fence/admit before execFile's native effect and prove a post-close late configuration continuation performs zero launches.), C2 failed (M2: enroll captured child stop before native-completion join and prove case-close held completion drains/joins before roots/guards release.).

### impl-2000 · 2026-11-25T13:32:06.426Z

Review correction A-23427: exact runner fixture extracted into durations-runner-fixture.ts for fake-only T2 controls in case-deadlines.test.ts. M1 red native launch count 1 != 0, then green after pre-launch admission. M2 red early stop count 0 != 1, then green after captured ownProcess stop/abort release and native-close/completion join. Both have independent fallback holds and whole pre-acquisition stageCase supervision. Main T3 stays suiteCase; original assertions retained. Consumer search now: new helper has two direct test importers (durations-runner, case-deadlines); suiteCase closure totals 13 test files including case-deadlines. Shared scope extension sole timeout opt-in remains unchanged. No source merge after first review.

### rev-40 · 2026-11-25T13:36:57.837Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-2000-source2
commit: 8275662e883766daaf0326c9d5ce5585319034a5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-23435 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23435-t-2000-correction-source-clear-at-8275662e8.md). M1 resolved by admission before native effect, with held-configuration zero-launch red/green control. M2 resolved by early captured-owner stop/abort before original completion join, with withheld producer close, root/guard retention, and actual registered removal/restoration receipts. Original assertions and tier retained. Shared timeoutMs extension preserves absent defaults; only existing optional 600-second probe opts in. Local macOS Node24.21 evidence A-23434: native 21/21 once, changed T2 12/12, five importers 124/124, full typecheck/lint exit0; remaining consumer closure/configured Linux evidence and optional slow probe unexecuted. C1/C2 final verification marks pending exact-head configured receipt; human midnight UTC hold and Coordinator window remain in force. Reviewer ran no tests or edits.

### impl-2000 · 2026-11-26T00:39:05.845Z

Exact-head configured receipt c4e39aa8-e8b4-425c-b37d-077235e7ea83 / A-23503 passed at 8275662e883766daaf0326c9d5ce5585319034a5 (tree145e8494dbbe3760509b8f28d9a90884538b44ff), Linux x64 droplet c-8 nyc1 Node24.21.0, Chrome for Testing156.0.8078.4 headless-shell. T0/T1/all fallback T2/11 selected T3 files/Web exit0; other T3 deferred to merge batch, T4 not run. 7790 passed, 1 skipped (local macOS stage-selector prerequisite), no failures/cancellations. Inspected structured finish receipts: both runner-case close controls passed ordinarily plus five load repetitions each; acquisition launch-guard identity passed. Duration/Web-wall notices and skip-reason check are report-only. Droplet lifetime1716s/costUSD0.1192 are producer receipt values, not a test-duration claim. Reviewer received same-head result for final criteria settlement; no source change or resubmission.

### rev-40 · 2026-11-26T00:39:36.951Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261126-2000-final
commit: 8275662e883766daaf0326c9d5ce5585319034a5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified. A-23504 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23504-t-2000-final-clear-at-8275662e8.md). Exact source-reviewed head, canonical145e8494 executable match; configured c4e39aa8/A-23503 passed. All21 durations-runner named base receipts pass including positive acquisition guard and exact native reaping/root assertions; both corrective case-close controls have positive base and5/5 receipts. All13 shared-helper consumer files have explicit passing base identities. T0/T1/fallbackT2/11selectedT3/Web exit0, Linuxc8nyc1 workers2 Node24.21/Nvim0.12.5, HeadlessShell1248/CfT156, noncached,7790pass/1macOS-prerequisite skip/0fail. RemainingT3 deferred batch; T4 and optional600s slow probe unexecuted; Linux macOS-named controls do not claim Darwin branches, local A-23434 remains separate. Budgets/report suggestions advisory, no performance clearance. No findings, Reviewer edits or executions.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T02:02:51.369Z

Merged f72b000e9878adb1c4416d3c9d7e0fc8e2c32f98 onto dev.
