---
id: T-450
kind: task
title: A hung.test.mjs fixture run leaves its runner and child alive for hours (orphan from the hung-run tests)
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-385
topic: topic-1060
branch: t/T-450-a-hung-test-mjs-fixture-run-leaves-its
created: 2026-10-15T03:49:38.455Z
updated: 2026-10-25T17:23:05.858Z
---

## Summary

impl-397 found two orphan node processes, about 15 h old (PID 48761 under PPID 1, and its child 48920), at 0% CPU. They were running `hung.test.mjs` from the suite directory `/private/tmp/cland-suite-cb5d74ec-…`. They are the leftover of T-385's hung-run test fixture from a run on 2026-10-14 about 12:25Z, which survived both its suite and the phase orphan sweep. The Coordinator terminated them on 2026-10-15 03:50Z, after checking the command lines. The hung-run tests must reap their own hung child even when the run times out, and the phase sweep should catch such a runner.

## Acceptance criteria

- [ ] C1. A test that starts a hung fixture run kills its runner and children on every exit path, and the file passes 5/5 with no node process left afterwards.
  - failed: rev-31 [reviewer] · 2026-10-25T17:23:05.858Z · note New failure controls accept a partial stdout prefix as the completed PID receipt; valid fragmented receipt can fail before cleanup assertions.
- [ ] C2. The runner's phase sweep reports a leaked hung fixture runner, proven by a test that leaks one on purpose.
  - failed: rev-31 [reviewer] · 2026-10-25T17:23:05.858Z · note New deliberate-leak fixture emergency cleanup depends on receiving its marker; early failure can remove roots before the generic runner stop hook.

## Comments

### impl-450 · 2026-10-25T17:09:26.585Z

Clean inherited worktree. TDD seams authorized by launch brief: T3 real hung run ownership/OS PID termination (C1), runner phase sweep output + OS PID termination for an intentionally leaked hung node:test runner (C2). No product wire/schema/admission contract change planned. Read A-11669 row T-450; current hung case has neither PID ownership nor post-run death assertions. Parent E-1282 has after-stage QA scope none; no per-item brief.

### impl-450 · 2026-10-25T17:18:51.215Z

C1 red: both sealed fault controls initially failed on macOS/local with `hung fixture PID 92741 survived setup failure` / `hung fixture PID 93911 survived assertion failure`. Fixed by registering verifier-owned cancellation/terminal receipt before fixture socket disposal, plus live PID ownership and final OS death assertions. C2: added intentionally leaked detached node --test hung runner+worker regression; current sweep already handles it. Negative control temporarily omitting completed-phase sweep failed `/cleanup pid 12217:.*hung.test.mjs/`; restoring it passes (~0.6s macOS). No run-suite.ts product change; no command/help/permission or wire consumers to migrate. Updated per-file docs, index and implement skill/CHANGES; role clause unchanged at its byte reserve.

### rev-31 · 2026-10-25T17:23:05.858Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-450-source1
commit: ae3aa1a972a7fd5f9f77dbee2b9dd63fd2240630
scope: full
findings: [{"severity":"medium","text":"M1: new phase-leak regression registers emergency PID/phase-root ownership only after marker receipt/assertion; missing/torn setup skips it. Generic run helper's later raw t.after follows fixture's earlier directory cleanup hook, so writers/root can outlive removal. Pre-register deferred enclosing cleanup before creation/launch, own/drain runner+pipes and discoverable phase root before removal, with missing-marker early-failure control; preserve primary sweep assertions.","file":"hub/test/suite-runner.test.ts","line":1056},{"severity":"medium","text":"M2: receipt observer accepts stdout prefix before complete JSON/newline, then parses immediately; arbitrary pipe chunk splitting can reject a valid in-flight setup receipt. Observe fully parsed newline record/root/two PIDs within existing bound (or durable equivalent), fail closed on process close, and exercise split receipt without sleep/timeout relaxation.","file":"hub/test/suite-timeouts.test.ts","line":127}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source NOT CLEAR; A-12051 complete Standards2medium/Spec-no-separate-findings audit at tree5a2d9d6013435e0b14199373cc3d1b99a6162f72. Normal exact-job cancellation/terminal receipt before client/hub disposal and native timeout/OS death assertions are sound; deliberate sweep primary proof must stay distinct from emergency cleanup. Fix only narrow lifecycle/receipt paths preserving assertions and sealed env. Local A-12048 TDD summary/first10-case file and ongoing repetitions remain attributed prior-head evidence, not final5/5/Linux or timing enforcement. Preserve original outputs/source/capture limits without transcription reruns. Push correctedhead/fresh source before verify, restore marks when appropriate; no dev merge/production expansion directed. Reviewer read-only.

Criteria: C1 failed (New failure controls accept a partial stdout prefix as the completed PID receipt; valid fragmented receipt can fail before cleanup assertions.), C2 failed (New deliberate-leak fixture emergency cleanup depends on receiving its marker; early failure can remove roots before the generic runner stop hook.).
