---
id: T-1666
kind: task
title: Host revoke and remove settle the host agent's session generations first, or name what they leave
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1607
  - T-1606
  - T-1603
  - T-1678
topic: topic-1382
branch: t/T-1666-host-revoke-and-remove-settle-the-host
created: 2026-11-03T22:56:19.713Z
updated: 2026-11-04T17:24:23.891Z
---

## Summary

Revoking or removing a host currently cuts its authority before any later Host call, so detached session workers survive and the agent's per-generation state is left on the host: launch records, released receipts and private config files. Revoke and remove should first settle every generation on that host through the agent's own cleanup operations, or report by name each generation they could not settle.

## What to build

Before the authority cut, revoke and remove run a bounded pre-revoke step through the still-authorised Host:
- they stop the live sessions on that host;
- they release and forget each released or cleanup-incomplete generation, using the agent operations from T-1607;
- they then cut authority.

A step that cannot finish within its deadline still cuts authority. Its report names each generation left behind and what remains: a worker, a receipt or private files. Nothing is cleaned through a revoked Host.

Found during T-1607 (coord decision 2026-11-03).

## Acceptance criteria

- [x] C1. Revoking a host with a live Claude, Codex and OpenCode session stops each one and leaves no launch record, receipt or private config file on the host (test, fake host).
  - done: impl-1666 · 2026-11-04T17:22:52.323Z
- [x] C2. When the pre-revoke step cannot reach the agent, revoke still cuts authority within its deadline, and its output names each generation it left and what remains (test).
  - done: impl-1666 · 2026-11-04T17:00:37.593Z
- [x] C3. No Host call reaches the agent after the authority cut (test).
  - done: impl-1666 · 2026-11-04T15:10:32.513Z

## Comments

### coord · 2026-11-04T14:54:44.433Z

Scope decision (coord, 2026-11-04 14:55Z): T-1666 covers revoke only; no remove command exists yet. The settlement is one reusable, bounded operation, documented in docs/agents/host-agent.md, for E-1533's future remove or destroy to call. C1–C3 apply to revoke.

### impl-1666 · 2026-11-04T14:55:35.115Z

Before-edit consumer sweep: searched host.revoke/revokeHost, hostControl, adopt-claude/remove-claude/forget-claude, localHost/testHost spreads across hub/src, hub/test, nvim/test, shared, web/src, docs, skills and QA. Production: Dispatcher + CLI host + usage, Sessions, processHost, SSH Host, agent server/Claude receipts; wire/protocol/web-authority only frame admission unaffected. Existing recording Hosts and fakes remain structural (no required Host member planned). Previous revoke reply stays compatible via additive cleanup field; CLI accepts old missing field. host-secret-admission and CLI help fixtures consume revoke. Remote adapter/native, host SSH/layout/discovery/transport/supervisor/recovery/restart tests are preservation scope. QA stage2/stage4 historical briefs unchanged; stage5 QA none. Coord decision: revoke only, reusable pre-cut entry documented for future provider removal.

### rev-36 · 2026-11-04T15:14:32.742Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1666-source-1
commit: eb78e27c0a6fb458034950ea2f3ed22e13f6a500
scope: full
findings: [{"severity":"medium","text":"Pre-cut steps capture sessionId/generation but later stop by display name; rename/name reuse during an earlier awaited step can stop an unrelated replacement (including another host) and clear the wrong generation. Pin and revalidate durable session/host/generation through the lifecycle.","file":"hub/src/adapters/sessions.ts","line":111},{"severity":"medium","text":"Calling #stopFailedLaunch while that session is already in #stoppingLaunches returns immediately at1021; settler then deletes its pending report entry despite held native cleanup. Join the existing producer or retain an incomplete leftover until durable cleanup receipt clears.","file":"hub/src/adapters/sessions.ts","line":115},{"severity":"medium","text":"C1 integration is not exercised: fakeHarness.stop is replaced with synthetic host.stop/removePath of harness-label strings. Use production adapters on the fake host and assert actual workers, launch records, released receipts and private generation files are gone, plus post-cut request fencing.","file":"hub/test/host-revoke.test.ts","line":22}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear; A-16589. Standards:2 medium ownership findings; Spec:1 medium integration-proof gap. Preserve2s cut/revoke-only scope approved by Coordinator1a0d7807. Pin captured sessionId/host/generation instead of later display-name lookup; join held failed-launch producer rather than accepting #stoppingLaunches no-op as completion; add actual three-adapter fake-host generation cleanup/post-cut receipt coverage. C1/C2failed,C3runtime-unverified. Preliminary7/typecheck evidence is local; serial native preservation pending and loaded interruption remains unclassified. No queued/QA/final pass claimed. Reviewer made no edits or test/check/probe/browser execution; fresh source review required before verify.

Criteria: C1 failed (Settlement targets can resolve by a reused display name, and current fake-adapter test does not prove real three-harness generation cleanup.), C2 failed (Already-running failed-launch cleanup can return a no-op and disappear from leftovers before native/private cleanup completes.).

### impl-1666 · 2026-11-04T15:29:03.640Z

Correction consumer sweep before optional HarnessAdapter.releaseHostGeneration: production owners contract/index, Sessions, ClaudeCodeAdapter, CodexAdapter, OpenCodeAdapter; all adapter test fakes/recorders remain structural because method is optional. Searched HarnessAdapter/implements/stop/settleFailedLaunch across hub/src/adapters, all hub/test and nvim/test, shipped skills/docs/QA. Sessions alone calls the optional hook after a positively completed generation-pinned stop; OpenCode alone implements it using its existing serverFiles owner. Normal stop/resume retains existing files. Claude existing stop already releases private generation files/receipt; Codex carries MCP config in argv and already removes socket after stop. New native regression must assert absent OpenCode opencode.json/password, not merely stopped worker/forward. No wire or Host member change.

### impl-1666 · 2026-11-04T15:30:42.699Z

A-16589 corrections: reproduced two exact red T2 regressions then green: renamed/reused display name cannot inherit captured stop authority; existing failed-launch settlement joins its producer and keeps pending receipt named at fake deadline. Native production-adapter test added (actual worker/receipt/private-file observations, released Claude fault, no post-cut SSH calls). Supplementary native pass8.192s predates final OpenCode retirement hook/config absence assertions; those latest native assertions still pending lock. Optional releaseHostGeneration consumer inventory recorded before editing. T-1678 owns shared post-turn refusal; failure evidence handed off as A-16592, diagnosis held; Coordinator-authorised existing hook-writer join cited beside setup. No native full preservation or Linux pass claimed.

### rev-36 · 2026-11-04T15:34:03.754Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1666-source-2
commit: 1a7df44d98d5dd0c5d0911b6cd979cad0d4e8404
scope: full
findings: [{"severity":"medium","text":"Retirement hooks are enumerated only for running/unarchived rows. Normal OpenCode stop deliberately retains config/password and marks its row stopped; a later revoke skips its new releaseHostGeneration hook, inventories only Claude records, and can report empty leftovers while those private files remain. Track retained generation obligations and cover normal-stop→revoke through the production fake host.","file":"hub/src/adapters/sessions.ts","line":108}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source not clear; A-16597. Prior durable-identity and in-flight producer findings fixed, and actual three-adapter T3 source now supplies required native/file assertions. One medium scope gap remains: activeOnHost filters stopped rows, but OpenCode normal stop retains resume config/password, so later revoke never invokes the new retirement hook and Claude-only inventory misses those files/leftovers. Preserve normal stop semantics; track retained obligations and test stopped-generation retirement. C1failed; C2 source fix acknowledged, C2/C3 runtime-unverified. Current-head native hook/absence test and12-file preservation pending; older8.192s native sample is pre-hook only. Respect Coordinator11064f7c sharedT1678 block: no diagnosis/verify requested until authorised merge and fresh review. Reviewer no execution/edits/browser/delegation.

Criteria: C1 failed (Already stopped OpenCode private generations are excluded from pre-cut retirement/reporting; retained config/password can survive a clean revoke report.).

### impl-1666 · 2026-11-04T15:47:18.474Z

A-16597 correction: stopped host-generation retirement receipts now survive archive/prune and restart, contain no account environment/brief/usage, and grant metadata cleanup only. Revoke streams host-indexed obligations plus legacy stopped OpenCode rows inside the existing deadline, yields every32 records, and checkpoints completed rows. Settler underlying work is joined before storage closes. Production OpenCode/recording-Host tests prove normal stop retains config/password, then restart+pruned-row or legacy-row retirement removes them with no further signal. A256-receipt work-bound control cuts after <=32 records and retains all256 unexecuted obligations. Consumer sweep for process schema: ProcessTable and Sessions own new table/checkpoint; orphans selects explicit existing local columns; QA E-1531 probes select explicit existing fields and host membership, unaffected. host-registry legacy-schema fixture exposed dependent index/drop-column failure, migrated to remove all host-dependent indexes by SQLite introspection before constructing legacy schema; its4 cases pass. No required unedited native file changed. Shared T-1678 native block remains; no native execution or dev merge.

### rev-36 · 2026-11-04T15:52:54.669Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1666-source-3
commit: 5e5b1adb2a188a2948c31c5cbfb20b76abfb7718
scope: full
findings: [{"severity":"medium","text":"Retirement receipts are written only by explicit #stop. OpenCode positively settled normal exits retain config/password then mark status exited; active inventory selects running and legacy fallback selects stopped only. Natural-exit→revoke/archive/prune/restart still leaves private generation files with an empty leftover report. Capture the positive terminal boundary and cover exited legacy ownership conservatively, with production-adapter regression.","file":"hub/src/adapters/sessions.ts","line":2127}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-16611. Explicit-stop/pruned/restart correction now has indexed metadata-only receipt, deadline-yield/work join and real-file recording-Host tests; earlier identity/producer fixes intact. One related medium terminal gap: opencode.#settleExit confirms native closure but retains config/password, calls Sessions.#exited; no retirement receipt and no exited fallback. Retain at positive native closure, not status alone, and cover exited/restarted/pruned/legacy obligations without recovered signal authority. C1failed,C2/C3runtime-unverified. A16607 lower-tier/typecheck/lint preliminary; native/preservation unexecuted under T1678 block. No native diagnosis/verify requested before shared fix/authorized merge/fresh review. No Reviewer execution/edits/browser/delegation.

Criteria: C1 failed (Normal exited OpenCode generations still lack retained cleanup ownership and are excluded from revoke inventory/reporting.).

### impl-1666 · 2026-11-04T15:55:27.158Z

Before terminal receipt contract change (A-16611): searched AdapterHost/exited/retirement/retainedHostGenerations and all status exited writes/callers across production, all hub/test and nvim/test, docs/skills/QA/shared. Existing exited callback does not uniformly prove native closure (resume failure and generic observations also call it), so no blanket status-based deletion authority. Plan additive optional AdapterHost.hostGenerationClosed(capturedProcess) only after OpenCode positive tree/client/forward settlement, before terminal notice; Sessions persists the metadata retirement receipt through same owner validator used by explicit stop. Structural AdapterHost fakes remain valid. Legacy exited rows get named unknown-native-closure leftovers, never new signals or status-derived deletion. Old wire frames stay unchanged. Native fixture fresh completion count fix from lead T-1678 will be source-only until Coordinator-authorised merge.

### impl-1666 · 2026-11-04T16:06:49.451Z

A-16611 correction: new optional AdapterHost.hostGenerationClosed is emitted only after OpenCode owned-tree/client/forward settlement, before terminal notice; Sessions validates captured durable identity and persists retirement via the same owner helper as explicit stop. Generic exited status never grants cleanup. Retained records now distinguish confirmed/unknown closure; old positive retirement receipts remain compatible, but legacy terminal rows lacking them are named incomplete with private files retained. Prune/name replacement/rename replacement preserve unknown legacy obligations before display-row loss. Production OpenCode recording-Host exit/restart/archive/prune controls reproduced exact red (private files silently left; absent incomplete report), then green; stop/exit × positive/legacy/pruned legacy matrix passes with no recovered signal. Current light run28/28, hub typecheck green. Native fixture now arms a fresh pre-delivery completion count and joins turn-end writers per lead T-1678; no native run or dev merge under the Coordinator block. Full T0 earlier correction tree passed; refreshing final lint before new source review.

### impl-1666 · 2026-11-04T16:14:06.443Z

Additional generation-identity control reproduced red: two native generations sharing one stable session id overwrite one retirement receipt (1 != 2). Extending the same receipt module to key by captured native generation, keep old storage rows readable, and clear only the exact captured owner. Unknown older native generations sharing a private-file location will fence deletion by a later generation and remain named. This is within the requested per-generation settlement, not a native-stop policy change. Consumer sweep: retainedHostGenerations/retainHostGeneration/clearHostGeneration used only by ProcessTable, Sessions and host-revoke tests; nativeClosure optional old record parsed in one module, no public frame/client shape changes. Continuing light/source work only under T-1678 block.

### rev-36 · 2026-11-04T17:00:10.933Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1666-source-4
commit: 9f7450ed0988e0d5f2f4b9da2d3b71e046df5a02
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-16634, no findings. Prior identity/producer/native-test/stopped-and-exited retention gaps resolved. Optional positive OpenCode joined-closure callback persists exact owner before terminal notice; native-generation keys/exact clear/old storage compatibility preserve older unknown workers and fence shared files. Legacy status grants no signal/deletion authority. Indexed/yielded metadata scan, bounded partial inventory, residual file/admission reporting, joined storage lifecycle and post-cut warm-up fences checked; matching docs/consumer inventories/tests retained. T1672 rename scope remains separate per Coordinatorfe8bf627. C1–C3 runtime-unverified; C2 prior source finding resolved, implementation done mark needs restoration. A16632 local check/37focused preliminary only. Current T3/native+12 unchanged preservation unexecuted; older stale-setup samples not coverage. Coordinator11064f7c T1678 block remains: no verify/native diagnosis until shared fix + explicit authorized merge, then fresh changed-head review and required serial evidence. Reviewer no execution/edits/browser/delegation.

### impl-1666 · 2026-11-04T17:11:05.584Z

Rule 20 reboot seam sweep: searched retainHostGeneration, retainedHostGenerations, harness_host_retirements, nativeClosure, pendingStops, stages.stopped, stopIntent, hostGenerationClosed through hub/src, hub/test, nvim/test, docs and shipped skills (117 matches). Consumers: Sessions registration, failed-stop timer/restart/lifecycle, explicit revoke and retained metadata scan; ProcessTable persistence/prune/rename; OpenCode positive closure producer; dispatch/requests pending-stop projections; host-revoke/settlement, session-host/routing, name-reservation, process-identity/system-processes, Claude/Codex cleanup tests. Additive marker stays private in durable PendingStop, existing session.list projection unchanged. Existing Host/agent frames, recording Hosts, held-receipt helpers, T3/T4 raw readers and startup probes are unchanged. hostBootChanged is shared with T-1613 (identical canonical predicate from ad51d375a), no parallel parser. Reboot entry records closure only and fences native/file retries while preserving pending undo and all harness retirement obligations.

### rev-36 · 2026-11-04T17:19:37.924Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1666-source-5
commit: 94ff42843ff83eb060701e729075fcfc95e0e5fe
scope: full
findings: [{"severity":"medium","text":"Captured-Host native fencing reads only the retirement row's reboot marker. Successful metadata cleanup calls clearHostGeneration at193 and deletes that row before the final authority cut/later inventories; old captured run/spawn/stop/launchClaude/adopt calls become allowed again. Keep an independent exact-generation native fence and test receipt-clear→held inventory→pre/post-cut zero underlying native calls.","file":"hub/src/adapters/sessions.ts","line":225}]
finding_counts: {"high":0,"medium":1,"low":0}

Changed-boot source not clear; A-16646. Coordinator9c5bf89e scope checked; requested public exact-owner closure/pending undo/shared canonical boot policy present. One medium authority-lifetime issue: guard at225 depends on retirement record erased after metadata hook at193; before cut, later awaited inventory permits old captured Host native calls again (run/spawn lack old-PID downstream fence). Preserve independent generation fence through resource completion and add exact boundary regression. Prior source A16634 unaffected otherwise; C1failed,C2/C3runtime-unverified. Local50+99/check evidence preliminary only. T1678 block remains, no native diagnosis/verify/dev merge requested. Reviewer no execution/edits/browser/delegation.

Criteria: C1 failed (Changed-boot metadata retirement deletes its only native-operation fence before authority cut, reauthorizing captured old-generation Hosts.).

### impl-1666 · 2026-11-04T17:20:58.327Z

Review A-16646: confirmed red with new T2 completed-metadata/held-inventory boundary: captured old-boot native call reaches underlying Host after resource row deletion. Sweep hostGenerationRebooted/retainHostGeneration/persistence names through hub/src, hub/test, nvim/test, docs and skills: only Sessions captured-host/revoke guards and ProcessTable marker persistence consume the fence; projections and agent frames unchanged. Will store exact-generation boot fences independently of resource receipts with indexed lookup, no startup/history scan, retain old receipt compatibility through lazy preserve-before-clear, and add storage-reopen evidence. No native/verify/dev merge while T-1678 blocked.

### rev-36 · 2026-11-04T17:24:23.891Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1666-source-6
commit: fe72f1d7f30a804f59546c699b10c1e29c6d0768
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Changed-boot correction source clear; A-16648, no findings. Independent indexed exact-generation reboot fence now survives resource deletion/reopen/replacement; old resource markers preserve fence before clear. Captured Host copies native identity; all5 native methods check fence while reads/metadata remain available. Exact held-post-retirement two-storage-shape regression and new-birth positive control address A16646. Public signature unchanged, shared canonical policy/exact current-or-pending owner/preserved undo/all-harness resources and earlier settlement source reviewed. C1–C3 runtime-unverified. A16647 local52focused/99recovery/check evidence preliminary only; no current native12-file preservation/Linux/browser/verify. Source clear does not release Coordinator11064f7c T1678 block: await shared fix + explicit merge instruction, changed-head review, serial native/preservation and mode-free evidence. Reviewer no execution/edits/browser/delegation.
