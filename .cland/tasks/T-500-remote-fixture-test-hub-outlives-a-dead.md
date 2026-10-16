---
id: T-500
kind: task
title: remote-fixture test hub outlives a dead or timed-out test (orphan hub serve in remote-run-* dirs)
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-343
branch: t/T-500-remote-fixture-test-hub-outlives-a-dead
created: 2026-10-15T14:10:39.101Z
updated: 2026-10-16T01:05:45.833Z
---

## Problem

`hub/test/remote-fixture.ts` starts a `hub serve` in a `remote-run-*` temp directory. When the test's parent dies or times out without teardown, that hub outlives it. On 2026-10-15 pid 76123 ran orphaned (ppid 1) from 13:33Z until the stand-in reaped it at 14:12Z; it came from the T-459 worktree, and a second stale remote-run-ZYtvuT dir was left behind. Leaked hubs add load and can hold sockets and databases that later tests touch.

## Acceptance criteria

- [x] C1. The remote fixture's hub is stopped, and its temp dir removed, on normal teardown, on test timeout and on the test process's exit (including SIGTERM/SIGINT). A spawned child that loses its parent exits by itself within a bounded time.
  - done: impl-500 · 2026-10-16T01:04:43.964Z
  - verified: rev-30 [reviewer] · run rev-20261016-500-source-correction · 2026-10-16T01:05:45.833Z · commit 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9
- [ ] C2. A test kills a fixture's parent abruptly and observes the fixture hub gone within the bound. remote-fixture users pass 5/5 serially on the Mac.
- [x] C3. A test fixture that starts a hub with a fake provider leaves no droplet watchdog behind: its teardown stops and awaits the fixture watchdogs, or a fixture watchdog exits when its fake provider state disappears. Seen 2026-10-15 23:00Z: pids 50008 and 50071 outlived fixture hub 36962. Production watchdogs keep their independence from the hub (guaranteed destruction, v0.1.2 §3.14, executor-droplet.test.ts:169) unchanged.
  - done: impl-500 · 2026-10-16T00:54:02.131Z
  - verified: rev-30 [reviewer] · run rev-20261016-500-source-correction · 2026-10-16T01:05:45.833Z · commit 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9

## Comments

### coord · 2026-10-15T14:11:01.863Z

Likely trigger, from impl-459: at 13:33Z an interrupted targeted run of hub/test/executor-run.test.ts was cancelled during the fake remote lifecycle case. The fixture teardown didn't run, which left the orphan. For C2, reproduce it by interrupting that file mid-case.

### coord · 2026-10-15T17:48:59.506Z

A second leak pattern, from the stand-in at 17:49Z: a `node -e` fake child (pid 26723, almost 4 days old) was polling every 50 ms for a "finish" file in a deleted cland-suite-cli temp dir, with no owner, until it was reaped. Fake children that poll for a file outlive tests that exit without writing it. C1 should also make such fakes exit on their own when the parent or the poll directory disappears.

### human · 2026-10-15T23:02:15.811Z

Orphan reaped by cland-impl, 2026-10-15 23:00Z, at coord's request: a fixture hub serve from the T-469 worktree (pid 36962, ppid 1, age 1h40m, cwd $TMPDIR/remote-run-YP1j6b) running since ~21:21Z, when impl-469 interrupted its targeted stage-cover run. SIGTERM to 36962 ended the hub, but its two droplet watchdog children (hub/src/executor/droplet/watchdog.ts, pids 50008 and 50071, same cwd) were reparented to launchd and kept running; they needed their own SIGTERM. Same pattern as the 14:12Z reap (pid 76123, remote-run-QRokzy). Dirs remote-run-QRokzy, -YP1j6b and -ZYtvuT remain in $TMPDIR for the cleanup this ticket adds. Note for the fix: the watchdogs must die with their parent (process group or a parent-death watch).

### impl-500 · 2026-10-16T00:26:03.564Z

Red reproduction: node --test --test-name-pattern='owner SIGKILL' hub/test/remote-fixture-lifecycle.test.ts failed because the actual remote-fixture hub remained alive past the 5s bound. Implementing a test-only IPC reaper and explicit detached writer/watchdog cleanup; production watchdog behavior remains unchanged per Coordinator decision.

### rev-30 · 2026-10-16T00:56:38.871Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-500-source
commit: bc560070a3a11a79ec9590106aa17ec737d32124
scope: full

Source review T-500 not clear at bc560070a3a11a79ec9590106aa17ec737d32124, fixed comparison ca09b03c056fcc77015b698bc95f9bee9655df13. Standards and Spec reviewed directly. One medium finding; no separate high or low findings.

Medium — hub/test/remote-fixture.ts:23 and hub/test/fixture-guard.ts:49: new detached-writer discovery only runs in beforeDirectories on ordinary test teardown. ownDirectory installs the existing process-cleanup.ts:386–390 SIGTERM/SIGINT handler, which first cleans recorded identities and then recursively removes registered roots. A production watchdog launched by the fixture hub is detached and is not a captured identity in the owning test process. Signal cleanup bypasses beforeDirectories; it can therefore remove the lease/root while the watchdog is alive. On owner disconnect the guardian skips a missing root, so it cannot establish stop-before-delete retroactively. Watchdog's existing missing-lease exit is not an observed stop before removal. This leaves the signal path racing writers and violates rule12 within C1's explicit SIGTERM/SIGINT scope.

Make the fixture writer-stop cleanup participate in signal cleanup before rm, and add live-watchdog SIGTERM/SIGINT regression modes that preserve production independence while observing writer exit before directory removal. Do not change the production watchdog's independent guaranteed-destruction contract. Implementer cd0bf00f confirms the gap and is preparing this correction/new head before verify. C1 failed; C2 remains incomplete rather than failed for missing repetition evidence.

Otherwise the test-only guardian's IPC closure covers abrupt owner death, captures device/inode before acknowledging each root, checks root identity before discovery, and invokes existing PID/start/cwd ownership proof rather than broad signalling. Normal teardown stops the embedded hub and discovers/awaits detached writers before provider/root disposal. The file barrier exits on owner reparenting, working-directory loss or finish without keeping a polling timer alive. Task diff contains no production watchdog change. Machine shard entry is present and four measured lifecycle duration exceptions have specific startup/timeout rationale. Existing suite finish barriers keep their assertions.

A-3497 documents the pre-fix SIGKILL red (hub alive beyond5s). A-3513 raw log inspected: corrected lifecycle10/10, zero fail/skip,34.368s; suite11/11,25.008s. The current watchdog cases are teardown and SIGKILL, while plain SIGTERM/SIGINT modes create no live remote watchdog; therefore the green run does not cover the flagged combination. Claimed typecheck/shard/diff checks green; five serial whole-file repetitions for all direct/indirect remote-fixture users, lifecycle and suite are still in progress. No full task verification yet. New source review required after correction.

Read task file for criteria/body under current T-548 guidance; no task.view scan. No Reviewer tests, compiler/binary execution, edits, signals, installs, merges or provider actions. No per-item QA.

Structured finding: [{"severity":"medium","file":"hub/test/remote-fixture.ts","line":23,"text":"Detached-writer cleanup is ordinary-teardown-only; SIGTERM/SIGINT removes roots through generic signal cleanup before detached watchdog exit is observed."}].

Review artifact A-3516 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3516-t-500-source-not-clear-signal-cleanup-removes-roots-before-watchdog-stop.md.

Criteria: C1 failed (SIGTERM/SIGINT generic signal cleanup removes registered roots before detached fixture watchdogs are discovered and observed stopped.).

### rev-30 · 2026-10-16T01:05:45.833Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-500-source-correction
commit: 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9
scope: delta

Corrected source review T-500 clear at 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9, direct parent bc560070a3a11a79ec9590106aa17ec737d32124. Standards: no findings. Spec: no remaining high, medium or low findings. A-3516 medium signal-cleanup finding is resolved.

The entire corrective delta is test-only process-cleanup.ts plus lifecycle/parent fixtures. beforeDirectories now wraps each writer-stop callback in a memoized promise and registers that same wrapper for both ordinary hub cleanup and SIGTERM/SIGINT cleanup. Signal handler awaits registered callbacks before its directory-rm loop; ordinary teardown still orders client resources, hub/writer cleanup, directories and final checks. A completed context unregisters its signal callback in checks, including after earlier cleanup failures. Memoization joins concurrent teardown/signal attempts and preserves a failed cleanup result rather than running a second cleanup against removed resources. installSignals is ensured at registration. The original IPC guardian and directory/PID ownership proof remain unchanged; no production watchdog source modification.

Regression now includes live-watchdog SIGTERM and SIGINT owner modes. Those fixtures set watchdog poll to60s, preventing missing-lease exit from masking a failure to actively stop it. The observer owns emergency cleanup only after assertions, and retains bounded owner, hub, watchdog/guardian, then directory observations. Production independence is still explicitly checked by stopping the hub while its watchdog remains alive until fixture teardown. A-3524 raw receipt: before correction new watchdog-SIGTERM fails the10s watchdog/guardian-exit bound; corrected whole lifecycle12/12, zero failures/skips/cancellations,37.125s, including watchdog-SIGTERM4.255s and SIGINT4.025s. No new duration allowance is needed for those measured cases. Existing targeted SIGKILL reproduction and suite pass remain historical support from A-3497/A-3513.

C1 source and targeted lifecycle proof verified: ordinary, timeout, explicit exit, SIGTERM/SIGINT/SIGKILL and file-polling owner/directory-loss paths are covered with bounded observations; both ordinary and signal deletion now await writer-stop cleanup. C3 verified by unchanged production code plus live-watchdog teardown/abrupt-owner cases and its independence assertion. No claim that production watchdogs die merely because the hub dies. Immutable delta whitespace check clear; implementer reports typecheck/shard lint green.

C2 remains pending five serial whole-file passes at the final reviewed source for all required direct/indirect remote-fixture users, lifecycle and suite, followed by required actual Linux task verification. Source clear is not final gate or merge readiness. Continue Coordinator's evidence/admission sequence; changed head needs source review. No per-item QA. No task.view scan under current T-548 guidance. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Review artifact A-3526 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3526-t-500-corrected-source-clear-at-2c7b97ee-shared-signal-writer-cleanup.md.

Criteria: C1 verified, C3 verified.
