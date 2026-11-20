---
id: T-2032
kind: task
title: remote-scripted 'scripted machines report red, lost and slow runs without a worker' hangs to the 120 s timeout under macOS suite load (passes 5/5 alone)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: topic-1677
branch: t/T-2032-remote-scripted-scripted-machines-report
created: 2026-11-20T10:56:29.594Z
updated: 2026-11-20T13:01:40.722Z
closed: 2026-11-20T13:01:40.722Z
---

## Summary

The macOS stage cover 520ec02d at dev 78ea6dce2 (log A-22146) failed at T2 with one cancelled test: `hub/test/remote-scripted.test.ts::scripted machines report red, lost and slow runs without a worker` hung to the 120 s test timeout (baseline 0.2 s). The case passed 5/5 alone on the same machine right after, at 1–2 s each. It is an intermittent hang under suite load.

## What to build

Find what the case waits on when it hangs (a scripted machine event, a timer, or a settlement that never arrives under load), and make the wait settle or fail with a named diagnostic well inside the case budget. Keep the assertions.

## Acceptance criteria

- [x] C1. The hang is reproduced or its waiting point is named from evidence, and the case fails with a named diagnostic instead of hitting the 120 s timeout (test).
  - done: impl-2032 · 2026-11-20T11:43:53.741Z
  - verified: rev-35 [reviewer] · run rev-35-2032-evidence-1 · 2026-11-20T12:22:44.489Z · commit 275b0938e44e3ed66852982ba19d5429b5b71e36
- [x] C2. The case passes 5/5 under the two-worker load gate on macOS (test).
  - done: impl-2032 · 2026-11-20T11:15:20.128Z
  - verified: rev-35 [reviewer] · run rev-35-2032-evidence-1 · 2026-11-20T12:22:44.489Z · commit 275b0938e44e3ed66852982ba19d5429b5b71e36

## Comments

### coord · 2026-11-20T11:09:37.690Z

Upgraded to a dev defect on macOS. It hung to 120 s in BOTH macOS stage covers at tree 119d3836 (520ec02d/A-22146 and 84fc4976/A-22147, after a 5/5 pass alone). It passed in the macOS cover e065588f/A-22117 at 3d2de496f (tree 177353dd, 0.62 s) and in today's Linux runs (A-22142, A-22135). The only product-tree change between 177353dd and 119d3836 is T-2030's hub/test/durations.json allowance, which changes T2 scheduling and order. So suspect an order- or co-scheduling-dependent interaction on macOS (shared env, port, temp path, timer or fake clock), not the allowance itself. This item now blocks the stage covers that close five epic stages.

### impl-2032 · 2026-11-20T11:13:59.992Z

Diagnosis: unchanged macOS two-worker pair remote-scripted + remote-cli cancels exact case at 15 s (29/30 pass). Instrumented stack pins acquire(red) → reserveSpend → locked → acquireLockWithRetry → lockWait → injected wait(25). Fixture startup sweep shares the sealed ledger; direct acquire lacked a fake-clock driver. All A-22146/A-22147/A-22117 had remote-cli token-rotation neighbour, so timing rather than different neighbour. Named-deadline mutation check without drive now fails at 5 s: 'scripted machines report red, lost and slow runs without a worker: red: acquire: deadline exceeded after 5000 ms', no cancellation; restored drive passes 30/30. Final load proof and artifact pending.

### rev-35 · 2026-11-20T11:20:50.195Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2032-source-1
commit: 61b4b2fa5a0ecb9a065a6b99e813da3e03a61646
scope: full
findings: [{"severity":"medium","text":"M1: the newly migrated callback supplies no positive resource-close fence to guardedLeaseCase. Its afterCleanup can restore launch guards/seams after fixture/hub/API cleanup rejects because drainFixtureWork observes settled work, not successful closure; adoptRoot joins only the original callback. Retain resource/root/seam ownership through rejected cleanup and prove repair through the registered owner.","file":"hub/test/remote-scripted.test.ts","line":72},{"severity":"medium","text":"M2: fixture(scope.fixtures) reaches projectHub/serveProject Tracker and Store construction without pre-owned openDatabase capture. A native database opened before constructor rejection is absent from returned-owner cleanup; initial stop callbacks may still be no-ops. Use the established injectable acquisition owner and a constructor-rejection/confirmed-close control for this migrated fixture caller.","file":"hub/test/remote-scripted.test.ts","line":74}]
finding_counts: {"high":0,"medium":2,"low":0}

Source1 not clear at61b4b2fa5a0ecb9a065a6b99e813da3e03a61646/tree14d2f306; A-22150 records Standards/Spec, two medium findings/no lows. M1: guardedLeaseCase has no supplied positive resource-close fence before restoring native guard/seams after rejected fixture/hub/API cleanup. M2: fixture/projectHub startup lacks pre-owned injectable native DB capture for Tracker/Store constructor rejection. Primary8a53892b confirms both/no exclusion. Clock driver/named five-second waits correctly address acquire -> reserveSpend -> lockWait(25), and all outcome/log-offset/release assertions remain. Retained diagnostic.log literal: 'scripted machines report red, lost and slow runs without a worker: red: acquire: deadline exceeded after 5000 ms';29pass/1fail/0cancelled. A-22149 local Mac two-worker production receipts independently pair42IDs:base neighbour pair30/30 plus exact identity5/5,0fail/cancel. Clock15/15; fulltypecheck/lint0 reported,0refusals/764report-only. These are scoped candidate-source local receipts, not configured verification or exceptional cleanup proof; missing native/invocation-tree metadata stays unknown. C1 failed, C2 done/unverified, no verification marks. Hold released for one consolidated ownership correction/fresh source before configured verify. Preserve driver/final assertions/old reds. No Reviewer runtime/edit/check/probe.

Criteria: C1 failed (M1/M2: the newly owned fixture restores native seams after rejected resource cleanup without positive closure, and does not capture Tracker/Store native databases before constructor rejection.).

### impl-2032 · 2026-11-20T11:30:16.402Z

Source1 corrections M1/M2: scriptedCase now reuses stageCase plus fenceFixtureCleanup on the real registered resource owner; failed cleanup retains roots/native guard/seams and retries the same owner. Remote fixture adds optional openDatabase forwarding; injected handles are captured before Tracker/Store schema initialization and fallback closure follows registered hub stop before root removal. Controls exercise actual registered resource rejection and both constructor/native-close rejections; all4 outcome/ownership targeted cases pass. Mutation controls red: without fence root stat ENOENT; without DB fallback both constructor controls miss expected close rejection. Coordinator extended scope after natural cap384 timeout; held-ledger cap reproduction reaches identical reserveSpend→lockWait25 stack and cancels at8s. Cap384 now forces that retry before semantic start, and all caps/orchestration drive semantic start/report, retaining original assertions. All8 file cases pass. Historical uninstrumented orchestration timeout in probe5 retained separately; all5 original identities now being load-gated 5x each.

### impl-2032 · 2026-11-20T11:30:52.424Z

Consumer search for additive test-fixture openDatabase seam: inspected all remote-fixture.ts imports/references across hub/test, nvim/test, web/test, .agents, qa and docs, plus openDatabase production forwarding. Consumers: suite-soak-component, demo-release, executor-deletion-confirmation, suite-selection, remote-fixture-parent, demo-provisioning, demo-cap, executor-snapshot-confirmation, executor-run, executor-prepare-retry, suite-hung-component, scenarios/droplet-verify, executor-deletion-watchdog, remote-cleanup, suite-close, executor-safety-case, executor-admission-lock, suite-candidate-remote, suite-remote-process, state-inventory, remote-scripted, suite-close-recovery, executor-health, demo, dev-t3-search-component, close-run-fixture, executor-safety, executor-safety-component, demo-release-component, executor-reap-confirmation, demo-start, verification-workers; qa/briefs/E-1533-stage-1.md and tiers manifest references. Only remote-scripted opts into the new optional seam. Others pass no openDatabase and retain exactly the previous fixture path. Existing ProjectHubOptions native seam is forwarded rather than redefined; no production/wire/default/help or frozen-byte contract changes.

### rev-35 · 2026-11-20T11:39:44.681Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2032-source-2
commit: 5d41979e3974e74aaa4d1391e7c0ce9bf0c86969
scope: full
findings: [{"severity":"medium","text":"M3: scriptedCase registers its fenced fixture drain first, including directory removal; later scope.fixtures.after closers for the direct executor (:107) and held ledger (:23) become later stage required receipts. releaseOnClose starts but discards their promises, so failure-path disposal can precede confirmed executor closure/ledger release. Put both resources in the positive pre-directory resource phase and exercise held/rejected closure through the actual owner.","file":"hub/test/remote-scripted.test.ts","line":107}]
finding_counts: {"high":0,"medium":1,"low":0}

Source2 not clear at5d41979e3974e74aaa4d1391e7c0ce9bf0c86969/tree7c0af22c; A-22152 records Standards/Spec. One medium M3/no lows: fixture fenced drain is first stage required receipt and includes directory disposal, while later scope.fixtures.after calls put direct executor close and held-ledger release after it. Early releaseOnClose discards promises;9a0d8647/a4afd31d confirm no other positive pre-directory receipt/exclusion. Original M1/M2 fixture fences/pre-constructor DB slots are present, with actual rejected resource and Tracker/Store/native-close repair controls. Coordinator82c9bc57 authorized cap384 expansion; same held-ledger wait is evidenced, all original assertions preserved, all5 semantic cases use drive. A-22151 counters independently audited:85pairedIDs,base33/33+2files; each5originalidentities base1+load5 (25repeats/25files);3ownershipcontrols base only. Mutation fence1red/DB2red, restored file8pass; fixture contracts22pass; fulltypecheck/lint0 reported,0refusals/764report-only. Canceled diagnostic/probe epochs retained as red/partial. Scoped local Mac evidence, not configured execution or M3 proof. C1failed,C2done/unverified; no verified marks, hold released for one consolidated positive pre-directory ordering fix/fresh source. No Reviewer runtime/edit/check/probe.

Criteria: C1 failed (M3: the direct executor and held-ledger positive close/release receipts are registered after the fenced drain can remove roots; early releaseOnClose promises are discarded.).

### rev-35 · 2026-11-20T11:48:13.383Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2032-source-3
commit: 275b0938e44e3ed66852982ba19d5429b5b71e36
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at275b0938e44e3ed66852982ba19d5429b5b71e36/tree409033cc; no findings/lows. A-22154 records Standards/Spec. M3 fixed for direct executor/ledger: ownResource joins the retained early attempt in fenced resource phase before hubs/directories, observes rejection before clearing for same-owner retry and does not cache absent acquisition as positive closure. Actual held/rejected executor/ledger controls fail2/2 with old late registration, then preserve roots/guard and confirm native completion/removal/restoration when fixed. M1/M2 registered fixture fence/pre-constructor DB capture intact. Driver/named bounds/all outcome/cap/cache/log/release assertions retained; no production/default/budget/dependency changes. A-22153 local Mac receipts audited:87pairedIDs,base35/35+2files,each5originalidentities1+5passes (25loadedtests/files);5ownershipcontrols base only. File10/10;contracts22/22;fulltypecheck/lint0 reported,0refusals/764report-only. Historical reds/cancelled/mutation epochs stay separate; no invocation/native metadata invented. C1/C2done/unverified, no verified marks. Hold released for exact-head configured verification in Coordinator window; final evidence settlement pending actual producer facts, no ready/merge claim. No Reviewer runtime/edit/check/probe/submission.

### rev-35 · 2026-11-20T12:22:44.489Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2032-evidence-1
commit: 275b0938e44e3ed66852982ba19d5429b5b71e36
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; no findings/lows. A-22158 audits producing3213c8a9/A-22156 at275b0938e44e3ed66852982ba19d5429b5b71e36; task.view passed. C1: retained named ledger/fake-clock diagnosis/5s no-driver red, current bounded driver and all10scripted generated-case passes, including held-ledgercap384; each5ownership controls has base1+5Linux load passes with final closure/root/guard assertions. C2: exact original identity5/5Mac at source3 inA-22153, all5originalidentities1+5 and basepair35/35; configuredLinux has original5base only, no extra repetitions inferred. Counts7924pairedIDs;7140basepass+734filepass, separately25loadedtest/filepass,0fail/cancel/skip/todo. All237T1/441T2/55Web plus selectedT4executor-safety-load complete andT0hostgate passed;272T3deferred/17otherT4unexecuted. SelectedT4baseparent+lanes10iterations passed once, noT4load reps. Provenanceexacthead/canonicala8bd4b7b distinctGit409033cc, Linuxc8sfo2 Node24.21/Nvim0.12.5, Headless1248/Chrome156,cached:null; accountingnotwall/advisoriesreport-only. Prior red/partial/epoch limits retained. C1/C2verified,holdreleased; no Reviewer edits/runtime/checks/probes/submission.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T13:01:40.722Z

Merged a4ab89552ee6ceb7c46f93407827be78b2b0cf6b onto dev.
