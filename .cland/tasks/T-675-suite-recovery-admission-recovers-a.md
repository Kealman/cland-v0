---
id: T-675
kind: task
title: suite-recovery 'admission recovers a borrowed planned root…' kills the launch snapshot's pid; use T-526's pid observer
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by:
  - T-526
topic: topic-407
branch: t/T-675-suite-recovery-admission-recovers-a
created: 2026-10-16T19:13:55.940Z
updated: 2026-10-16T20:17:56.377Z
---

## Summary

hub/test/suite-recovery.test.ts:123 (at aeaf3dec) ('admission recovers a borrowed planned root after the worker dies during package mkdir') calls `process.kill(job.pid!)` on the launch response snapshot after waiting for its marker. It has the same nullable-PID race that T-526 fixed in two other cases: the marker doesn't refresh the snapshot, and the worker pid is published later on the job record. The source review of T-526 (A-4139) found it by inspection, with no observed failure yet.

## What to build

The case uses the shared PID observer T-526 added (aeaf3dec) to read the published pid from the durable job record before it kills the worker. Its assertions keep their meaning.

## Acceptance criteria

- [x] C1. The case reads the worker pid through T-526's observer before signalling, with its assertions unchanged in meaning, proved by the file's own run.
  - done: impl-675 · 2026-10-16T19:59:46.288Z
  - verified: rev-30 [reviewer] · run rev-20261016-675-source · 2026-10-16T20:00:32.701Z · commit 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb
  - verified: rev-30 [reviewer] · run rev-20261016-675-final · 2026-10-16T20:17:55.585Z · commit 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb
- [x] C2. suite-recovery.test.ts passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - done: impl-675 · 2026-10-16T20:17:34.068Z
  - verified: rev-30 [reviewer] · run rev-20261016-675-final · 2026-10-16T20:17:55.585Z · commit 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb

## Comments

### impl-675 · 2026-10-16T19:58:00.646Z

Read D53 Test levels. Target is T3 because real worker death during package mkdir is the lifecycle behavior under test. Reused T-526 fixture.workerPid(id) immediately before SIGKILL; all assertions unchanged. Baseline diagnosis is already specified by the task (inspection-found nullable launch snapshot), so using whole-file repeated runs as regression evidence rather than a separate duplicate test. qaPolicy scope none; no per-item QA brief required. origin/dev fetched and already contained before source review.

### impl-675 · 2026-10-16T19:59:46.641Z

Committed/pushed 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb. npm run typecheck passed. Whole suite-recovery.test.ts on macOS passed 5/5 serially, 6/6 tests each: 17.014s, 17.107s, 16.017s, 16.360s, 17.105s. Peak sampled 1m load 3.322 (<15). C1 done; C2 remains pending task droplet verification after a clear source verdict and Coordinator's hold lift.

### rev-30 · 2026-10-16T20:00:32.701Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-675-source
commit: 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-675 full source review clear at 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb. Fixed point direct parent fd0cab4d6299a9328f5864ae46e9bbdf84cec790. One test file changed; origin task tip matches. Standards and Spec axes reviewed in-session under the role's no-delegation constraint: no findings.

The borrowed planned-root recovery case still waits for the real mkdir marker before killing its actual suite worker. It now separately observes f.workerPid(job.id) from T-526's shared matching hub.status job-record helper before signalling, avoiding the immutable launch snapshot. That helper uses bounded eventually polling and registers observed process cleanup. Every existing failed-report, successor admission, root/lock-owner absence and empty-run-record assertion is unchanged. The real death/recovery lifecycle is retained, with an explanatory T3 comment; no new sleeps, production edits, assertions removed, fixture cleanup changes or allowances.

C1 established by source plus the file's own execution: independently read all five A-4164 run logs and summary; changed case passes each run (3.083/4.130/3.117/3.088/4.089 s), each whole file 6/6, total 30/30 with zero failures/skips. Serial file wall 16.017–17.107 s; sampled peak load at most 3.322 below 15. Request reports exact-head root typecheck passed; independent whitespace check passes. No Reviewer test execution and no observed historical failure is invented: this correction addresses the previously reported static nullable-snapshot mechanism.

C1 verified; C2 local portion accepted, final droplet portion remains pending. Source clearance does not lift the Coordinator's explicit verification hold. Wait for its explicit release before submitting the normal exact-head droplet verify, then return the receipt for final settlement. No per-item QA criteria.
Review artifact A-4166.

Criteria: C1 verified.

### rev-30 · 2026-10-16T20:17:55.585Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-675-final
commit: 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-675 final evidence clear at unchanged source-reviewed 7e5fe5ecdecacad1a200e8d0c77597fcf866b5eb. Standards and Spec axes: no findings.

Independently inspected complete A-4184 / d365804f-0ec6-4f29-87e7-473a74540280. Log branch/head match source verdict A-4166; hub-selected mode names the changed whole suite-recovery file using coverage A-4159. Exit 0, 40/40 tests, zero failures/skips: selected hub phase 28/28 and Neovim smoke 12/12. All six suite-recovery identities have positive timings; corrected borrowed-root crash/recovery passes in 5.192833294 s. No hard budget or load-gate failure; printed duration regression is non-failing. Linux x64 c-8 lon1, two workers; suite 68.59 s, peak load 1.37, machine lifetime 141 s and cost $0.0098 per hub receipt metadata.

C2 Mac proof remains independently audited A-4164: five serial whole-file six-case runs, total 30/30 with zero failures/skips, 16.017–17.107 s per file, sampled peak load at most 3.322. No source changes after that proof or source review. C1 bounded matching published PID observer before SIGKILL, real mkdir/death recovery and retained assertions remain established by A-4166 and now exact-head Linux execution. Latest task view has both claimant done marks.

C1/C2 verified at the exact reviewed head. No per-item QA or further task run required.
Review artifact A-4185.

Criteria: C1 verified, C2 verified.
