---
id: T-797
kind: task
title: 'executor-safety-component: "two protocol projects reserve against one cap…" times out waiting for the remote result (30 s) on a droplet'
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-513
branch: t/T-797-executor-safety-component-two-protocol
created: 2026-10-18T10:16:24.882Z
updated: 2026-10-18T14:55:41.625Z
---

## Summary

hub/test/executor-safety-component.test.ts, "two protocol projects reserve against one cap and confirmed release replaces the reservation", failed in T-710's droplet verify bc1cf31c (A-5185, Linux c-8, Node 24.21.0) with "remote result: not within 30000 ms". On the Mac it passed 6/6 alone under Node 24.21.0, both at T-710's head 0b70662f and at dev 1a20fb92, at 0.4–1.1 s per case. A first local attempt under Node 25.6.1 reproduced the timeout. It has not failed in the other ~60 recent droplet logs. A wall-clock 30 s wait on a remote result in a T2 component test suggests a lost wake-up or an ordering race between the two projects' reservations.

## Acceptance criteria

- [x] C1. The root cause is named. The Node 25.6.1 reproduction is the first lead: run the file under Node 25 to get a deterministic repro if possible.
  - done: impl-797 · 2026-10-18T14:45:37.617Z
  - verified: rev-31 [reviewer] · run rev-20261018-797-source-2 · 2026-10-18T14:55:41.625Z · commit d2c62d803b01a6151acd1d71929cd05e502b02b6
- [x] C2. The test waits on an observed event or FakeClock step instead of a 30 s wall-clock deadline, keeping every assertion, and passes 20/20 under both Node 24 and 25.
  - done: impl-797 · 2026-10-18T14:54:17.849Z

## Comments

### impl-797 · 2026-10-18T14:29:40.927Z

Initial read: recorded droplet symptom confirmed in A-5185 (remote result: not within 30000 ms). Node 24.21.0 and Node 25.6.1 are installed. No local tests run while cover-quiet holds. Baseline git fetch origin, npm run test:lint and npm run typecheck passed; task branch initially matches origin/dev. Reproduction/diagnosis loop resumes after the Coordinator posts cover-quiet lifted.

### impl-797 · 2026-10-18T14:43:27.011Z

Cause confirmed: after the last FakeClock advance, the scheduler can consume an older unconfirmed release receipt while an executor sweep has already confirmed deletion. It records an accounting retry but no executor delay remains; drive() cannot tick the scheduler, so the report waits 30 real seconds on a frozen clock. A-5349 reproduces the original failure on Node 25 run 10; A-5352/A-5354 force this ordering, A-5355 shows it green after the clock-step fix. Both report waits now step FakeClock until observing their topic message; all eleven assertions retained. Final dual-version whole-file 20/20 repetitions are running. Post-change lint/typecheck passed.

### rev-31 · 2026-10-18T14:47:20.053Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-797-source-1
commit: 3790745348c140f70ff8ef5322102d0d55cf8dbd
scope: full
findings: [{"severity":"medium","text":"Each topic-history miss admits another shared-clock second without a scheduler completion barrier, allowing pending I/O to consume live run timeout/lifetime.","file":"hub/test/executor-safety-component.test.ts","line":215}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-797 source review

Commit: 3790745348c140f70ff8ef5322102d0d55cf8dbd
Fixed base: 2a3aa788d8fa47f2c6c4f688e9e822f84dcfd1b9
Run: rev-20261018-797-source-1
Scope: full
Result: not clear

Reviewed the one-file diff, remoteWaits/drive, FakeClock advance semantics, remote fixture messages/result and task C1/C2. No Reviewer tests or edits.

## Standards
No additional finding. T2 scope is retained, with scripted machines and no added production changes, processes or literal elapsed-time sleeps. All eleven reservation/fallback/accounting assertions remain. The test's product-delay driver deliberately freezes time during pending I/O; the new helper's distinct problem is below.

## Spec
Medium M1 — hub/test/executor-safety-component.test.ts:215 (C2): scriptedResult advances the shared FakeClock one second after every topic-history miss without observing completion of the previous scheduler inspection/release/report work. A topic read does not join that asynchronous work. Thus a held persistence/provider/report operation can cause repeated scheduler steps while real I/O is still pending. The clock also belongs to the first slow run during the second project's fallback report; repeated misses can consume its five-minute run-timeout or fifteen-minute lifetime before the test intentionally completes it, replacing the diagnosed frozen-clock stall with a load-dependent deadline failure.

The Implementer confirms no scheduler-completion observation exists (441df53a-109f-4d46-b69f-7c7871e3c115). Add a held-I/O control and admit subsequent steps only after an explicit completion receipt (the existing Suites.settled seam was proposed), keeping time frozen during pending work. Retain pre-release reservation assertions and all result/accounting checks. A new head needs fresh source review before verification.

C1's diagnosis is supported by A-5359 and controlled probe A-5354: an old unconfirmed release result can be consumed after a concurrent sweep confirms deletion, leaving an accounting retry behind the final clock advance with no pending executor delay for drive() to advance. Original Node25 timeout is retained as A-5349; forced ordering red and green are A-5352/A-5355. The helper addresses that original stall but does not yet provide the required deterministic ordering for its repeated advances.

A-5367/A-5368 report twenty complete serial file passes on each Node 24.21.0 and 25.6.1, target forty passes, with host lint/typecheck green. Those passes do not exercise held-I/O deadline consumption and do not resolve M1. C2 fails the replacement wait's synchronization guarantee. C1 remains unverified for final settlement; no task verification authorized at this head. No per-item QA.

Standards: zero additional findings. Spec: one medium finding.

Artifact A-5372.

Criteria: C2 failed (Result polling advances shared FakeClock without observing prior scheduler completion, so held I/O can consume the other live run's deadlines.).

### impl-797 · 2026-10-18T14:54:17.833Z

Source M1 addressed at d2c62d803b01a6151acd1d71929cd05e502b02b6: helper drains scheduler + executor sweep completion on both shared hubs before/after each tick; repeats completion pass if a product delay advanced their shared clock. Observation-only Dispatcher.verificationSettled is exposed through projectHub/remote fixture. New held-worker-receipt T2 control proves pending I/O freezes time, no premature report, and completion/report after release; removing joins fails deterministically (A-5373), restored green A-5374. Final whole-file serial20/20 each Node24.21.0/25.6.1 A-5376/A-5377; target40/40 at0.436–0.750s, held control40/40 at0.120–0.184s. Lint/typecheck green A-5378/A-5379. All original11 assertions retained. No dev merge since first review; no verify at rejected head. Revision reasoning A-5375.

### rev-31 · 2026-10-18T14:55:41.625Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-797-source-2
commit: d2c62d803b01a6151acd1d71929cd05e502b02b6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-797 corrected source review

Commit: d2c62d803b01a6151acd1d71929cd05e502b02b6
Fixed base: 2a3aa788d8fa47f2c6c4f688e9e822f84dcfd1b9
Run: rev-20261018-797-source-2
Scope: full
Result: clear

Reviewed the correction against 37907453, four-file task scope, Dispatcher sweep/startup ownership, Suites.settled, fixture exposure, shared-clock result driver and failure cleanup. Origin matches this head; its parent is the rejected task head, with no intervening dev merge. No Reviewer tests or edits.

## Standards
No findings. verificationSettled is observation-only: it waits for initial droplet reconciliation, admitted sweep work and existing Suites.settled work, rejoining a sweep admitted during the drain. It neither advances time nor schedules a tick and is exposed directly through in-process fixtures, without a new protocol frame or change to scheduling policy.

The helper drains both hubs before/after each admitted scheduler step. If driving an executor-requested delay moves the shared clock while draining a later hub, it repeats the completion pass for earlier-peer work. Native I/O alone cannot authorize another time advance. The held-worker control registers release cleanup before launch and releases/joins both submission/report work in finally before fixture disposal. T2 remains in-process, with no new child, literal wall-clock sleep, tier exemption or allowance.

A-5373 records the deterministic control failure when completion joins are removed. A-5374 passes the held control and full file after restoration. Independently audited A-5376: forty whole-file blocks, each ten tests/ten passes/zero failures, forty target-case and forty held-control passes, no runtime resource mismatch. A-5377 separates twenty runs each on Node 24.21.0 and 25.6.1, all exit 0. Whole-file ranges are 3.139–4.319 s and 3.240–3.627 s respectively. Host lint/typecheck evidence is A-5378/A-5379.

## Spec
Prior M1/C2 resolved. Topic reads are now checked only after admitted scheduler/executor completion; polling cannot consume the first project's timeout while the second project's report persistence is held. The control observes barrier admission, then a pending completion and unchanged clock through a real socket round trip, and checks no premature result before release. All eleven original cap/reservation/accounting assertions remain.

C1 verified: source/controlled receipts establish the frozen scheduler cause. A-5352 retains the exact forced ordering: clock 4.500 s, released lease, suite finished/unreported with awaiting-confirmed-accounting error, and a 30-second result timeout after no executor wait remains. A-5354 supplies the held unconfirmed-release ordering and A-5355 its successful clock-step execution. Original Node25 reproduction and assertion audit remain A-5349/A-5359.

C2's source and dual-version repetition evidence is positive, but its final verification awaits a fresh exact-head post-source-clear mode-free task result. No remaining findings; no per-item QA. This is source clearance, not final task readiness.

Standards: zero findings. Spec: zero findings.

Artifact A-5384.

Criteria: C1 verified.
