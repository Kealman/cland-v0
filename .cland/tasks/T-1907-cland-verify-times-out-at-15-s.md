---
id: T-1907
kind: task
title: cland verify times out at 15 s ("submission sent; no reply") while the hub admits the run, three times in a row on 2026-11-16
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1555
branch: t/T-1907-cland-verify-times-out-at-15-s
created: 2026-11-16T08:08:22.188Z
updated: 2026-11-16T14:55:24.691Z
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

- [ ] C1. A verify submission on a quiet machine returns the run id within the CLI bound, with the slow step measured and named (test with a fake slow step).
  - failed: rev-36 [reviewer] · 2026-11-16T14:55:24.690Z · note Configured T2 hangs in an existing accounting consumer because detached admission ends its scripted clock driver before scheduler settlement.
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

### rev-35 · 2026-11-16T14:14:04.281Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1907-evidence-1
commit: 13fbcdcc18846f2d9e7a5ef21a02b55177a120bf
scope: evidence
findings: [{"severity":"medium","text":"New unconditional launch()→suites.settled() joins provider launchWork before returning admission. Both suite-remote-budget held-acquisition cases await launch before releasing beforeCreate, producing a deterministic circular wait. A-20135 ordinary cases timedOut/cancelled ~120s and file failed. Coordinator b42edc99 assigns this regression to T-1907; audit admission consumers and use explicit suitable scheduler receipts/joins, preserve held-gate ownership and add fixture-contract regression.","file":"hub/test/suite-unit-fixture.ts","line":147}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20138 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20138-t-1907-failed-configured-evidence-and-fixture-deadlock.md independently accounts A-20135: 1714 ordinary passes/2 cancelled;221 file passes/1 fail, separate210load passes/files. T0 pass;T1 exit1;T2/Web unexecuted;T3 deferred,no T4 claim. Exact head/normalized tree/platform checked;browser null. Prior source clear missed the fixture contract defect and cannot establish readiness. C1 failed;C2 done but unverified. Report-mode advisories are separate. Complete failed-evidence pass; hold released for Coordinator-authorized correction and fresh source request, no Reviewer retry authorization.

Criteria: C1 failed (Configured T1 fails due changed admission-policy fixture deadlock; CLI responsiveness T2 did not execute.).

### impl-1907 · 2026-11-16T14:22:08.649Z

Failed run b540c497 preserved (A-20135/A-20138): T1 1714 ordinary pass/2 cancelled,221 file pass/1failure; separate210loadpasses; T2/Web unexecuted. Not shared; fixture regression repaired per Coordinator b42edc99. Complete expanded rule20 inventory/disposition (102 normalized direct/fixture-family paths +89skill/QA references) and reproduction/fullfile receipts: A-20158 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20158-t-1907-scheduler-consumer-repair-and-full-file-evidence.md. Production dispatch/batch/fileJob/devT3/periodic callers consume durable id or later reported/outcome receipt, unchanged. Unit fixture now exposes admit() versus explicit settled launch(); held-provider ETA and cleanup use admit plus entered/release receipts. Component fixture consumes results/settle joins; native suite fixture uses workerPid/lifecyclePid; remote fixture uses machine/report receipts; close-component moved three queue/notice reads after actual starts, and drives reservation owner via verificationSettled rather than completed submission. Direct suite.test/queue-policy/host-flush-native use pid/report/delivered/queued snapshot receipts; dry runs have no detached scheduler. No additional production contract change.

Fixture contract mutation red: adding settled to admit fails admission receipt within500ms. Fullfile repair greens: remote-budget19/19+scheduling7/7 combined26/26; suite-close-component14/14. Precommit local macOS arm64 Node24.21.0 scripted fakes/scratch Git; no browser/provider/harness/network. Earlier component attempt13pass/1cancelled and bounded localETA cancellation preserved incomplete. Fresh hub typecheck and whole-source test lint completed exit0,0refusals/122existing report-only findings; closed-wording0. Artifact drafting pending lint is now completed. No additional dev merge; new source review before any verify.

### rev-36 · 2026-11-16T14:25:37.797Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1907-source-3
commit: 49ce79d257c1b81674fa69e9236806f81051106c
scope: full
findings: [{"severity":"medium","text":"New admission control's success-only derived pending lacks immediate rejection observation during until; finally await pending can skip explicit settled join. Same task C1 verify-submission.test.ts:110 has raw f.submit() with the same gap. Original tracked admission observer does not own derived rejection. Claimant a7312594/653f3e41 confirms both. Observe success/error immediately, retain error as assertion cause, and unconditionally join scheduler after release via nested finally.","file":"hub/test/suite-remote-budget.test.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

Completed full consolidated source pass; one shared Standards medium at two admission proofs, no additional production/spec finding. Prior held-provider circular wait resolved by admit/settled split; component reads follow start receipts and cancellation drives reservation completion. Expanded production/fixture consumer sweep checked; original102+89/67 and raw/precommit/native deferrals retained. Candidate full-file greens remain separate from failed A-20135 (T1 cancellations, T2/Web unexecuted). C2 unverified. Source pin released for consolidated error-observer/always-join fix; fresh source review before new verification. No Reviewer runtime.

Criteria: C1 failed (Admission proofs leave rejection unobserved during bounded observations and can skip explicit scheduler join on rejection.).

### rev-36 · 2026-11-16T14:31:47.972Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1907-source-4
commit: 5b2763e8df8aa17f6321a0e599c14e061bc96618
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Correction from49ce79d resolves A-20163 at both proofs: immediate success/error outcomes consume rejection, original error explicitly rethrown, nested finally always joins scheduler after gate release. CLI setup still requires genuine compatibility entry or early error; stdout/deadline/durable-id/frame assertions intact. Production/consumer sweep unchanged; no new finding. Reported precommit26/26/full typecheck/lint green retain capture limits; old failed A-20135 remains failed. C1/C2 await exact-head configured result. Source clear, hold released for authorized mode-free verify/window. Full source note just published; no Reviewer runtime.

### rev-36 · 2026-11-16T14:55:24.691Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1907-evidence-2
commit: 5b2763e8df8aa17f6321a0e599c14e061bc96618
scope: evidence
findings: [{"severity":"medium","text":"launch() awaits suites.settled outside machine.waits.run after admit returns; accounting=true tracked failed acquire cleanup needs FakeClock retry advances, but no driver remains. Existing suite-accounting unconfirmed cleanup test awaits launch before starting its driver and cancels at240s (A-20184:30110; filefail30113). Claimant confirms no advancing owner. Coordinatorbaf8e722 requires restoring awaited in-process #check and moving early admission to socket/RPC only, reverting fixture adaptations and full-file accounting/remote-budget/close-component proofs.","file":"hub/test/suite-unit-fixture.ts","line":154}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed-evidence complete; A-20188 actual ledger and new note. Preceding source clearance missed this clock-driver path.5681ordinary testpass/1cancelled;604filepass/1fail;225separate load passes/files. CLI7cases/file, including C1/C2, are positive but whole run not clear. Manifest989:604pass,1fail,44T2+55Webunexecuted,285T3/T4deferred. T0/T1green,T2exit1,Webnotrun; browsernull/uncached LinuxNode24.21 confirmed. Report-only diagnostics separate. No shared defect or retry authorization; hold released for Coordinator redesign and fresh source/fullfiles/new verify. No Reviewer runtime.

Criteria: C1 failed (Configured T2 hangs in an existing accounting consumer because detached admission ends its scripted clock driver before scheduler settlement.).
