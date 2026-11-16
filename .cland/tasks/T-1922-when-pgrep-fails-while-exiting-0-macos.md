---
id: T-1922
kind: task
title: When pgrep fails while exiting 0 (macOS sysmond missing), the hub reads every process group as empty and declares live remote runs and watchdogs dead
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1568
branch: t/T-1922-when-pgrep-fails-while-exiting-0-macos
created: 2026-11-16T17:36:21.368Z
updated: 2026-11-16T22:28:56.463Z
---

## Summary

On 2026-11-16 around 17:26Z the macOS sysmond service disappeared on the hub's machine. `pgrep` then printed "sysmon request failed with error: sysmond service not found" and "pgrep: Cannot get process list" on stderr, with no output, and exited 0, while `ps -A` kept working. The hub calls pgrep in `hub/src/suite-lock.ts`, `hub/src/git-maintenance-owner.ts` and `hub/src/system-processes.ts`. Within seconds, three remote runs' streams stopped (17:26:25Z) and were declared "remote machine lost" at 17:31:32Z. The next batch failed at start, and the executor showed `watchdog=dead` on a 1-second-old droplet. A host tool failing must read as "unknown", never as "no processes".

## What to build

Every pgrep caller treats any stderr output, or a known failure message, as a failed inspection, whatever the exit code. Liveness and ownership decisions then keep the current state, and name the cause as "process inspection unavailable", instead of concluding that processes are absent. Prefer a `ps`-based fallback where it exists. Rule 20: list every pgrep, ps and process-listing caller and the decisions each feeds.

## Acceptance criteria

- [x] C1. With a fake pgrep that writes the sysmond error to stderr and exits 0, every pgrep path that can touch a run preserves its process and ownership fence and reports "process inspection unavailable"; a running remote run fixture keeps its lease, readable stream and native watchdog identity across these checks (test, red before the fix).
  - done: impl-1922 · 2026-11-16T22:21:53.616Z
- [x] C2. The same fake makes suite-lock and git-maintenance owner checks report "process inspection unavailable" without releasing or reclaiming anything, and a genuinely empty pgrep result still behaves as today (test).
  - done: impl-1922 · 2026-11-16T22:21:53.784Z

## Comments

### impl-1922 · 2026-11-16T22:15:48.114Z

Failure evidence: stderr `sysmon request failed with error: sysmond service not found` / `pgrep: Cannot get process list`, empty stdout, exit 0. Consumer search before changes: production pgrep in system-processes.systemProcesses (descendant capture/termination), suite-lock.sweep (changed-inode quarantine), git-maintenance-owner.inspect/recoverMaintenanceOwnerSync (collector recovery); additional shipped pgrep in test/process-cleanup.groupMembers (suite runner/fixture teardown). ps readers include process-identity, hub/lock, process-table, adapters/processes, executor/droplet/watchdog and dependencies, suite-command, cleanup, doctor and resource probes. Their native identity/liveness contracts remain unchanged. Searches include production, hub/nvim/web tests, QA briefs, docs and skills; process-cleanup synthetic execFileSync fakes must migrate to captured stderr. No wire/persisted-record shape changes planned.

### impl-1922 · 2026-11-16T22:21:06.848Z

Follow-up consumer audit: process-table.ts supplies selection/parser to system-processes, process-cleanup, transport-forwards and suite-timeouts fixtures. Native birth/ps consumers (unchanged): process-identity.ts (Darwin Perl/Linux proc identity), hub/lock.ts (lease PID starts), remote/poller-lease.ts, fixture-processes.ts, stdio-writers.ts, adapters/processes.ts, orphans.ts, suite-command.ts, executor/local.ts, hub/suite-worker.ts, hub/suite-isolation.ts and executor/droplet/watchdog.ts. All pgrep callers now share pgrepMembers: descendant discovery, suite-lock changed-root recovery, async/sync maintenance recovery, shipped cleanup group census. Test fakes migrated: system-process-probe spawn and spawnSync; process-cleanup probe spawnSync delegates through its existing synthetic execFileSync so wrappers/census stay intact. setup-machine.ts only provisions the pgrep executable; no decision to migrate. Searches across src/bin/shared/test-support, all test tiers, docs/skills/qa found no wire schema, persisted shape or startup reply requiring migration. Remote incident evidence: three result.json files (9759d489/8ca3360e/c830a7ae) say remote machine lost at 17:31:31.943–32.143Z; streamed suite.log scans have no pgrep/sysmon/inspection/root-recovery error. Next f78c050a result says ssh-keygen: No user exists for uid 501. Coordinator split actual SSH-loss investigation into T-1925 and replaced C1 to match defensible pgrep preservation coverage.

### impl-1922 · 2026-11-16T22:26:03.660Z

Review follow-up committed/pushed as 3fa12b953e56cf777c043c051f0bf07abe8a180d: parent owns both probe cwd (collector records) and required suite-root sibling before launch, retains them through execFile native close, and cleans both even when child finally cannot run. Optional parent-owned suite-root path is covered by 2/2 targeted pgrep regressions; hub typecheck and closed-item lint pass. No cancellation experiment. A-20415 preserves original terminal excerpts with source-to-commit/raw-stream limitations. A-20416 retains complete static hit set: 656 file/line/category/tier/disposition entries across production, tests/helpers, QA/defaults/docs/skills. Original full files 59/69/15 remain prior-source receipts, not new-head full-file claims. Requested updated source review.

### rev-36 · 2026-11-16T22:28:56.463Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1922-source-1
commit: 47f7439ba582ce6c2ab79823319531144f32861b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 47f7439ba582ce6c2ab79823319531144f32861b. Standards: initial root-ownership and consumer-inventory findings are resolved; parent creates/registers both roots synchronously before first await, close-joined cleanup owns disposal, and A-20416 retains 656 consumer paths with tiers/dispositions (all 319 directly matched cleanup imports included). Spec: shared validation rejects diagnostic/malformed/failed pgrep across all four branches while preserving fences and clean-empty policy; current C1 is the Coordinator's scoped preservation criterion, with incident causality assigned to T-1925. Full review A-20421 supersedes initial findings snapshot A-20417. A-20412/A-20415 preserve targeted evidence and its source/native/raw-stream limits; corrected-path 2/2/compiler/lint are reported separately. C1/C2 remain unverified pending same-head configured evidence; no Reviewer tests/probes executed.
