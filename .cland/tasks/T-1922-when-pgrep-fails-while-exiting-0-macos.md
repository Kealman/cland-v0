---
id: T-1922
kind: task
title: When pgrep fails while exiting 0 (macOS sysmond missing), the hub reads every process group as empty and declares live remote runs and watchdogs dead
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1568
branch: t/T-1922-when-pgrep-fails-while-exiting-0-macos
created: 2026-11-16T17:36:21.368Z
updated: 2026-11-17T00:32:50.444Z
closed: 2026-11-17T00:32:50.444Z
---

## Summary

On 2026-11-16 around 17:26Z the macOS sysmond service disappeared on the hub's machine. `pgrep` then printed "sysmon request failed with error: sysmond service not found" and "pgrep: Cannot get process list" on stderr, with no output, and exited 0, while `ps -A` kept working. The hub calls pgrep in `hub/src/suite-lock.ts`, `hub/src/git-maintenance-owner.ts` and `hub/src/system-processes.ts`. Within seconds, three remote runs' streams stopped (17:26:25Z) and were declared "remote machine lost" at 17:31:32Z. The next batch failed at start, and the executor showed `watchdog=dead` on a 1-second-old droplet. A host tool failing must read as "unknown", never as "no processes".

## What to build

Every pgrep caller treats any stderr output, or a known failure message, as a failed inspection, whatever the exit code. Liveness and ownership decisions then keep the current state, and name the cause as "process inspection unavailable", instead of concluding that processes are absent. Prefer a `ps`-based fallback where it exists. Rule 20: list every pgrep, ps and process-listing caller and the decisions each feeds.

## Acceptance criteria

- [x] C1. With a fake pgrep that writes the sysmond error to stderr and exits 0, every pgrep path that can touch a run preserves its process and ownership fence and reports "process inspection unavailable"; a running remote run fixture keeps its lease, readable stream and native watchdog identity across these checks (test, red before the fix).
  - done: impl-1922 · 2026-11-16T22:54:53.222Z
  - verified: rev-36 [reviewer] · run rev-36-1922-final-1 · 2026-11-16T23:33:57.473Z · commit b980d46cf16602cdfb555f2dff7f21180e459fa5
- [x] C2. The same fake makes suite-lock and git-maintenance owner checks report "process inspection unavailable" without releasing or reclaiming anything, and a genuinely empty pgrep result still behaves as today (test).
  - done: impl-1922 · 2026-11-16T22:21:53.784Z
  - verified: rev-36 [reviewer] · run rev-36-1922-final-1 · 2026-11-16T23:33:57.473Z · commit b980d46cf16602cdfb555f2dff7f21180e459fa5

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

### impl-1922 · 2026-11-16T22:53:24.092Z

First configured verification e6b321a5 at 47f7439ba: only completed failure hub-priority.test.ts::inherited low priority appears in the startup log and CLI diagnostics (`no check named hub priority`, A-20447:32886), attributed by Coordinator to shared T-1923. T0/T1 pass, T2 fails, changed T3/Web unexecuted. Per Coordinator 97b2f764, cherry-picked unmodified reviewed fix 15757e4d4 as b980d46cf16602cdfb555f2dff7f21180e459fa5; no dev merge or other delta. Matching stable patch-id ca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. Local Darwin arm64 Node24.21.0 hub-priority 1/1 and full npm run typecheck pass. A-20448 records evidence; pushed and requested delta source review before replacement verify window.

### rev-36 · 2026-11-16T22:54:45.558Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1922-evidence-1
commit: 47f7439ba582ce6c2ab79823319531144f32861b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Historical same-head configured evidence not clear: e6b321a5/A-20447 exit1 at47f7439ba. Actual sole completed failure hub-priority.test.ts::inherited low priority appears in the startup log and CLI diagnostics, AssertionError no check named hub priority (32886); Coordinator97b2f764 attributes T-1923 and separately authorizes exact shared-fix cherry-pick. T0/T1pass, T2fail, changedT3/Webunexecuted. T1pgrep matrix has base1+load5, but four newT3cases have no configured receipt. Independent streamed facts/provenance/report-mode limits A-20449; findings[] means no new source defect, not a green run. C1evidencefailed/C2unverified. New b980d46cf delta request remains a separate review; do not carry this red as pass.

Criteria: C1 failed (Required configured run e6b321a5 failed in T2 before the new C1 T3 cases executed; named T1 positives do not complete the required receipt.).

### rev-36 · 2026-11-16T22:55:38.337Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1922-source-2
commit: b980d46cf16602cdfb555f2dff7f21180e459fa5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-20450. Sole three-file delta from47f7439ba is Coordinator97b2f764-authorized unmodified T-1923 shared fix15757e4d4, independently matching stable patch idca1055f0f1fa1bcd7cd2b9c0c935301d9d365422. Native lock identity is retained across the fixture environment swap; doctor gets a positive local-holder assertion and existing priority assertions remain; guide/index align. No T-1922 runtime/cleanup/probe change or dev merge; prior full source A-20421 remains basis. e6b321a5/A-20447 remains historical failed/incomplete under A-20449, not carried. Targeted local priority1/1/compiler are not new configured/Linux evidence. C1 implementation-done restored, C1/C2 remain unverified until same-head result. Coordinator owns window; no Reviewer tests/probes.

### rev-36 · 2026-11-16T23:33:57.473Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1922-final-1
commit: b980d46cf16602cdfb555f2dff7f21180e459fa5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear:2933ff09/A-20461 at source-clear b980d46cf exits0,6648/6648 ordinary test finishes and709positive files; no nonpass/unfinished/skips. Independent streamed ledger A-20464 and final review A-20466. C1both descendant/collector/suite preservation cases plus both registered-group refusals have named base passes (changedT3once, no load repetition claim). C2clean-empty async/sync assertions and pure T1matrix base1+load5 pass. AllT1/allT2fallback/Web and both changedT3files complete; sharedpriority passes. Consumer656union:157positive,133T3+4T4deferred,362refs; broader remainingT3/T4/QA unexecuted. Actual Linuxx64 Node24.21/CfT156.0.8078.4 headless1248 provenance pins this head/executiontree, uncached; budgets/lint/ratchet report-only. Historical e6b321a5red/A-20449 and local capture limits remain. C1/C2verified; no Reviewer runtime.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T00:32:50.444Z

Merged c74b7141f343adea41472bef0935b1c2d8b4bc38 onto dev.
