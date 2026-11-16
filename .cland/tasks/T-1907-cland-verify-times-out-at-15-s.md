---
id: T-1907
kind: task
title: cland verify times out at 15 s ("submission sent; no reply") while the hub admits the run, three times in a row on 2026-11-16
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1555
branch: t/T-1907-cland-verify-times-out-at-15-s
created: 2026-11-16T08:08:22.188Z
updated: 2026-11-16T13:56:48.830Z
---

## Summary

On 2026-11-16, three consecutive `cland verify` submissions from crew sessions exited 75 with `submission sent; no reply within 15s; check cland verify queue before resubmitting`:
- T-1879 (run a9f2ed5e, 07:45Z, during a hub slowdown);
- T-1697 (run 1270b05e, 08:04Z, with the Mac load at 4.7 and the hub at 4 % CPU);
- T-1889 (run d9ae394b, 08:07Z).

Each time the hub did admit exactly one run, which the queue showed later. The submission path apparently does something slow before it replies: bundling, a tree-hash computation, or the local host gate's start. The CLI bound is shorter than that work at a normal load. The outcome is safe, because nobody resubmitted, but every submitter has to reconcile by hand, and a less careful caller would double-submit.

## What to build

Find what the hub does between receiving a verify submission and replying. Reply with the admission (run id) as soon as the run is recorded, and do the slow work after the reply. Alternatively, give the CLI a bound that matches the measured submit path, with a named reason. Keep exit 75's safe wording for a real timeout.

## Acceptance criteria

- [x] C1. A verify submission on a quiet machine returns the run id within the CLI bound, with the slow step measured and named (test with a fake slow step).
  - done: impl-1907 · 2026-11-16T13:54:30.551Z
- [x] C2. A real timeout still reports "submission sent; check the queue" and never resubmits (test).
  - done: impl-1907 · 2026-11-16T13:47:40.977Z

## Comments

### impl-1907 · 2026-11-16T13:47:40.731Z

Rule 20 sweep: unchanged reply fields and persisted job schema; timing changes only. Production callers CLI suite.ts, spoke/spoke.ts, dispatch.ts, merge-batches.ts and dev-t3-probe.ts consume the same durable id. Neovim verification.lua and web sessions/verification.ts consume unchanged queue snapshots; ItemCard/explorer_card consume unchanged task receipts. Skill/help/docs updated. Suite policy fixture launch() now explicitly joins settled() for policy tests; raw public admission remains independently tested. Complete red/green + consumer disposition: A-20106 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20106-t-1907-admission-red-green-and-consumer-sweep.md).

Searched matching paths (includes incidental log/duration references; unchanged shapes leave these unaffected except edited regression/docs/fixture):
docs/hub/additive-interaction-selection-t-1454.md
shared/wire/index.ts
docs/hub/web-edge.md
hub/src/spoke/spoke.ts
hub/test/suite-soak-component.test.ts
hub/test/suite.test.ts
docs/agents/tests.md
hub/src/tool-arguments.ts
hub/test/durations.json
docs/hub/running.md
qa/briefs/T-230.md
hub/test/admission-exchange.ts
hub/test/durations.test.ts
hub/test/suite-admission-cost.test.ts
hub/src/hub/dispatch.ts
qa/briefs/E-614.md
hub/src/hub/web-authority.ts
hub/src/hub/dev-t3-probe.ts
hub/src/hub/merge-batches.ts
hub/src/host/host-authority.ts
qa/briefs/E-1539.md
hub/test/suite-human-component.test.ts
qa/briefs/E-1314.md
hub/test/remote-fixture.ts
qa/briefs/E-617.md
qa/briefs/E-420.md
hub/src/protocol.ts
docs/review-and-qa.md
hub/src/cli/suite.ts
hub/test/suite-admission-native.test.ts
docs/agents/tests/hub-test-executor-admission-lock.test.ts.md
hub/test/suite-preflight.test.ts
docs/agents/tests/hub-test-suite-admission-native.test.ts.md
hub/test/spoke-lazy-tools.test.ts
docs/agents/tests/hub-test-suite-soak-component.test.ts.md
docs/agents/tests/hub-test-suite-close-component.test.ts.md
hub/test/verification-workers.test.ts
hub/test/suite-admission-close.test.ts
hub/test/suite-dry-run.test.ts
hub/test/suite-task-selection.test.ts
hub/test/skip-reporter.ts
hub/test/host-flush.test.ts
hub/test/task-card-component.test.ts
hub/test/suite-duration-budget.test.ts
hub/test/suite-log-backfill.test.ts
hub/test/suite-cancel.test.ts
hub/test/durations.ts
hub/test/suite-protocol.test.ts
hub/test/verify-submission.test.ts
hub/test/fixtures/tracker-snapshot/items.json
hub/test/suite-component-fixture.ts
hub/test/suite-release-cache.test.ts
hub/test/tool-arguments.test.ts
hub/test/suite-admission.test.ts
hub/test/suite-admission-responsive.test.ts
hub/test/suite-queue-policy.test.ts
hub/test/daemon.test.ts
hub/test/executor-admission-lock.test.ts
hub/test/suite-command.test.ts
hub/test/web-authority-unit.test.ts
hub/test/executor-run-rules.test.ts
hub/test/executor-run.test.ts
hub/test/merge-batches.test.ts
hub/test/suite-unit-fixture.ts
hub/test/host-flush-native.test.ts
hub/test/scenarios/droplet-verify.test.ts
hub/test/verify-all.test.ts

Validation: macOS arm64 local Node 24.21.0; verify-submission 7/7, admission-responsive 4/4, scheduling 7/7; full root typecheck exit 0, whole-source test lint exit 0 with 0 refusals and existing report-only findings, closed-item wording 0 findings. No full verify yet; no browser/provider/actual worker execution. origin/dev 78393cf43 merged before first review.

### rev-35 · 2026-11-16T13:52:08.643Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1907-source-1
commit: 5270971efcb60fa021486dd671c22aaf59c17bcf
scope: full
findings: [{"severity":"medium","text":"SUITE_USAGE adds two lines but frozen cli-usage/commands.json is unchanged. Existing cli-usage-compatibility deepEqual therefore fails; literal comparison confirms the exact mismatch. Refresh only the changed block via existing fixture path and retain compatibility assertion. No exception/other owner (claimant confirmed).","file":"hub/src/cli/usage/suite.ts","line":2},{"severity":"medium","text":"C1 Promise.race uses unrelated UI hub.status round trips as if they establish CLI socket result delivery before advancing its fake deadline, and never joins the losing status/clock continuation. This is nondurable timing proof plus failure-path ownership gap (rules9/12, claimant confirmed). Arm the actual CLI reply/delivery observation with an owned bounded failure path, keep compatibility held and drain all admitted continuations.","file":"hub/test/verify-submission.test.ts","line":106}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source audit A-20113: Standards2medium/Spec0additional. Production persistence/dedupe before detached owned #check is otherwise consistent; close joins scheduler/launch/inspection work and reply fields remain unchanged. C2 withheld actual-frame/no-auto-retry behavior retained, done/unverified pending same-head evidence. A-20111 preserves67 original consumer paths/transcript/precommit/raw limits; its two object-tier cells independently resolve to T3 (suite-preflight and droplet-verify scenario), unexecuted. Local targeted/typecheck/lint observations are not immutable-head full verification. Hold released for consolidated correction/fresh source review; no dev merge absent rule11 authorization. No Reviewer runtime.

Criteria: C1 failed (New deadline test relies on unrelated socket round trips and leaves its losing continuation unjoined.).

### rev-35 · 2026-11-16T13:56:48.830Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1907-source-2
commit: 13fbcdcc18846f2d9e7a5ef21a02b55177a120bf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear A-20118: Standards0/Spec0. Only frozen SUITE_USAGE block changed; exact bytes match all40-block fixture. C1 observes prearmed CLI output/actual result consumption, separate barrier/output bounds, compatibility held through fake deadline, no unrelated UI race; finally releases/joins submission and owned hub shutdown/settle covers scheduler. Production unchanged: durable save/dedupe before detached tracked #check, failure posting/close join retained. A-20115 repaired candidate8/8/typecheck/lint and negative control remain qualified; recovered older scheduling5tests4pass1cancelled exit1 stays incomplete. A-20111 original67-path/unknown/native and tier corrections retained. No criteria verified before same-head configured receipt. Hold released, mode-free verify permitted at exact pin in authorized window; no full/all request or additional dev merge. No Reviewer runtime.
