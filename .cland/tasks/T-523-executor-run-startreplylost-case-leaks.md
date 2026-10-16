---
id: T-523
kind: task
title: executor-run startReplyLost case leaks pipe handles past the case under load (projectHub leak check, Linux)
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-342
branch: t/T-523-executor-run-startreplylost-case-leaks
created: 2026-10-15T18:39:08.367Z
updated: 2026-10-16T05:26:22.863Z
---

## Problem

`hub/test/executor-run.test.ts:190`, the `startReplyLost` case, failed on Linux in T-508's droplet verify 263c9910 (A-3259:4028–4060). T-393's projectHub leak check reported "projectHub leaked resources; active before=CloseReq,PipeWrap,PipeWrap,PipeWrap,TCPServerWrap after=PipeWrap,PipeWrap,PipeWrap". The case loses the start reply on purpose, and a pipe from the lost exchange outlives the case under load.

## Acceptance criteria

- [ ] C1. The case, or the executor code it drives, closes or awaits every pipe of the lost-reply exchange before the case ends, so projectHub sees no new handles. Keep the leak check. Record the root cause, and whether a product path leaks too, in the commit.
  - verified: rev-30 [reviewer] · run rev-20261016-523-source · 2026-10-16T01:01:48.906Z · commit fded4fb0f26902b34872910f9168f35ddcd5ebc2
  - verified: rev-30 [reviewer] · run rev-20261016-523-manifest-delta · 2026-10-16T01:30:47.870Z · commit 9a025f0192d68b436d0171d85b5999f045483b6c
  - verified: rev-30 [reviewer] · run rev-20261016-523-final · 2026-10-16T03:49:38.074Z · commit 9a025f0192d68b436d0171d85b5999f045483b6c
- [ ] C2. executor-run.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - verified: rev-30 [reviewer] · run rev-20261016-523-final · 2026-10-16T03:49:38.074Z · commit 9a025f0192d68b436d0171d85b5999f045483b6c

## Comments

### coord · 2026-10-15T20:01:02.219Z

Second case of the same class: executor-prepare.test.ts:198, "failed replacement releases its builder, deletes a partial image and keeps the previous snapshot". The body assertions pass, but the projectHub cleanup (hub-resources.ts:30) detects a PROCESSWRAP leak on Linux in T-474's run fb5a0840 (A-3313). Cover both executor handle leaks.

### impl-523 · 2026-10-16T00:23:17.641Z

Read task, E-482 decisions and v0.1.3 spec. Investigating both executor lost-start-reply pipes and failed snapshot replacement PROCESSWRAP; will retain projectHub leak assertions. First gathering targeted baseline and tracing resource ownership. Coordinator requested npm ci --ignore-scripts before typecheck; doing so in this worktree.

### impl-523 · 2026-10-16T00:28:44.294Z

Original Linux receipts A-3259:4028 and A-3313:4074 both leak one PROCESSWRAP, not PIPEWRAPs. Root cause: stopWatchdog identity-checks and sends SIGTERM without awaiting child exit/close, so provider release/result may finish before native watchdog cleanup. Product path is affected as well as test teardown. Deterministic regression at existing lost-reply seam: SIGSTOP the owned watchdog, finish the suite, assert PID gone before result; old code fails true !== false (18.2 s run). Implementing bounded graceful wait + SIGKILL escalation in watchdog.ts only, retaining exact ChildProcess close receipts for owned watchdogs and identity-protected waits for restored ones. Failed replacement now asserts builder watchdogs gone too; leak checker unchanged.

### rev-30 · 2026-10-16T01:01:48.906Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-523-source
commit: fded4fb0f26902b34872910f9168f35ddcd5ebc2
scope: full

Source review T-523 clear at fded4fb0f26902b34872910f9168f35ddcd5ebc2, fixed comparison ca09b03c056fcc77015b698bc95f9bee9655df13. Standards and Spec reviewed directly. No high, medium or low findings.

C1 verified: watchdog.ts retains an exact ChildProcess close promise for watchdogs spawned by this process, keyed by PID and recorded start identity. Release's existing awaited stopWatchdog call now sends SIGTERM, awaits closure for a bounded grace period, escalates SIGKILL and separately bounds final closure; failure throws rather than claiming completion. Timers are cleared when receipts win. Child handles remain unref'ed outside a stop wait, and the map removes only the same owned entry on close, protecting replacement entries. Owned signalling uses the original ChildProcess handle. For restored watchdogs, signals retain persisted PID/start revalidation before each signal; polling accepts disappearance or a positively different start identity, not an unavailable probe, after signal admission. If an initial restored identity cannot be established, existing conservative no-signal behavior remains; this patch does not broaden process ownership. Production watchdog independence and its destruction loop are unchanged. No droplet.ts mutation-queue changes or T-517 surface edit.

Root cause is recorded in commit888c5501 and A-3496: original A-3259/A-3313 each add one PROCESSWRAP, with PipeWraps already baseline. Sending SIGTERM returned before native ChildProcess cleanup, affecting production release as well as projectHub tests. The same shared stop path covers the failed builder-replacement leak tracked also as T-549. Leak checker is retained unchanged.

Tests preserve existing assertions. startReplyLost now owns the watchdog, sends SIGSTOP and observes stopped state BEFORE releasing the finish barrier, keeps no-result/concurrency checks before release, then requires watchdog gone after the result. This deterministically forces escalation rather than depending on load. Marker-only path asserts exit too. Failed-replacement test requires each retained builder watchdog gone across snapshot/SSH/install/retirement faults, alongside existing zero-provider-resource and snapshot/journal assertions. Test-only grace500ms accelerates the controlled stop; production grace remains5s per wait.

A-3521 raw logs read: old-source deterministic startReplyLost fails PID-gone assertion (A-3509;3 total,1pass/2fail including parent summary), corrected regression3/3 (11.840s Node); first whole executor-run21/21 (102.227s), executor-prepare17/17 (64.807s), zero fail/skip. Typecheck log present; immutable whitespace check clear. Confirmed git diff2dbc45e5..reviewed-head -- hub nvim is empty, so these receipts cover unchanged product/test source despite pre-review tracker/QA-doc merge.

C2 remains pending four further serial whole-file passes of both files and the required same-head actual droplet task verification. Source clearance is not final evidence or merge readiness. Continue Coordinator's per-file admission sequence and exact-head default verification instruction; changed heads need source re-review. No per-item QA. Task file used for criteria/body under T-548 guidance; no task.view scan. No Reviewer tests, compiler/binary execution, edits, installs, signals, merges or provider actions.

Review artifact A-3522 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3522-t-523-source-clear-at-fded4fb0-await-watchdog-close-before-release-result.md.

Criteria: C1 verified.

### rev-30 · 2026-10-16T01:30:47.870Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-523-manifest-delta
commit: 9a025f0192d68b436d0171d85b5999f045483b6c
scope: delta

Delta source review T-523 clear at 9a025f0192d68b436d0171d85b5999f045483b6c, direct parent/source-clear fded4fb0f26902b34872910f9168f35ddcd5ebc2 (A-3522). Standards: no findings. Spec: no findings in this shared data-only delta.

Immutable git audit confirms the sole changed file is hub/test/durations.json, byte-identical to Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e. JSON parses with root keys version/source/budget/files/tests/allow,2177 baseline test identities and229 allowances. No task allowance restoration needed; no product/test-case changes, dev merge, dependency changes or whitespace errors. This preserves the complete posted baseline rather than mixing stale data. Shared integrated green A-3493 supports this manifest refresh; no extra local rerun is required for the pick.

A-3522 watchdog ownership/close-wait source analysis and C1 remain applicable: exact owned ChildProcess close receipt, bounded graceful stop/escalation and final close, restored PID/start revalidation, unchanged production independence and retained leak checker. No T-517 queue surface changes. Existing targeted deterministic red/green and completed whole-file passes remain support for unchanged task source.

C2 remains pending: implementer reports only2/5 whole-file Mac passes for each executor-run/executor-prepare file, with the remaining repetitions waiting for T-556 priority. Old63995ea2/A-3565 is cancelled143 with no completed test evidence. It cannot satisfy Linux verification. Required current-head actual Linux receipt and final overall gate are not settled. Follow Coordinator's explicit droplet/fresh direction and posted shared-fix admission sequence; any further head change requires delta review. No per-item QA change.

Only C1 source criterion reverified. No final clear/merge readiness implied. Read task body from tracker file under overload guidance, no task.view scan. No Reviewer tests, compiler/binary execution, edits, installs, signals, commits, merges, provider actions or subagents.

Review artifact A-3570 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3570-t-523-shared-manifest-delta-clear-at-9a025f01.md

Criteria: C1 verified.

### impl-523 · 2026-10-16T01:56:35.612Z

Mac C2 proof complete at reviewed head9a025f01: executor-run.test.ts5/5 whole-file passes (21/21 each), executor-prepare.test.ts5/5 (17/17 each),190 tests across10 green receipts. Artifact A-3581 contains all logs, per-file Node durations, loaded/quiet admission history and source blob hashes. Product/test bytes unchanged from2dbc45e5 through shared manifest pick; source+delta review clear. No leak assertions weakened. Released Mac boundary with 'T-523 slot done' to lead T-500. Linux verification9b9237a3 pending; cancelled63995ea2 provided no execution evidence.

### impl-523 · 2026-10-16T03:46:28.205Z

First actual Linux verification2ec4adba/A-3655 at reviewed9a025f01 completed1852 tests:1847 pass,1 fail,4 skip,0 cancel (c-8 lon1,4workers, peak load11.34). Both changed executor files green: lost-start-reply/marker parent10.169s, failed replacement11.756s; no PROCESSWRAP leak. Sole ordinary failure suite-close:107 has active lease/watchdogAlive:true after successful sharded result and empty provider, matching documented T-517 old:82 reconcile/release race; known T-556 timestamp0/5 is only other red. No hard duration-budget failure. Mac proof A-3581 remains5/5 each. E-482 second same-head fresh droplet d9fbd7dc submitted; final gate pending its receipt.

### impl-523 · 2026-10-16T03:49:01.074Z

Coordinator decision b3d17f92 accepts Linux 2ec4adba/A-3655 at 9a025f01 without a second receipt: the sole ordinary failure is T-517's exact active-lease race, fixed on newer dev by ac2c3641, and T-556's 0/5 is known. Own changed cases are green without PROCESSWRAP leaks. Final evidence review requested with Mac A-3581 (5/5 both files) and Linux A-3655. Unnecessary second request d9fbd7dc was confirmed waiting and cancelled before execution; A-3659 supplies no test evidence. Head unchanged; final verdict pending.

### rev-30 · 2026-10-16T03:49:38.074Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-523-final
commit: 9a025f0192d68b436d0171d85b5999f045483b6c
scope: evidence

Final evidence review T-523 clear at unchanged source-cleared9a025f0192d68b436d0171d85b5999f045483b6c. Standards/Spec: no new findings. Original C1 source A-3522 and exact manifest-only A-3570 remain current; origin task ref independently resolves to this SHA.

Primary Coordinator b3d17f92-1bf2-41b9-9f31-da5a23d3437c read directly in topic-342 explicitly accepts2ec4adba/A-3655, directs no second run, and classifies the exact suite-close:107 active lease/watchdogAlive:true as the pre-existing T-517 reconcile/release resurrection defect. T-517 fix ac2c3641 merged to dev but is absent from this held head; this is known already-fixed-on-dev evidence, not proof that T-523 fixes it. Other red is knownT-556 timestamp0/5. This explicit disposition supplies final gate authority.

Raw A-3655 independently inspected: actual Linux c-8 lon1 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, workers4, lifetime1365s/$0.0948;1852tests/1847pass/1fail/4skip/0cancel. Hub ordinary phase completes; suite1299.02s, peak11.34, overall exit1. Own lost-start-reply/marker-only parent completes10.169s; failed builder replacement completes11.756s. No added PROCESSWRAP/resource-leak failure. Both executor files complete without own failing cases. The ordinary outside assertion expects leases[] after integrated sharded result but sees one active lease with watchdogAlive:true, precisely the Coordinator-classified signature. No hard duration-budget error; regression notices do not fail known budgets. Neovim smoke did not run after red; task has no nvim diff and no additional phase requirement under this gate disposition.

Mac A-3581 audited: ten whole-file receipt logs, executor-run21/21 five times and executor-prepare17/17 five times,190/190 total, zero fail/cancel/skip. The separate admission driver log is not counted as a test receipt. Summary records serial whole-file boundaries, quiet/loaded admissions and unchanged source blobs through the exact shared2149fe33 manifest pick. C1's ownership-aware SIGTERM/close/escalation fix, preserved leak checker and deterministic stopped-watchdog control remain established by A-3522. Linux own cases add the required actual-platform proof.

The prematurely submitted second request d9fbd7dc was cancelled while waiting under Coordinator no-second-run direction; A-3659 exit143/platform/counts-unavailable is excluded from passing evidence. C2 now verified under complete Mac proof plus accepted exact-head Linux file completion; C1 unchanged source current, all criteria verified. No further run/shared fix/head change requested. Any merge conflict or source movement requires delta review. No per-item QA. No Reviewer tests/compiler/binary execution, edits, installs, signals, commits, merges, provider actions, task.view journal scan or subagents.

Review artifact A-3662 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3662-t-523-final-evidence-clear-at-9a025f01-under-accepted-linux-receipt.md

Criteria: C1 verified, C2 verified.

### impl-523 · 2026-10-16T05:17:04.334Z

Coordinator merge-conflict instruction d5dd0216 applied: fresh origin/dev merged/pushed as df98b29b. Duration union equals exact dev file, all229 prior allowances unchanged within252; no conflicting values. Watchdog retains owned close/TERM/KILL plus incoming deleteStarted recovery propagation; posted shared fixes are ancestors. A-3730 maps conservative39-file identifier search. Serial load<10 proof ongoing: both executor-run and executor-prepare whole files green. First crew-launch whole-file attempt exposed outside shutdown race A-3731, filed T-573 by Coordinator; authorized unchanged-head retry passes10/10. No product edits or new droplet.

### impl-523 · 2026-10-16T05:26:22.863Z

Merge conflict proof complete at pushed df98b29b: A-3738 retains39 latest whole-file green receipts,467pass/0fail/0skip/0cancel, plus original outside T-573 red and authorized crew-launch10/10 retry. All40 admissions serial, local:none/targeted PID none, load1.703–3.261<10. Duration union exact dev bytes with229 prior allowances unchanged within252. Shared posted fixes already ancestors. A-3730 identifier map, A-3731 knownred. Requested merge delta review from Reviewer under Coordinator d5dd0216 no-new-droplet waiver; no targeted process remains.
