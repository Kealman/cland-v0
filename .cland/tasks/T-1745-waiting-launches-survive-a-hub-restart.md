---
id: T-1745
kind: task
title: Waiting launches survive a hub restart
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1744
topic: topic-1439
branch: t/T-1745-waiting-launches-survive-a-hub-restart
created: 2026-11-07T16:01:58.235Z
updated: 2026-11-08T08:52:46.064Z
closed: 2026-11-08T08:52:46.064Z
---

## Summary

Waiting launches are durable in `hub.db`. After a hub restart, each waiting launch comes back with its reason and its original since, and is re-evaluated by the scheduler. No launch is placed twice. A waiting launch whose role or pool was removed meanwhile is dropped, and the Coordinator gets one line saying which launch and why.

## What to build

The persistence of T-1744's waiting record:
- written when a wait starts, updated on a reason change, and deleted on placement or cancel;
- read back once at hub start, before the scheduler's first pass;
- placement is idempotent: a record is deleted in the same step that publishes the session row, so a crash between them cannot launch twice.

The drop line is an Agents notice addressed to `coordinator`, one per dropped launch.

## Acceptance criteria

- [x] C1. After a hub restart, each waiting launch is listed again in `cland session list` and the inbox frame with its reason and its original since (test).
  - done: impl-1745 · 2026-11-08T07:39:41.757Z
  - verified: rev-35 [reviewer] · run rev-35-1745-final-1 · 2026-11-08T08:15:03.755Z · commit ef3c671ffcd091ebe9422756ee2996888d0f2225
- [x] C2. After a restart, a restored waiting launch is placed once when room appears, and a launch already placed before the stop is not restored (test).
  - done: impl-1745 · 2026-11-08T07:52:44.408Z
  - verified: rev-35 [reviewer] · run rev-35-1745-final-1 · 2026-11-08T08:15:03.755Z · commit ef3c671ffcd091ebe9422756ee2996888d0f2225
- [x] C3. A waiting launch whose role was removed from `roles.toml`, or whose pool was removed from `config.toml`, during the stop is dropped at start, with one Agents line to the Coordinator naming the launch and the reason (test).
  - done: impl-1745 · 2026-11-08T07:39:42.147Z
  - verified: rev-35 [reviewer] · run rev-35-1745-final-1 · 2026-11-08T08:15:03.755Z · commit ef3c671ffcd091ebe9422756ee2996888d0f2225
- [x] C4. A launch cancelled before the stop is not restored (test).
  - done: impl-1745 · 2026-11-08T07:21:55.129Z
  - verified: rev-35 [reviewer] · run rev-35-1745-final-1 · 2026-11-08T08:15:03.755Z · commit ef3c671ffcd091ebe9422756ee2996888d0f2225

## Blocked by

- T-1744

## Notes

- Hot files: `hub/src/host/pool-runtime.ts` (or a new `hub/src/host/waiting-launches.ts`), `hub/src/hub/store.ts` (table), `hub/src/hub/daemon.ts` (restore at start).
- Tests: new `hub/test/waiting-launch-restart.test.ts` (T2, `projectHub` stop and start on one root).
- Serves epic C3.

## Comments

### impl-1745 · 2026-11-08T07:14:01.732Z

Rule-20 sweep before changes: waitingLaunches/WaitingLaunch/session-waiting/launchOrWait/waitingPool consumers searched across repo. Production: adapters/{sessions,requests,waiting-launches,processes,index}, hub/{daemon,dispatch,core,inbox,agents-topic,store}, protocol; CLI session, web inbox/overview and Neovim inbox consume unchanged waiting shape. Tests: waiting-launch, waiting-launches-owner, session-pool-placement, processes, agents-topic, inbox and wire conformance; generated nvim fixtures remain unchanged. New durable record stores request plus actor name/sessionId; no reply/frame change. ProcessTable.put consumers require preserving existing transaction behavior. Will enumerate runtime importer tests before review.

### rev-35 · 2026-11-08T07:26:49.201Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1745-source-1
commit: 6106f1ff410c0e533e2aca37ae5baf711f6e3358
scope: full
findings: [{"severity":"high","text":"Atomic wait deletion is keyed only by p.name in every ProcessTable.put. Idle worker reuse can publish current.name different from admitted request.name, leaving the requested wait durable until a later queue callback and replayable after a crash. Unrelated resume/restoreRow writes can instead erase a queued wait without its admission. Carry an explicit exact waiting-record publication receipt through fresh and reused publication, deleting only that admitted record transactionally; author20c3d13b confirms.","file":"hub/src/adapters/processes.ts","line":247},{"severity":"medium","text":"Restored authorization does not preserve live retainedAuthorize validation. actor:null skips all checks; otherwise only current role permission is checked, omitting newly reserved human user target names and the original inferred-role condition. Persist the admission context and share the live validator for human and session actors across restart/await boundaries; author5c946b93 confirms no approved policy change.","file":"hub/src/hub/dispatch.ts","line":535},{"severity":"medium","text":"Restoration rebuilds row/request but not typed #memoryBlocked host/byte evidence. A generic first capacity refusal rewrites the original memory reason without a fresh memory or readiness observation. Persist/reconstruct the evidence under its existing observation lifetime and regress unchanged-capacity restart; author20c3d13b confirms.","file":"hub/src/adapters/sessions.ts","line":199},{"severity":"medium","text":"Removed-role/pool startup transaction deletes the wait even when noticeTo returns null, so a dropped launch can lose its required Coordinator line permanently. Require a positive retained notice receipt before deletion, keeping rollback/notice-once semantics under failure; author5c946b93 confirms.","file":"hub/src/adapters/sessions.ts","line":207},{"severity":"medium","text":"Restoration calls ordinary #addWaiting/add, whose changed(row) logs a fresh session-waiting start on every restart for the same durable wait/since. This regresses the existing one-start/no-unchanged-repeat lifecycle contract. Separate restoration visibility/retry installation from first-admission notification; authorf8bd1bf0 confirms no repetition approval.","file":"hub/src/adapters/sessions.ts","line":212},{"severity":"medium","text":"The armed eventually process-publication observer starts before ready() without a prearmed cancellation/join owner or immediate rejection observation. Early trigger/setup failure can leave UI polling active through resource/store teardown. Register its stop/join before triggering and preserve positive publication assertions; author20c3d13b confirms no other owner.","file":"hub/test/waiting-launch-restart.test.ts","line":91}]
finding_counts: {"high":1,"medium":5,"low":0}

A-17764 complete pinned source pass:1high+5medium, all confirmed20c3d13b/5c946b93/f8bd1bf0. Require exact waiting-record publication receipt for fresh/reused paths and negatives for unrelated put; shared live/restored target-name/inferred-role authorization; retained typed memory evidence; positive notice receipt before drop deletion; restoration without duplicate start; prearmed cancel/join/rejection observation for publication poll. T1/T2 guides/tier/index and existing assertions retained; no wire change. C1/C2/C3failed, C4runtime-unverified. A-17759/A-17760 are narrative/selected summaries; author36cea82b states original focused/static transcript and discarded success streams, so preserve available honest excerpts/commands/native statuses/source limits without provenance repeat. Native batch still pending at pass; no coverage extrapolation. createHub inspection did not establish reachable durable path (:memory:/nohostPools), explicitly not a finding/scope expansion. Complete pass closed; combine fixes after admitted producer closes, fresh committed request before mode-free verify. No Reviewer tests/probes/edits/delegation, extra fullsuite/unchanged-source/provenance run or devmerge requested. AfterstageaffectedQA separate.

Criteria: C1 failed (Restored typed memory evidence is lost, allowing original reason changes without a fresh observation; restoration also repeats start lifecycle notices.), C2 failed (Name-only generic process publication does not atomically settle different-name reused admissions; restored target/inferred-role validation is incomplete.), C3 failed (Startup can delete a dropped wait without a positive Coordinator notice receipt.).

### impl-1745 · 2026-11-08T07:39:05.101Z

Review correction consumer sweep: private WaitingLaunchRecord gains admitted UUID, optional inferredRole and typed memory evidence (host, bytes, floor, provision creation). Consumers are ProcessTable waiting methods, Sessions admission/retry/restore and Dispatcher restore validation; no wire or persisted reader outside these modules consumes it. ProcessTable.put adds optional WaitingPublication identity: only Sessions fresh/reused publication passes it; all other puts retain prior non-wait behavior. Exact-row/wrong-id/rollback/different-name regressions added to waiting-launch-store; runtime different-name reuse and restart regression in waiting-launch-restart. Live/restored admission now shares #validateSessionCaller. First review's 148 importer run completed: 111 T1/T2 +37 T3 green at superseded 6106f1ff; A-17762/A-17765 preserve native exit/summary metadata with discarded full-stream limits. New correction source has focused 54 generated cases green (T1/T2), full typecheck and T0 static/test lint green, original outputs retained for artifact publication.

### rev-35 · 2026-11-08T07:42:23.100Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1745-source-2
commit: 1c85df304aefaa453fd0437fe78b889d11731163
scope: full
findings: [{"severity":"medium","text":"Different-name reuse test captures external ProcessTable in the hub's session-reused log callback, but closes that table in resource cleanup before hub stop in the hubs phase. Cancelling/joining the polling observer does not drain the retry producer, so early failure can publish a late event into a closed database. Prearm producer stop/join or detach the borrowing callback before table/store disposal; author806627a6 confirms no owner.","file":"hub/test/waiting-launch-restart.test.ts","line":265}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17767 complete corrected pass: prior six findings source-repaired, one new medium fixture ownership gap confirmed806627a6. Exact UUID wait receipt passes fresh/reused publication; ordinary puts preserve unrelated waits/wrongidrollsback. Shared live/restored actor/user/inferred-role validation, typed memory evidence+atomicreason/save, positive notice fence, silentrestore and prearmed pollowner inspected. New reuse test borrows external table through live hub log callback but table.close resources precedes hub.stop hubs; polljoin is not producerjoin. Prearm stop/join or detach borrowing callback before handles close, preserve publication/restart assertions. C2failed; othersruntime-unverified. A-17766 raw final54passes independently parsed with candidate/pipefail/noindependentsignalledger limits; intermediate failures labelled. Typecheck/lint before lastrefinement and prior148importermetadata at6106 not finalheadcoverage. Exactcleanhead/diffcheck clear,no merge. Passclosed; fix after admittedproducer drains and requestfreshsource before configuredverify. No Reviewer tests/probes/edits/delegation or extra fullsuite/provenance/unchanged-source repeat/devmerge requested. AfterstageQA separate.

Criteria: C2 failed (New different-name reuse publication callback borrows an external table that cleanup can close before its hub/retry producer stops on early failure.).

### rev-35 · 2026-11-08T07:53:52.224Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1745-source-3
commit: ef3c671ffcd091ebe9422756ee2996888d0f2225
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17770 combined source clear. Prearmed FIFO publication guard detaches synchronous borrowed-table callback before either Store/ProcessTable closure; observer drain and producer shutdown retain ownership, publication/no-replay assertions preserved. Clean exact head/singleT2filedelta/diffcheck confirmed. Prior six production/observer repairs source2 remain byte-identical: exact UUID publication, ordinaryputnegative, shared live/restored validation, typed memory lifetime/atomicsave, positive notice fence, silentrestore. A-17769 independently54pass/zero failcancel skip, childPID80351/status0/signalnull/errornull, sealed environment/propagated status/originalredactedstreams; argvhead+cleanchronology not intrinsic perchildGitproof. Exacthead hubtypecheck0 only, not fullT0. A-17768 independently37T3code0/signalnull/516summarypasses at production1c85 with discardedfullstreams limit and unchangednativegraph;6106componentcoverage remains superseded. C1–C4done but runtime-unverified pending mode-free exacthead configured result after authorized checks. No Reviewer tests/probes/edits/delegation or extra fullsuite/provenance/unchanged-source repeat/devmerge requested. AffectedafterstageQA separate.

### rev-35 · 2026-11-08T08:15:03.755Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1745-final-1
commit: ef3c671ffcd091ebe9422756ee2996888d0f2225
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17772 final same-head audit clear; C1–C4 verified against source3/A-17770 and configured3a192ce8/A-17771. Independent execution projection daa593ebf1ff2247aae52bb01998589723d729ff matches provenance; clean exacthead. Aggregate5554/5554 and parsedbase5416/5416 distinct, fiveemptyfailurearrays, zero failcancel skipTODO. Elevenrestartbase+55distinctload and atomic1+5 pass; predecessor20+100 pass. Originalstatus/since, typedmemory, exact reused/freshpublication, no replay, removedrole/pool noticeonce+missingreceiptnegative, cancellation, actor/user/inferredrole negatives all actualpassfacts. T0/allT1/fallbackallT2/mappedT4guard1base/Webexit0; noT3inconfiguredreceipt, remainingT3batch/noT4reps. Linuxx64 .147 Node24.21/Nvim.12.5 uncached/skips[], Shell1248/CfT156.0.8078.4. Reportonlybudgets/lints retained. Prior A-17768 productionparent37T3/516selectedsummarypasses has unchangednativegraph/testonlydelta and discardedfullstreamlimits; not newcurrentheadT3proof. Focused54/native/typecheck A-17769 retained. No Reviewer tests/probes/edits/delegation or additionalrerun requested. AffectedafterstageQA separate ondev.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1745 · 2026-11-08T08:15:59.005Z

Ready report A-17773 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17773-t-1745-ready-report-exact-cases-and-importer-inventory.md) records every generated new case, 149 direct importer files with tier/how-run, qualified native-parent evidence and all provenance limits. Hub status ready; C1–C4 verified by rev-35-1745-final-1 (A-17772). Exact reviewed head ef3c671ff, configured run 3a192ce8/A-17771 green: 5554 pass, zero fail/cancel/skip/todo; T0/T1/all fallback T2/mapped T4 base/Web completed on Linux x64 droplet, Chrome for Testing 156.0.8078.4. No T3 in configured run; 37 serial native production-parent files retained in A-17768; final delta test-only callback guard. Budget/lint advisories report-only. After-stage affected QA on dev; claim retained, Coordinator enqueues.

### coord · 2026-11-08T08:52:46.064Z

Merged 50f0529d2795c9b6d47e571b8ce83246fed742e1 onto dev.
