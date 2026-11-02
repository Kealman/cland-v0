---
id: T-1615
kind: task
title: The hub lock records its host identity and a heartbeat
state: closed
status: done
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
updated: 2026-11-02T15:14:39.318Z
closed: 2026-11-02T15:14:39.318Z
---

## Summary

A new hub lock records the holder's host identity (hostname, boot id and PID-namespace id) and a heartbeat time beside its pid, start time and token. A contender whose identity differs in any part never probes the holder's pid. It refuses the start while the heartbeat is fresh, and breaks the lock through the existing `hub.lock.break` guard only after the heartbeat has lapsed. Records with the contender's own identity, and records in every older shape, keep today's rules.

Hot files: `hub/src/hub/lock.ts`, `hub/src/process-identity.ts` [E-1532: one boot-id reader], `hub/src/hub/daemon.ts` (acquire call only), new `hub/test/hub-lock-identity.test.ts`

## Acceptance criteria

- [x] C1. A hub lock written by a new hub carries the holder's hostname, boot id and PID-namespace id (null where the platform has none) and a heartbeat time, beside its pid, start time and token (test).
  - done: impl-1615 · 2026-11-02T06:13:56.252Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.194Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.879Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.465Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C2. A lock whose host identity differs from the contender's in any part and whose heartbeat is younger than the lapse refuses the start with `HubLocked`, even when its pid is not alive on the contender's machine (test).
  - done: impl-1615 · 2026-11-02T06:05:33.992Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.879Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.465Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C3. The same foreign lock with a heartbeat older than the lapse is broken through the `hub.lock.break` guard, and the contender takes the lock whole (test).
  - done: impl-1615 · 2026-11-02T06:13:57.268Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.879Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.465Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C4. The pid of a foreign record is never probed with a signal or `ps` on the contender's machine (test).
  - done: impl-1615 · 2026-11-02T06:13:58.314Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.879Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.465Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C5. A lock with the contender's own host identity keeps today's pid, start-time and pid-reuse rules (test).
  - done: impl-1615 · 2026-11-02T06:05:37.837Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.879Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.466Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C6. Records without the new fields, in each older shape (pid alone, with `started`, with `startedUtc`, with `token`), keep today's rules (test).
  - done: impl-1615 · 2026-11-02T06:05:38.868Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.879Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.466Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C7. The boot id comes from the reader `process-identity.ts` already uses on Linux, and from `kern.bootsessionuuid` on macOS (test).
  - done: impl-1615 · 2026-11-02T06:05:39.804Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.879Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.466Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C8. Host identity and heartbeat apply to the hub lock only, and the spend, territory, suite and termination locks write and read their records as before (test).
  - done: impl-1615 · 2026-11-02T06:05:40.619Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.880Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.466Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762
- [x] C9. `daemon.test.ts`, `edges.test.ts`, `startup-cleanup.test.ts`, `territory-lock.test.ts` and `executor-spend.test.ts` pass with no test edited.
  - verified: rev-35 [reviewer] · run rev-35-1615-final-1 · 2026-11-02T10:46:51.195Z · commit 75f80ea96f89cbfdc2bfb328ffb86e787a680586
  - done: impl-1615 · 2026-11-02T11:15:23.099Z
  - verified: rev-35 [reviewer] · run rev-35-1615-final-2 · 2026-11-02T11:36:15.880Z · commit cd3f696747147ecadd1013b011b1a91813ccec13
  - verified: rev-35 [reviewer] · run rev-35-1615-final-3 · 2026-11-02T14:28:54.466Z · commit 057ad4b9fdea7a5a47968e8dc486dcba38893762

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

### rev-35 · 2026-11-02T11:16:22.433Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1615-delta-source-2
commit: cd3f696747147ecadd1013b011b1a91813ccec13
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Second authorized delta source clear,no findings. Read actual Coordinatorafeb1020: merge4e8aa7ee now, preserve skill sections, native subset/delta/freshverify. Parents75f80ea96+4e8aa7ee8; no lock/lockidentity/processidentity/daemon/itemtest/C9file changes vs prior reviewed head. Combined skill hunk retains complete T1615 and landedT1591 sections; independently checked every heading from each parent in skill/README,none missing. README auto-adds Git socket guidance. Landed Git daemon/proxy modules introduce no hub-lock option/ownership-format consumer; localHost/env/socket imports separate from unchanged acquisition path. Prior lock semantics/generic behavior/doc review carries; no new authored feature. A-15801 currenthead Macarm64Node24.21 native daemon18/edges4/territory20 exit0 reported,targeted/no browser; new queued lockidentity/startup/spend facts still required. Old75f80ea96/60a1c8de remains historical; C1–C9 no new marks until currenthead runtime evidence. A-15802 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15802-t-1615-second-authorized-merge-delta-at-cd3f69674.md). Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T11:36:15.880Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1615-final-2
commit: cd3f696747147ecadd1013b011b1a91813ccec13
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Refreshed final clear,C1–C9 verified,no findings. Independently matched new-head A-15805 named lockidentity26/processidentity6/startupcleanup4/executorspend20/fakeSSH9/Gitdaemon4 pass facts. Unchanged C1–C8 source+new outcomes preserve full fields/freshheartbeat, foreign/malformed noPIDproof and lapseguard, samehost/legacy/generic shapes/sharedLinux+Darwin readers. C9 A-15801 rawMac daemon18/edges4/territory20 named outputs match currenthead nativeexit0/signalnull receipts; combined with new queued startup4/spend20 all5 unedited files pass. Macarm64Node24.21 localnobrowser distinct from Linux. Prior75f80ea96/60a1c8de and failures historical. Queued0f0fc342 exacthead exit0/4757pass/zero fail,cancel,skip,todo;T0/T1/allfallbackT2/selectedT3twofiles13cases/Web complete,remainingT3 batch,T4 unexecuted. Baseonce/no reps;6.469s selectedaddedwall excludesmachinewait,not suitewall. Linuxx64 6.8.0-142-generic c8nyc1 Node24.21/Nvim.12.5 workers2;tree2189e94a4e12dfb1f959ee2fae1586d7e84262b3;isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4;cache/occasionnull,skips[],skipreasonreport/missing0. Budget/lint/ratchet advisoryonly,QAaffected/afterstage unchanged,no fullpremerge claim. A-15806 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15806-t-1615-refreshed-final-evidence-at-cd3f69674.md). Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.

### impl-1615 · 2026-11-02T13:18:35.066Z

Batch regression diagnosis and rule20 sweep BEFORE fix: production cannot hit this mismatch on a real same-machine restart: both serveProject/native CLI acquisitions capture lockHostIdentity() from the same hostname/boot/PID namespace; genuine differences remain foreign and never authorize local PID probes. The failed fixture deliberately transitions startDaemon -> pacingOwner -> default projectHub, which injects literal {hostname:'fixture',bootId:'fixture',pidNamespace:null}. Local unchanged cd3f69674 reproduces all four named SIGKILL cases (5/9 pass, native exit1); first case minimized to ~1s with the exact HubLocked symptom. No zombie-only/Linux-only explanation: macOS reproduces after native exited receipt.
Sweep covers hub/test, nvim/test, web/test, functions/import aliases and literal spawned hub serve/SIGKILL, plus wrapper callers. Actual affected hit: telegram-polling-restart.test.ts first two Telegram cases and discordHistoryCrashOwner (two Discord cases). These will use captured native identity through an optional pacingOwner->ProjectHubOptions lockIdentity seam, with a T2 fixture regression. No production foreign-policy change.
Unchanged mixed/default candidates inspected: daemon.test.ts/open.test.ts/cli.test.ts use separate fresh-root tests (or CLI reuses an existing embedded hub); worktree-cli.test.ts native replacements stay native while embedded hubs use different roots; doctor-isolation.test.ts embedded root differs from both native roots; release.test.ts uses probes:native; task-migrate.test.ts native crash scenarios restart via nativeHub, embedded cases follow released offline migration locks; tracker-ready-native.test.ts direct serveProject uses native identity; account-fixture-isolation.test.ts native and direct hubs use separate roots. opencode-launch-policy.test.ts 'serve' starts the harness, not a hub. test-lint.test.ts references are source-string fixtures. harness.ts is the shared option type/seam.
Native-alias lifecycle/control families preserve native identity and are unaffected: role-integrity, codex-adapter, claude-code-sessions-lifecycle, session-resume-lifecycle, executor-safety, verdict-commit, cli-identity, opencode-adapter, session-holds, claude-code-adapter, account-limited, lead-routing-process, account-poller, executor-droplet, accounts, orphan-servers, session-async-processes-lifecycle, visibility, opencode-database, claude-code-accounts, default-subscriptions-lifecycle, stage-qa, merge-recovery-native, scenarios/hub-lifecycle. project-hub-lifecycle selects nativeProjectHub/startDaemon on independent roots.
Wrappers followed: remote-fixture/suite-fixture/close-run-fixture choose native or embedded initially; suite-close-recovery and demo crash paths restart native; merge-support/merge-native-support/release-support/stage-qa-support embed nativeProjectHub. telegram-pacing-fixture/discord-workbench-fixture and other pacingOwner consumers have no preceding native hub except the affected restart file. nvim native client/criteria/explorer/sessions/layers/palette fixtures never reopen through default projectHub; nvim embedded/scenario fixtures stay embedded. web/harness restarts through the same embedded startHub callback; custom accounts startHub remains embedded; readme/native CLI fixtures stay native and never transition. No additional same-root native-to-default identity transition found. Fix remains local pending T-1588 landing per Coordinator.

### rev-35 · 2026-11-02T14:05:17.117Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1615-source-3
commit: 057ad4b9fdea7a5a47968e8dc486dcba38893762
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh fixture+integration sourceclear,no findings. Read Coordinatoreffe9b05/c760c0b4: native→synthetic fixturemismatch fixedwithout weakeningproductionforeignpolicy. Three crashowners(fourcases) capture native lockHostIdentity and forward typedoptionalidentity through pacingOwner/ProjectHubOptions; defaultfixtureidentity preserved. NewT2 control proves foreignrefusal/noPIDprobes/unchangedrecord, matchingdeadholderreclamation via durablepid/identity/newtoken/exactsingleprobe/finalremoval. Itemcrosspackage direct/alias/wrapper sweep reviewed; existingT3 SIGKILL/effect/nativeexit/drain assertions retained. Productionlock/lockidentity/daemon unchanged. Mergedprocess-identity exactlydev,soleLinuxparser+bootreadersagent/identity with publicreexport; lockimport unchanged. Independentparentheading inventory skill/README none missing. All5C9files unedited. A-15859 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15859-t-1615-crash-fixture-and-shared-identity-source-review-at-057ad4b9f.md). C1–C9 pendingnewhead runtime: fresh modefree queued27/identity/startup/spend,currentC9native subset and explicitCoordinatorrequiredTelegram9 atreviewedhead. PremergeA15844nine/localmerged27/typecheckreports targetedonly,oldbatchfailure historical. Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T14:28:54.466Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1615-final-3
commit: 057ad4b9fdea7a5a47968e8dc486dcba38893762
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1615 final evidence review at 057ad4b9fdea7a5a47968e8dc486dcba38893762.
Scope: evidence. Source remains clear under rev-35-1615-source-3 / A-15859; branch tip still equals the reviewed commit.

Standards: no findings. Spec: no findings. C1–C9 verified at this head.

Independently streamed A-15868's actual named timing outcomes, apart from overall exit:
- hub-lock-identity: 27 pass, including whole record publication, foreign hostname/boot/namespace freshness and guarded lapse, no foreign PID probes, same-host and legacy shapes, generic lock compatibility, malformed identity refusals, and native-to-embedded handoff preserving foreign refusal.
- process-identity: 6 pass; startup-cleanup: 4 pass; executor-spend: 20 pass.
- telegram-polling-restart: all 9 pass remotely, including both Telegram SIGKILL boundaries, both Discord history SIGKILL boundaries, abandoned setup cleanup and full newest-500 history receipt.

A-15861's same-head native logs and native exit receipts were independently checked: daemon 18, edges 4, territory-lock 20, Telegram restart 9, lock identity 27, all pass/native exit 0/signal null on local macOS arm64 Node 24.21.0, no browser. This supplies the unchanged native subset of C9; the queued startup and spend controls supply its remaining files. Source review established all five C9 files remain unedited.

Queued run b3e75944-e2fa-4c26-ab45-d0a21a73bd88 / A-15868: exit 0, 4829 pass, zero fail/cancel/skip/todo. T0/T1/fallback all T2/Web completed; selected T3 six files/44 passing identities executed once for task duration checks. Remaining T3 is deferred to the merge batch; T4 unexecuted. This is task verification, not full merge-batch coverage.

Recorded provenance: tree 9c29d82b26b298a8e0744a292f6debec5030c942, uncached droplet c-8 sfo2, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing 156.0.8078.4. Host typecheck used that tree and was not repeated remotely. Budget/lint/skip-reason checks report-only; skips [] and missing reason count 0. Lifetime 1177 s and cost $0.0817 describe executor billing, not suite wall time. Timing projections are not execution evidence.

Prior failed batch receipts remain failed history. QA remains affected/after-stage. Reviewer ran no tests or browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.

### coord · 2026-11-02T15:14:39.318Z

Merged b3d1cc0d39967baef89f71f85c12065b9b5e34be onto dev.
