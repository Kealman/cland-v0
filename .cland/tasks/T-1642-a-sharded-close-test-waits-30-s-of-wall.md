---
id: T-1642
kind: task
title: A sharded close test waits 30 s of wall clock for its remote group and times out on a slow droplet
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1620
branch: t/T-1642-a-sharded-close-test-waits-30-s-of-wall
created: 2026-11-02T20:18:54.422Z
updated: 2026-11-18T14:17:59.131Z
closed: 2026-11-18T14:17:59.131Z
---

## Summary

`hub/test/suite-close-recovery.test.ts:14` "a sharded close handles cancel with one result and confirmed cleanup" failed in the Linux stage cover 7b124b96 at dev d82f45fb (A-15968, shard 2) with `Error: remote group started: not within 30000 ms` after 31.95 s. Its budget is 10 s. The same test passed in every periodic dev T3 run today. The run used a fake droplet, and shard 1's machine had slow fsync (64 ms).

## What to build

Replace the fixed 30 s wall-clock wait on the remote group start with an event or a clock-driven wait (rule 23, wall-clock waits). Bring the test back under its 10 s budget.

## Acceptance criteria

- [x] C1. The test waits on the group-start event or the injected clock instead of wall time, and passes 20/20 under a load gate at 10 (test).
  - done: impl-1642 · 2026-11-18T12:52:22.970Z
  - verified: rev-39 [reviewer] · run rev-39-1642-final-20261118 · 2026-11-18T13:24:13.649Z · commit 2eeeb43059a2e6ca7c118c59d6b8755dc2926001
- [x] C2. Its duration is within the T3 per-test budget in the item's own mode-free droplet verify (evidence); later batch and cover samples are recorded at stage close, not required before merge.
  - done: impl-1642 · 2026-11-18T13:23:36.107Z
  - verified: rev-39 [reviewer] · run rev-39-1642-final-20261118 · 2026-11-18T13:24:13.649Z · commit 2eeeb43059a2e6ca7c118c59d6b8755dc2926001

## Comments

### impl-1642 · 2026-11-18T11:19:40.881Z

Consumer/scope map: changing only cancellation case in hub/test/suite-close-recovery.test.ts; same title and T3 classification retained for budget history. Native lost/restart cases unchanged. Shared integrated, remote-fixture, scripted-machine.started, remote-clock drive, fakeNativeGuard and readLeaseHistory already provide needed seams and will not change. Searched group-start wait and remote callers; no production/wire/config contract change. Matching per-file guide updated. Coordinator confirmed scripted cancellation seam and revised C2 to own mode-free verify sample; additional samples tracked at stage close.

### rev-35 · 2026-11-18T12:17:25.642Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1642-source-1
commit: 0042d89b3f42b7b873d9fff9e95d4b9160ade73b
scope: full
findings: [{"severity":"medium","text":"The migrated callback has no pre-acquisition whole-body owner; integrated/remote-fixture only clean selected acquired phases. until also leaves original drive(f,started) uncancelled/unjoined if a start receipt is missing. Own/adopt the original setup/body/driver and positively settle missing-receipt/cancellation before teardown (A-21218 M1).","file":"hub/test/suite-close-recovery.test.ts","line":20},{"severity":"medium","text":"afterCleanup finally restores the native guard even after earlier hub/API drainage rejects, with no positive original-work/resource join fence. Retain the guard until relevant drainage is confirmed; keep unknown cleanup incomplete (M2).","file":"hub/test/suite-close-recovery.test.ts","line":23}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source at0042d89b3/base93026cbe9: Standards2medium, Spec0; A-21218. Lead confirmed gaps1ceff7a8. Intended persisted-start/clock migration matches Coordinator337e43da; native loss/restart cases/title/T3 and one-result/lease/slot/provider assertions retained. C2 stays unverified pending own mode-free droplet sample; source-before20/20 permitted7a2a17e2. A-21208/21216 retain red nativefork refusal, selected green and historical partial7/20 code0/signalnull children; parentstoppedbefore8/load20.613, notfailedtest8. Final precommit typecheck/full-lint0 qualified; no runtime/provenance probe by Reviewer. Pin released; bounded M1/M2 correction then fresh clean pushed-head source review under existing quiet/native-slot restrictions.

Criteria: C1 failed (Migrated receipt wait lacks original setup/body/clock-driver and guard ownership through missing receipt/cancellation; failure is concrete M1/M2, not the authorized pending20/20 slot.).

### rev-39 · 2026-11-18T12:32:12.214Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1642-source-20261118
commit: 2eeeb43059a2e6ca7c118c59d6b8755dc2926001
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at2eeeb43059a2e6ca7c118c59d6b8755dc2926001; no findings. Prior M1/M2 resolved: whole callback admitted before setup/guard; captured cleanup hooks wait for original sequence and exact abortable startDriver; first-enrolled signal owner drains before fixture roots. Guard release requires positive full cleanup, remains retained on failed/unknown drainage, restores after verification error only when drained. Persisted shard receipts and cancellation/product assertions/title/T3/native loss-restart retained. A-21229 focused missing-start1/1 and full lint/typecheck are supplied local macOS Node24.21.0 working-source evidence, with missing invocation tree/parent signal explicit. Main corrected case20/20 and mode-free duration sample pending; earlier7/20 historical only. C1/C2 runtime marks deferred. No reviewer tests/edits/delegation.

### impl-1642 · 2026-11-18T13:23:36.408Z

Configured mode-free verify671d05ec-d4ef-4772-8d4e-7c21b1833d15 passed at exact source-reviewed2eeeb43059a2e6ca7c118c59d6b8755dc2926001 (A-21266):6787/6787,0fail/cancel/skip/todo. Local macOS T0exit0; Linuxx64droplet c-8ams3 Node24.21.0 completed allT1/allT2fallback, changedT3file4/4 once, Web55files293tests; remainingT3 deferred to merge batch, T4not selected. Named cancellation suite timing outcome pass1.069185928s (<C2T3criterion10s); missing-start controlpass0.003352183s. Browser download receipt ChromeHeadlessShell156.0.8078.4/Playwright1248 (runtime binary receipt qualification in final evidence). Droplet lifetime1610s/cost$0.1118/workers2. Durationbudgets andT3ratchet report-only, notices retained not enforcement pass. C1done20/20 evidenceA-21238/A-21245 at samehead. C2nowdone. Worktree/headclean unchanged; final Reviewer settlement pending.

### rev-39 · 2026-11-18T13:24:13.649Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1642-final-20261118
commit: 2eeeb43059a2e6ca7c118c59d6b8755dc2926001
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at2eeeb4305; no findings. Durable671d05ec-d4ef-4772-8d4e-7c21b1833d15 finished/passed; A-21266 pins reviewed head/runtime treebbb91b8d5b1123fb98fc48044533eb4aea5a13aa,no cache. C1 independently audited A-21238/A-21245 unique1–20 same-head exact target/nativecode0-signalnull/overflowfalse and TAP1pass/0fail/cancel/skip/todo, starts10.0254–19.6948; authorized9+11 continuation, stopped/older rounds excluded. C2 exact mode-free target pass1.069185928s<reviewed T3criterion10s; missing-start0.003352183s, full changedT3four cases+file pass. Host T0,Linux x64 droplet Node24.21.0 T1/allT2/changedT3/Web passed; actualHeadlessShell1248 Chrome156.0.8078.4. RemainingT3/T4 unexecuted; budget/lint/ratchet report-only. Source A-21235 stands; no extra cover requirement or reviewer test execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T14:17:59.131Z

Merged 7182b5f906ff8c7d008a8209942959c3e3483b30 onto dev.
