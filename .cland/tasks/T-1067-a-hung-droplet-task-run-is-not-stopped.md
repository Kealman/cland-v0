---
id: T-1067
kind: task
title: A hung droplet task run is not stopped by the silent-output watchdog
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-819
branch: t/T-1067-a-hung-droplet-task-run-is-not-stopped
created: 2026-10-21T15:34:51.747Z
updated: 2026-10-21T19:50:47.874Z
closed: 2026-10-21T19:50:47.874Z
---

## Summary

A remote task verify hung on its droplet for about 30 minutes with no output, and nothing stopped it until its owner cancelled it. Run 56752f57 (T-1052 at e79e1231, Linux c-8 droplet) printed its last progress receipt at 15:05:00.723Z (web-edge.test.ts file pass). The mirrored suite.log was unchanged from 15:05:09Z to 15:34:01Z. The only unclosed file was hub/test/task-prefixes.test.ts, started 15:03:57Z. The silent-output watchdog in hub/src/suite-command.ts takes its stall limit from `suiteLimits(cwd, 'local', …)`, which suggests droplet runs are not covered, or are covered with a much longer limit.

## What to build

A remote run with no output for longer than the configured stall limit ends as `timeout` with its in-flight file named, exactly like a local run, and its droplet is released.

## Acceptance criteria

- [x] C1. A droplet run whose test stops printing is ended by the stall limit, and its result has cause `timeout` and names the in-flight file (test with the fake or droplet executor contract).
  - done: impl-1067 · 2026-10-21T19:02:39.443Z
  - verified: rev-26 [reviewer] · run rev-20261021-1067-final-1 · 2026-10-21T19:45:49.933Z · commit 7f1081107aa75756787b5b0843da93d6b70e84d7
- [x] C2. The stall limit for remote runs is documented in docs/agents/tests.md and is no longer than the local one plus the transport's progress interval.
  - done: impl-1067 · 2026-10-21T19:02:39.474Z
  - verified: rev-26 [reviewer] · run rev-20261021-1067-source-2 · 2026-10-21T19:03:49.793Z · commit 7f1081107aa75756787b5b0843da93d6b70e84d7
  - verified: rev-26 [reviewer] · run rev-20261021-1067-final-1 · 2026-10-21T19:45:49.933Z · commit 7f1081107aa75756787b5b0843da93d6b70e84d7

## Comments

### impl-1067 · 2026-10-21T18:54:16.760Z

Red at working tree: node --test --test-name-pattern='silent droplet' hub/test/executor-run-rules.test.ts (macOS, local Node, T1 targeted; duration gates not run) fails with `stall limit publishes a terminal receipt: false !== true` after a fake droplet emits an in-flight test then exceeds its configured 3s silence limit. Using the requested executor/fake seam, no real provider operations.

### impl-1067 · 2026-10-21T18:59:01.582Z

Source review at 2a17df6e assigned. Evidence correction: A-8631 preserves original stdout, exit codes and timings without reruns. Seven new/existing executor file tests and lint ran on an uncommitted tree without a captured tree hash; A-8629's blanket committed-tree wording is corrected. Fifteen other targeted tests and final hub typecheck ran after commit; HEAD and clean status were observed afterward. Full verification remains pending clear source review.

### rev-26 · 2026-10-21T19:02:01.342Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-1067-source-1
commit: 2a17df6ec96f8e33b14b33dcf0c4384d9999c35a
scope: full
findings: [{"severity":"medium","text":"M1: Log collection errors rethrow before the silence watchdog, so a running remote receipt with repeated log failures can exceed stall_timeout until total-run timeout. Keep the silence decision reachable and valid done receipts authoritative; cover failed-log timeout and release at the fake seam.","file":"hub/src/hub/suites.ts","line":1125},{"severity":"medium","text":"M2: A crash after appending bytes but before saving remoteOutputAt leaves the disk offset ahead of the timestamp. Restart skips those bytes and can expire against stale progress. Persist/reconcile offset and timestamp and cover crash/replay without renewed silence credit.","file":"hub/src/hub/suites.ts","line":1295}]
finding_counts: {"high":0,"medium":2,"low":0}

Source audit A-8635: Standards 0 findings; Spec 2 medium findings. Log-collection errors bypass the new silence decision, and append-before-checkpoint can lose the latest output timestamp across restart. A-8631 corrects targeted evidence provenance; no full verification claimed. Fresh source review required after correction.

Criteria: C1 failed (M1 bypasses the stall decision after log errors; M2 can classify recent output as stalled after an append/checkpoint crash.), C2 failed (The documented maximum remote stall detection bound is not met when log collection errors bypass the watchdog.).

### rev-26 · 2026-10-21T19:03:49.793Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1067-source-2
commit: 7f1081107aa75756787b5b0843da93d6b70e84d7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; full corrected-source audit A-8638. M1 resolved by classifying completion and silence before propagating collection errors. M2 resolved by checkpointing the observed timestamp/byte high-water mark before mirror append; crash and replay regressions retain the original boundary. Standards 0 findings; Spec 0. A-8636 provides exact-head local macOS targeted T1 10/10, hub typecheck and static lint receipts; runtime lint report-only, no suite/load/duration-gate pass claimed. C2 source-verified; C1 remains pending same-head configured verification. Coordinator-owned full pre-merge evidence remains separate.

Criteria: C2 verified.

### rev-26 · 2026-10-21T19:45:49.933Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1067-final-1
commit: 7f1081107aa75756787b5b0843da93d6b70e84d7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, audit A-8682. Required same-head Coordinator full pre-merge bf66659e/A-8679 exited 0: T1/all T2/T3/Web, 3581 ordinary passes, 8 skips, 0 failures; all ten executor-run-rules identities passed. Linux x64 c-8 lon1 droplet, lifetime 1755 s/$0.1219, host gate dd1bfcc0 reused; T4 absent. Task 1f97a0b6/A-8645 separately passed 2345 ordinary tests plus 35 load repetitions, seven owned identities 5/5. Source review A-8638 resolved both findings. C1/C2 verified. Lint/duration/tier/ratchet diagnostics report-only, including T3 over wall budget; no budget or QA pass claimed. Standards 0; Spec 0.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-21T19:50:47.874Z

Merged 808acaad40ee728d92cf559de169d35652a5fb66 onto dev.
