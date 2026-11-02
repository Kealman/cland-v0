---
id: T-1615
kind: task
title: The hub lock records its host identity and a heartbeat
state: open
status: ready
size: M
criterion_seq: 9
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1331
branch: t/T-1615-the-hub-lock-records-its-host-identity
created: 2026-11-02T03:34:16.287Z
updated: 2026-11-02T10:46:51.679Z
---

## Summary

A new hub lock records the holder's host identity (hostname, boot id and PID-namespace id) and a heartbeat time beside its pid, start time and token. A contender whose identity differs in any part never probes the holder's pid. It refuses the start while the heartbeat is fresh, and breaks the lock through the existing `hub.lock.break` guard only after the heartbeat has lapsed. Records with the contender's own identity, and records in every older shape, keep today's rules.

Hot files: `hub/src/hub/lock.ts`, `hub/src/process-identity.ts` [E-1532: one boot-id reader], `hub/src/hub/daemon.ts` (acquire call only), new `hub/test/hub-lock-identity.test.ts`

## Acceptance criteria

- [x] C1. A hub lock written by a new hub carries the holder's hostname, boot id and PID-namespace id (null where the platform has none) and a heartbeat time, beside its pid, start time and token (test).
  - done: impl-1615 · 2026-11-02T06:13:56.252Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.194Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C2. A lock whose host identity differs from the contender's in any part and whose heartbeat is younger than the lapse refuses the start with `HubLocked`, even when its pid is not alive on the contender's machine (test).
  - done: impl-1615 · 2026-11-02T06:05:33.992Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C3. The same foreign lock with a heartbeat older than the lapse is broken through the `hub.lock.break` guard, and the contender takes the lock whole (test).
  - done: impl-1615 · 2026-11-02T06:13:57.268Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C4. The pid of a foreign record is never probed with a signal or `ps` on the contender's machine (test).
  - done: impl-1615 · 2026-11-02T06:13:58.314Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C5. A lock with the contender's own host identity keeps today's pid, start-time and pid-reuse rules (test).
  - done: impl-1615 · 2026-11-02T06:05:37.837Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C6. Records without the new fields, in each older shape (pid alone, with `started`, with `startedUtc`, with `token`), keep today's rules (test).
  - done: impl-1615 · 2026-11-02T06:05:38.868Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C7. The boot id comes from the reader `process-identity.ts` already uses on Linux, and from `kern.bootsessionuuid` on macOS (test).
  - done: impl-1615 · 2026-11-02T06:05:39.804Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C8. Host identity and heartbeat apply to the hub lock only, and the spend, territory, suite and termination locks write and read their records as before (test).
  - done: impl-1615 · 2026-11-02T06:05:40.619Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
- [x] C9. `daemon.test.ts`, `edges.test.ts`, `startup-cleanup.test.ts`, `territory-lock.test.ts` and `executor-spend.test.ts` pass with no test edited.
  - done: impl-1615 · 2026-11-02T10:23:40.749Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586

## Notes

Shared files: see Hot files

## Comments

### impl-1615 · 2026-11-02T05:44:27.417Z

Rule 20 inventory before editing: hub/src/hub/lock.ts owns LockHolder parsing, sync/async acquisition, break-guard recovery and release. Direct hub consumers: daemon.ts (opt-in here); cli/hub.ts (liveHolder), doctor/project.ts (liveHolderAsync), orphans.ts (readLock) are lifecycle migrations owned by T-1617. tracker/offline-migrate.ts acquires hub.lock offline but retains legacy acquisition pending lifecycle migration. Non-hub users unchanged: territory.ts, suite-lock.ts, termination-owner.ts, executor/droplet/{droplet,spend}.ts, orphans.ts's orphan-sweep.lock. Process-start helpers used by adapters/processes, system-processes, git-maintenance-owner, executor/local, watchdog, suite-command and tests retain semantics. Test/fixture inventory includes daemon, edges, startup-cleanup, territory-lock, executor-spend/safety/admission-lock/lock-liveness, orphan-sweep-lock/orphan-servers, suite-runner/close-component, pid-identity, process-started/system-processes, doctor, secrets/gateway-secrets, harness/native-process, cover-quiet, run-suite/memory-producer/measure-memory, host-boundary, suite-selection/task-selection/coverage and git-maintenance; old records remain compatible. Docs/briefs: hub/README lock entry, docs/spec/v0.4, qa/briefs/E-579; no wire shape changes or new frames. Shipped skills contain no raw lock record reader. New tests will exercise acquireLock and persisted lock/guard records with injected process/identity/clock seams named by the ticket; native boot reader exercised separately. T-1616 owns refresh/lost-lock lifecycle; T-1617 owns foreign-holder lifecycle clients.

### impl-1615 · 2026-11-02T05:47:48.835Z

Published lock format for T-1616/T-1617: hub acquisition calls acquireLock(path, processes?, {hostIdentity:{hostname,bootId,pidNamespace}, now?, lapseMs?}). Fields are additive beside pid/started/token; heartbeat is ISO wall time. Defaults HUB_LOCK_HEARTBEAT_MS=10000 and HUB_LOCK_LAPSE_MS=60000; exactly 60000 ms remains held. readLock preserves token/new fields. foreignLockHolder compares every component. Hub break-guard owner records carry the same identity/heartbeat; foreign guard owners use lapse without probing their PID. Invalid/missing heartbeat on a complete foreign identity stays held. Generic sync/async acquisitions keep prior serialized shapes. daemon native acquisition opts in; projectHub synthetic identity opts in, direct injected-process legacy fixtures stay native-probe-free. Heartbeat refresh and lost-lock shutdown remain T-1616; start/stop/status/doctor/orphan/offline-migrate fencing remains T-1617.

### rev-35 · 2026-11-02T06:10:01.647Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1615-source-1
commit: ce5f97c5872ac69c70445f13a6697ad6c2b6d3e4
scope: full
findings: [{"severity":"medium","text":"Main-lock heartbeat/text is captured before guard retries. The advancing-clock guard test installs heartbeat 05:00 at 05:01:01, so a foreign contender can immediately break the newly acquired lock. Stamp the main heartbeat at successful guarded installation and test delayed acquisition plus a fresh foreign contender.","file":"hub/src/hub/lock.ts","line":320},{"severity":"medium","text":"A present but malformed/incomplete hostIdentity is silently dropped and handled as legacy; a foreign hostname/boot record missing pidNamespace reaches local PID probes. Distinguish absent legacy identity from invalid new identity, preserve/refuse the latter without probing, and cover both main and guard records.","file":"hub/src/hub/lock.ts","line":173}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear: two medium findings at lock.ts:320 and :173. Concrete stale-heartbeat example is already present in the advancing-clock guard test; main text retains 05:00 after actual guard acquisition at 05:01:01. Partial new identities downgrade to legacy and reach holderAlive. Capture initial heartbeat on actual installation, and refuse/preserve invalid new identities without probes or deletion. A-15625 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15625-t-1615-source-review-at-ce5f97c58.md) records standards/spec review, scope and evidence limits. C1/C3/C4 failed, other criteria unverified. Periodic refresh and lifecycle reader migration remain T-1616/T-1617. Reviewer ran no tests/browser; reported local typecheck/lint and targeted passes do not establish queued/Linux/C9 final evidence. Fresh source review required before verification.

Criteria: C1 failed (Newly written main heartbeat can be older than the lapse because it is captured before acquisition retries.), C3 failed (A newly acquired live holder can be taken over immediately after delayed guard recovery.), C4 failed (Malformed new-format host identity is discarded before classification and can trigger local probes of a foreign PID.).

### impl-1615 · 2026-11-02T06:13:08.407Z

Source-review correction contract (consumers remain the full pre-edit inventory above): InvalidLockIdentity now refuses present but incomplete/malformed hostIdentity and heartbeat-only records, before PID probes or deletion. parseHolder/recordSync/recordAsync and readLock propagate this typed error rather than interpreting invalid identity as legacy or absence. Native lifecycle clients in T-1617 must preserve that refusal; offline migration uses the same parser through async acquisition. Existing genuinely old records and generic valid records retain prior rules. Main heartbeat is stamped inside each guarded installation attempt, after any guard retry. New regressions observed red (15 failures/11 passes) before the corrections: stale initial heartbeat was 05:00 instead of 05:01:01; malformed identity reached the kill(0) probe assertion. No post-review dev merge; only this review fix changes source.

### rev-35 · 2026-11-02T06:15:27.902Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1615-source-2
commit: 51320523569073a317068edc571b64230b09ec1b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at corrected head 51320523569073a317068edc571b64230b09ec1b; no findings. Prior C1/C3/C4 defects resolved: main heartbeat is serialized inside guarded installation after waits; delayed acquisition regression checks the actual stored timestamp and refuses a second foreign contender. Present invalid identity/heartbeat-only records propagate InvalidLockIdentity without PID probes/removal, with seven-shape main+guard preservation controls. Docs/skill and consumer refusal inventory updated; same-host/legacy/generic behavior remains. A-15635 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15635-t-1615-corrected-source-review-at-513205235.md). Reviewer ran no tests/browser. Reported local 26/26/typecheck green in A-15632 is not queued/Linux evidence; corrected-head lint pending separately. C1–C9 remain unverified until named same-head runtime evidence; prior C9 partial/known-baseline receipts keep their old head labels. No periodic refresh or lifecycle migration claim.

### rev-35 · 2026-11-02T06:57:03.116Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1615-evidence-1
commit: 51320523569073a317068edc571b64230b09ec1b
scope: evidence
findings: [{"severity":"medium","text":"Corrected-head native preservation run is exit1,17/18: known T-1627 adds verification-wait between stopping/socket-kept and stopped. C9 still requires all five files to pass. Coordinator42d8057e retains C9 and chooses shared-fix/new-head settlement; the failed receipt cannot be marked pass.","file":"hub/test/daemon.test.ts","line":583}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear for C9. A-15676 exact-head queued e7d1556b passed4725, T0/T1/allT2/Web; T3 deferred/T4 unexecuted. Named rows independently checked: lock-identity26/process-identity6/startup-cleanup4/executor-spend20 pass. Linux x64 droplet Node24.21/Nvim0.12.5, Headless Shell1248 Chrome156.0.8078.4, tree8713622d0c4929238ed5e4bb146612a67936738d, uncached; advisories report-only. A-15682 corrected-head Mac arm64 native edges4/territory20 pass; daemon17/18 exit1 actual ['stopping','socket-kept','verification-wait','stopped'] vs expected without verification-wait. C1–C8 otherwise established, but no new verified marks on this not-clear pass. Coordinator42d8057e chooses waiting for T-1627 landing, explicitly authorized dev merge, affected C9 reruns, delta source review and fresh verification; no criterion amendment or additional current-head rerun. A-15687 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15687-t-1615-evidence-settlement-pending-shared-t-1627.md) preserves all provenance and failure distinctions. Reviewer ran no tests/browser.

Criteria: C9 failed (Corrected-head daemon.test.ts is 17/18/native exit1 for known T-1627; Coordinator retains C9 and requires shared-fix/new-head evidence.).

### rev-35 · 2026-11-02T10:25:10.829Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1615-delta-source-1
commit: 75f80ea96f89cbfdc2bfb328ffb86e787a680586
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear, no findings. Parents513205235 prior reviewed head +67fa15ed5 landeddev/T1627; follows Coordinator42d8057e new-head path, not old evidence carryover. Lock/lock-identity/process-identity/T1615 tests and all5 C9 files unchanged; no combined hand-resolution hunks. Daemon retains early host-aware acquisition/currentclock, adds landed fakeHost registration at Store/config boundaries and shared synchronous stopWaitMetrics before stopping/await. Dispatcher/Suites clear same clock timer without changing lock release/owner. Other landed Host/inbox deltas do not edit item lock functions/generic format. A-15791 current-head Macarm64Node24.21 local/no browser raw daemon18/edges4/territory20 nativeexit0; formerly red stop identity now passes. This is targeted C9 subset, not queued coverage; C1–C9 await fresh exact-head suite facts, especially startup-cleanup/executor-spend. Old A-15676 green/A-15682 failed remain historical. A-15793 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15793-t-1615-authorized-merge-delta-review-at-75f80ea96.md). Reviewer read source/logs only,no tests/browser/edits.

### rev-35 · 2026-11-02T10:46:51.195Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1615-final-1
commit: 75f80ea96f89cbfdc2bfb328ffb86e787a680586
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear,C1–C9 verified,no findings. Independently matched A-15795 hub-lock-identity26/process-identity6/startup-cleanup4/executor-spend20 pass facts: full persisted fields/fresh heartbeat; generated foreign field differences and lapsed guarded takeover/noPIDprobes; malformed main+guard refusals; same-host/legacy shapes; sharedLinux+Darwin readers; generic lock preservation. C9 literally complete at current head: A-15791 raw nativeMac daemon18/edges4/territory20 named outcomes with per-file nativeexit0/signalnull/head; formerly failing stop boundary now green, all5 files unchanged. Macarm64Node24.21 local/no browser,targeted separate from Linux; old failedA-15682/oldgreenA-15676 stay historical. Exact-head60a1c8de exit0/4753pass/zero fail,cancel,skip,todo;T0/T1/all fallbackT2/selectedT3fakeSSH9/Web complete,remainingT3 batch,T4 unexecuted. Changednative baseonce/no reps;6.482s selected added wall excludesmachinewait,not suite walltime. Linuxx64 6.8.0-142-generic c8nyc1 Node24.21/Nvim.12.5 workers2;treef508711fefc27154c1cfaf4f150546bd6a70c186;isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4;cache/occasionnull,skips[],skipreasonreport/missing0. Lint/duration/ratchet advisoryonly;executor1163s not suitewall. QA affected/after-stage unchanged. A-15796 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15796-t-1615-final-evidence-review-at-75f80ea96.md). Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.
