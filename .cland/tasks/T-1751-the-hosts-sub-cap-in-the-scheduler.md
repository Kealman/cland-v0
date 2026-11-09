---
id: T-1751
kind: task
title: The hosts sub-cap in the scheduler
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
  - T-1747
topic: topic-1450
branch: t/T-1751-the-hosts-sub-cap-in-the-scheduler
created: 2026-11-07T16:01:59.458Z
updated: 2026-11-09T09:13:37.138Z
closed: 2026-11-09T09:13:37.138Z
---

## Summary

At 100 % of `[hosts] daily_spend_usd`, no new host starts. The waiting launch keeps waiting, and live hosts and their sessions are untouched, renewals included. When the hosts' spend and reservations first cross 80 % of the sub-cap in a day, General gets one line.

## What to build

The scheduler maps T-1747's reservation refusal to "waiting for a host". It also posts the once-per-day 80 % line through the existing `noticeInTopic`, kept once per day across hub restarts.

## Acceptance criteria

- [x] C1. With a tiny sub-cap, a second host is refused at 100 %, the launch keeps waiting, and the first host keeps running with its sessions and its renewals (test).
  - done: impl-1751 · 2026-11-09T08:09:11.650Z
  - verified: rev-35 [reviewer] · run rev-35-1751-final-1 · 2026-11-09T08:35:40.300Z · commit 467af71d465083bffb28a351c57905c6870bcc47
- [x] C2. Crossing 80 % of the sub-cap posts exactly one General line that day, also across a hub restart (test).
  - verified: rev-35 [reviewer] · run rev-35-1751-final-1 · 2026-11-09T08:35:40.300Z · commit 467af71d465083bffb28a351c57905c6870bcc47
  - done: impl-1751 · 2026-11-09T08:35:50.969Z
- [x] C3. A refused create makes no provider call and adds no ledger entry (test).
  - done: impl-1751 · 2026-11-09T06:46:43.951Z
  - verified: rev-35 [reviewer] · run rev-35-1751-final-1 · 2026-11-09T08:35:40.300Z · commit 467af71d465083bffb28a351c57905c6870bcc47

## Blocked by

- T-1746
- T-1747

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`; no `core.ts` edit.
- Tests: new `hub/test/pool-spend-cap.test.ts` (T2, isolated `XDG_STATE_HOME`).
- Serves epic C7. Its plan lane orders it after T-1750, because both edit `pool-runtime.ts`.

## Comments

### impl-1751 · 2026-11-09T06:46:22.936Z

Rule-20 consumer sweep recorded before changes in topic-1450; durable transitive graph A-17986. Production consumers are Sessions/dispatch, host leases/watchdog/status, executor droplet/watchdog and suite accounting. No wire or ledger shape changes. Existing host-spend assertion migrates from hosts-cap refusal to unchanged shared-cap refusal. QA/docs consumers remain valid; new guide documents renewal exception. Coordinator approved T1/T2/Web via Linux verify, full T3 via merge batch, direct native files locally after source verdict; broader T4 deferred.

### rev-35 · 2026-11-09T06:51:47.187Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1751-source-1
commit: 7a995151f89db0b4d416517d9a401966f5939eba
scope: full
findings: [{"severity":"medium","text":"Standards/Test levels: new T2 spend-cap cases pass only {clock} to reserveHostSpend/renewHostSpend and HostLeases.create/renew. Ledger locking reaches native processStartedAsync/ps; no injected LockProcessTable or no-native boundary covers these calls. Inject the shared fake lock processes through all new accounting paths and validate resource-tier compliance. Raw node --test success is functional evidence only.","file":"hub/test/pool-spend-cap.test.ts","line":14},{"severity":"medium","text":"Standards/lifecycle (rule12): direct Store/PoolRuntime cleanup is registered only after awaited lease creation/record setup, leaving failed setup unowned. Sequential runtime.close -> leases.close -> store.close skips later resources on rejected drain. Prearm ownership immediately after acquisition, before awaited setup, and attempt every ordered close with finally/attempt-all.","file":"hub/test/pool-spend-cap.test.ts","line":48},{"severity":"medium","text":"Standards/history (rule23): new recurring warning reparses and scans the complete retained user/legacy ledger every un-warned minute via observe/filter/totals, without byte/work budget or bounded checkpointed derived accounting. Async scheduling and per-runtime in-flight coalescing do not bound synchronous parse/scan. Use a bounded shared accounting owner and demonstrate retained-history work limits.","file":"hub/src/executor/droplet/spend.ts","line":310},{"severity":"low","text":"Standards/ownership (rule12): repeated start replaces #spendTimer without clearing the prior timer on its owning clock or invalidating its callback. Old periodic closures continue after replacement, including start without checkSpend; close clears only the last handle. Repeated start is not excluded. Retire the previous timer/callback owner and cover replacement/removal.","file":"hub/src/host/pool-runtime.ts","line":69}]
finding_counts: {"high":0,"medium":3,"low":1}

NOT CLEAR: Standards3medium+1low / Spec0 additional functional findings; A-17991. Author confirmed all four: new T2 native lock probes, late/non-attempt-all fixture cleanup, recurring unbounded retained-ledger scans, retained timer owners on repeated start. Renewal/shared-cap interpretation and old assertion migration expressly approved. C1–C3 remain runtime-unverified; no unsupported criterion-specific failure assigned. A-17988 raw112pass and A-17990 candidate/transcript limits inspected; normalized689-file A-17989 graph is inventory, not coverage. Coordinator d900df9c validation split preserved; fresh source review before native/configured verify. Newly reported831c6ab2 directs inline mutation accounting events instead of minute scan; correction unreviewed. No Reviewer execution; full after-stage QA separate.

### rev-35 · 2026-11-09T07:02:53.802Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1751-source-2
commit: a67df8855702d8bf55fdea09a45a4744656e84b7
scope: full
findings: [{"severity":"medium","text":"Spec/C2 subscriber replacement: unsubscribe closes over its old Set, but whenever that Set is empty it deletes the registry path without checking the current Set or prior disposal. After A unsubscribes, B subscribes using a fresh Set, and A is disposed again, B is silently removed and future committed mutations emit no warning. Repeated Dispatcher.close/old fixture cleanup has no exactly-once guarantee; new test already manually stops plus registers cleanup. Make disposal idempotent/current-owner guarded and cover retired-A disposal after B subscribes.","file":"hub/src/executor/droplet/spend.ts","line":303}]
finding_counts: {"high":0,"medium":1,"low":0}

NOT CLEAR: Standards0/Spec1medium, A-17995. All four source1 findings close. Coordinator831c6ab2/476fc89d/cbdc7319 directly read; event/no-new-read/project-day/watchdog boundary accepted. New confirmed replacement defect: retired unsubscribe A can delete B's fresh registry Set on repeated disposal. Make idempotent/current-owner guarded and regress old-A dispose after B subscribes. C1/C3 runtime-unverified. A-17994 original5-case enforce tripwire zero tier events and133candidate passes/static inspected with precommit/failed-probe/masked-group limitations. Fresh source review before native/configured verify; validation split/full after-stage QA separate. No Reviewer execution.

Criteria: C2 failed (A retired subscriber's repeated unsubscribe can erase its replacement and silence future committed-spend warnings.).

### rev-35 · 2026-11-09T07:04:23.453Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1751-source-3
commit: 8a80c42f4c0ea3d6f04802b92da6e1b31706ad3d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR, Standards0/Spec0, A-17998. Exact two-file correction makes unsubscribe idempotent/current-Set guarded; regression preserves B after retired A is disposed again. Original red A-17996 4pass/1fail explicit0!=1 and green A-17997 5/5 zero tier events inspected; candidate/precommit/enforce invocation/native completion limits retained. Prior four findings closed through source2; approved event/accounting/watchdog boundary unchanged. All C1–C3 runtime-unverified pending authorized same-head direct native preservation and mode-free Linux verify; full LinuxT3 batch before landing, broaderT4/after-stageQA separate. Clean head, no Reviewer execution.

### rev-35 · 2026-11-09T07:37:44.384Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1751-evidence-1
commit: 8a80c42f4c0ea3d6f04802b92da6e1b31706ad3d
scope: evidence
findings: [{"severity":"medium","text":"Evidence/C1: exact-head configured run36772956 exits124. New 'cap-refused scheduler launch remains in the durable waiting list through retry' records a base failure at135.14930086s, then the file never reports completion although all five base cases finish. Five load starts for that identity also have no finish. Exact buffered assertion and native drainage cause are unavailable in A-18003; diagnose and correct at a fresh reviewed head without weakening waiting/retry assertions before configured retry.","file":"hub/test/pool-spend-cap.test.ts","line":86}]
finding_counts: {"high":0,"medium":1,"low":0}

NOT CLEAR, A-18004. Configured36772956/A-18003 exits124: interrupted5121completed5120pass1fail; waiting-through-retry base failure135.149s, all5 pool cases finish4pass1fail but no file completion; five load starts for failed identity have no finish. Exact assertion/drainage cause unknown and author confirms only named failure/stall available; no accepted shared-defect exemption. T0/T1 pass, T2 incomplete, Web unexecuted/browser provenance null. Other4 pool cases base+5pass retained; C2/C3 finally runtime-unverified. Native A-18000 audited8files112pass/code0/signalnull remains supplemental, not replacement. Author conducting Coordinator-directed parent-bounded5 focused repetitions with original output/cleanup receipts; no unchanged-source full verify repeat. Fix/authorized merge needs fresh source review before retry. FullLinuxT3 batch/after-stageQA separate; no Reviewer execution.

Criteria: C1 failed (New durable waiting-through-retry case fails in exact-head Linux configured run; its file and five load repetitions do not finish before stall.).

### rev-35 · 2026-11-09T08:11:32.367Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1751-delta-1
commit: 467af71d465083bffb28a351c57905c6870bcc47
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged source CLEAR, Standards0/Spec0; A-18009. Approved startup-sweep post-release observer+lock-absence barrier preserves waiting/retry assertions and resolves diagnosed fixture ordering on source. Both merge conflicts reviewed: T-1756 invalidateHostAdmission remains BEFORE hostSpendMutation in settle/cancel; spend export, warning hooks, renewal selection and both README pointers retained. All31 non-conflict dev-added paths match dev parent. A-18005 bounded red5/5 incomplete versus green case5+ordinarycase5+full5/25 natural0/null independently reconciled; containerarm64 distinct cloudx64. A-18008 merged144targeted/static/typecheck originals qualified. AllC1–C3 runtime-unverified; oldA-18003 remains failed/incomplete. Proceed Coordinator-directed fresh native4 then mode-free same-head verify. Full LinuxT3 batch/after-stageQA separate. Clean head; no Reviewer execution.

### rev-35 · 2026-11-09T08:35:40.300Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1751-final-1
commit: 467af71d465083bffb28a351c57905c6870bcc47
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final CLEAR,C1–C3 verified; A-18013. Independent exact-head/export-tree5bb04db697fade1a439ffe93691090288c05701f and clean tip audit; configurede8d22981/A-18011 5717/5717,zero fail/cancel/skip. All5 new cases base+5distinct load passes each; repaired retry0.392394679s with positive base file completion and all load finishes. Reconciled selected453 lower/Web plus8 conservative unknown lower-tier paths:461files all passing substantive cases AND file completions. Exact-head local native4/28 A-18010 summaries/close0signalnull audited. Prior red/incomplete36772956 stays historical; bounded diagnosis and source/provenance/report-only limits preserved. Standards/Spec0 outstanding. FullLinuxT3 batch still required before landing,broadT4/full after-stageQA separate. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-09T09:13:37.138Z

Merged 0a4e5372057b00624ef2b26548c5e41e8b9ea761 onto dev.
