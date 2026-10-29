---
id: T-1087
kind: task
title: FrameClient ownership accounting runs ps for the in-process fixture's synthetic pids
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1216
branch: t/T-1087-frameclient-ownership-accounting-runs-ps
created: 2026-10-21T23:17:06.345Z
updated: 2026-10-29T19:55:21.959Z
closed: 2026-10-29T19:55:21.959Z
---

## Summary

In the in-process Claude fixture, FrameClient's result-ownership accounting calls `execFileSync`/`ps` for the synthetic positive pids the fixture invents. That makes report-only T2 resource warnings in T2 runs (seen in A-8786, T-1034's run 4437665a). The fixture's process facts are synthetic, so native cleanup accounting has nothing to check.

## Acceptance criteria

- [x] C1. Synthetic process facts from the in-process fixture skip native ps/execFile accounting, and the T2 run reports no child_process warnings from FrameClient ownership accounting (test).
  - done: impl-1087 · 2026-10-29T19:11:11.535Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1087-final · 2026-10-29T19:48:05.311Z · commit 58262e40aa627be665470e085bf65283f245ce5a
- [x] C2. Native fixtures that start real processes keep their ownership accounting and cleanup checks unchanged (test).
  - done: impl-1087 · 2026-10-29T19:25:26.807Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1087-final · 2026-10-29T19:48:05.312Z · commit 58262e40aa627be665470e085bf65283f245ce5a

## Comments

### impl-1087 · 2026-10-29T19:09:00.002Z

Scope/seams: Claude scheduling component's production frame client and scripted native CLI; native FrameClient default plus process cleanup. Existing observeProcesses argument allows fixture-local opt-out; no shared wire/schema/production contract changes. Consumers searched: FrameClient, connectUi/dispatcherUi/connectWsUi and rememberResultProcesses call sites throughout hub/test; only claude-code-schedule component reports invented positive PIDs through the default observer. session-resume-component already supplies its synthetic observer; generic fakeHarness uses null PIDs; native lifecycle/CLI fixtures retain the default.

### rev-34 · 2026-10-29T19:24:40.631Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1087-source1
commit: 7451c030655ff06e107fd9c73cd72b107e3c0afa
scope: full
findings: [{"severity":"medium","text":"M1: spawn-time expiring close observer is reused for fallback cleanup, and ownDirectory lacks a native-exit beforeRemove fence. An expired observer can let failed resource cleanup proceed to root deletion. Retain native close/error independently, bound joins separately, fence removal and add omitted/aborted readiness controls.","file":"hub/test/process-cleanup.test.ts","line":733}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14036: Sole Standards M1; no independent Spec finding. Scripted no-op observer is fixture-local and shared/native defaults unchanged. C1 runtime pending; C2 regression incomplete until owner correction. Local targeted/tripwire evidence retains T-1451 and pre-amendment capture limits; no Reviewer execution.

Criteria: C2 failed (New native default control lacks failure-path native-close/root-removal ownership after its close observer expires.).

### impl-1087 · 2026-10-29T19:25:27.080Z

M1 addressed at 58262e40aa627be665470e085bf65283f245ce5a; A-14038 records local validation and fixture ownership changes. C2 re-marked done after source1 failure; fresh source review delivered to reviewer. No verification queued before fresh clear.

### rev-34 · 2026-10-29T19:26:16.480Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1087-source2
commit: 58262e40aa627be665470e085bf65283f245ce5a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14039: M1 resolved by persistent native close/error observation, separate bounded waits, beforeRemove stop/close fence and same-owner omitted/aborted readiness controls. First FrameClient registration proof retained, scripted opt-out/native defaults unchanged. Local49/49/typecheck/tripwire attribution retained; runtime C1/C2 pending exact-head configured evidence.

### rev-34 · 2026-10-29T19:48:05.312Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1087-final
commit: 58262e40aa627be665470e085bf65283f245ce5a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record audit A-14070 of exact-head run bf21a8f4/A-14061: 4248 ordinary passes plus 80 load passes, no failures; T0/T1/all fallback T2/changed T3 cleanup 49 identities/Web completed. C1 scripted Claude identity passes ordinarily and 5/5 load, with no ownership warning for that fixture; separate FrameClient warning in test-admission remains outside scope. C2 all three default native ownership/omitted/aborted controls pass once, preserving source-backed native close/root fences. Remaining T3/T4 unrun; host check reused, not repeated remotely; report-only warnings and native-object capture limits retained. Standards and Spec clear within this evidence scope.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T19:55:21.959Z

Merged c5f535802f8500328a49bd3db943c261773e1062 onto dev.
