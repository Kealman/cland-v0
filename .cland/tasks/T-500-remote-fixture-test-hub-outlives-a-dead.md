---
id: T-500
kind: task
title: remote-fixture test hub outlives a dead or timed-out test (orphan hub serve in remote-run-* dirs)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-343
branch: t/T-500-remote-fixture-test-hub-outlives-a-dead
created: 2026-10-15T14:10:39.101Z
updated: 2026-10-16T00:26:03.564Z
---

## Problem

`hub/test/remote-fixture.ts` starts a `hub serve` in a `remote-run-*` temp directory. When the test's parent dies or times out without teardown, that hub outlives it. On 2026-10-15 pid 76123 ran orphaned (ppid 1) from 13:33Z until the stand-in reaped it at 14:12Z; it came from the T-459 worktree, and a second stale remote-run-ZYtvuT dir was left behind. Leaked hubs add load and can hold sockets and databases that later tests touch.

## Acceptance criteria

- [ ] C1. The remote fixture's hub is stopped, and its temp dir removed, on normal teardown, on test timeout and on the test process's exit (including SIGTERM/SIGINT). A spawned child that loses its parent exits by itself within a bounded time.
- [ ] C2. A test kills a fixture's parent abruptly and observes the fixture hub gone within the bound. remote-fixture users pass 5/5 serially on the Mac.
- [ ] C3. A test fixture that starts a hub with a fake provider leaves no droplet watchdog behind: its teardown stops and awaits the fixture watchdogs, or a fixture watchdog exits when its fake provider state disappears. Seen 2026-10-15 23:00Z: pids 50008 and 50071 outlived fixture hub 36962. Production watchdogs keep their independence from the hub (guaranteed destruction, v0.1.2 §3.14, executor-droplet.test.ts:169) unchanged.

## Comments

### coord · 2026-10-15T14:11:01.863Z

Likely trigger, from impl-459: at 13:33Z an interrupted targeted run of hub/test/executor-run.test.ts was cancelled during the fake remote lifecycle case. The fixture teardown didn't run, which left the orphan. For C2, reproduce it by interrupting that file mid-case.

### coord · 2026-10-15T17:48:59.506Z

A second leak pattern, from the stand-in at 17:49Z: a `node -e` fake child (pid 26723, almost 4 days old) was polling every 50 ms for a "finish" file in a deleted cland-suite-cli temp dir, with no owner, until it was reaped. Fake children that poll for a file outlive tests that exit without writing it. C1 should also make such fakes exit on their own when the parent or the poll directory disappears.

### human · 2026-10-15T23:02:15.811Z

Orphan reaped by cland-impl, 2026-10-15 23:00Z, at coord's request: a fixture hub serve from the T-469 worktree (pid 36962, ppid 1, age 1h40m, cwd $TMPDIR/remote-run-YP1j6b) running since ~21:21Z, when impl-469 interrupted its targeted stage-cover run. SIGTERM to 36962 ended the hub, but its two droplet watchdog children (hub/src/executor/droplet/watchdog.ts, pids 50008 and 50071, same cwd) were reparented to launchd and kept running; they needed their own SIGTERM. Same pattern as the 14:12Z reap (pid 76123, remote-run-QRokzy). Dirs remote-run-QRokzy, -YP1j6b and -ZYtvuT remain in $TMPDIR for the cleanup this ticket adds. Note for the fix: the watchdogs must die with their parent (process group or a parent-death watch).

### impl-500 · 2026-10-16T00:26:03.564Z

Red reproduction: node --test --test-name-pattern='owner SIGKILL' hub/test/remote-fixture-lifecycle.test.ts failed because the actual remote-fixture hub remained alive past the 5s bound. Implementing a test-only IPC reaper and explicit detached writer/watchdog cleanup; production watchdog behavior remains unchanged per Coordinator decision.
