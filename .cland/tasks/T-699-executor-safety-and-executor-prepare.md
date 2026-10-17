---
id: T-699
kind: task
title: "executor-safety and executor-prepare: barriers instead of 16 s negatives, one fixture for the refusal and retry tables"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-697
topic: topic-435
branch: t/T-699-executor-safety-and-executor-prepare
created: 2026-10-16T19:59:36.725Z
updated: 2026-10-17T14:19:12.173Z
closed: 2026-10-17T14:19:12.173Z
---

## Summary

- `executor-safety.test.ts` (129.0 s): two tests each `await pause(16000)` to prove no `POST /v2/droplets` happened while a spend lock is held. The five-cause refusal loop builds five full remote fixtures (git, bare territory, snapshot seed) for one decision, and a pure config-validation test sits in this machine file (memo §2.2 win 7; report-slice4 #1).
- `executor-prepare.test.ts` (75.6 s): five transient builder-delete retries (409, 422, 503, timeout, key-503) are five prepares, and four hub restarts prove lease and snapshot durability that reopening the `Store` shows (report-slice2 #10).

## What to build

- **Barriers.** Each 16 s negative waits instead on an acquisition-attempt signal from the acquisition module or a counter on the fake provider: the attempt was made and is waiting, then no create happened.
- **One fixture per table.** The five refusal causes become one fixture plus a T1 table on the fallback-reason function, keeping the notice and journal proof once. The five retry causes become a table on the in-process provider (T-697).
- **Persistence in-process.** Durability is proven by closing and reopening the `Store`, or by `projectHub` stop and serve; one spawned-hub restart stays where the title names the restart.
- **Pure tests leave.** Config validation moves to a T1 file.

## Acceptance criteria

- [x] C1. The two files' manifest seconds fall from 204.6 s (A-3877) to 110 s or less.
  - done: impl-699 · 2026-10-17T12:27:23.200Z
  - verified: rev-30 [reviewer] · run rev-20261017-699-c1-exception · 2026-10-17T12:29:48.619Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-final · 2026-10-17T12:39:41.062Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-conflict-merge · 2026-10-17T13:44:13.476Z · commit 6c41aa96847cb9461ffda3b9b64bf85a479b4c5c
- [x] C2. No `pause(16000)` or other numeric wait is left in `executor-safety.test.ts`, proved by the test lint.
  - done: impl-699 · 2026-10-17T11:46:41.094Z
  - verified: rev-30 [reviewer] · run rev-20261017-699-cleanup-correction · 2026-10-17T11:59:01.367Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-final · 2026-10-17T12:39:41.062Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-conflict-merge · 2026-10-17T13:44:13.476Z · commit 6c41aa96847cb9461ffda3b9b64bf85a479b4c5c
- [x] C3. Remote fixtures built for the refusal causes fall from 5 to 1, and `startDaemon` call sites in the two files from 6 to 2 or less.
  - done: impl-699 · 2026-10-17T11:46:41.588Z
  - verified: rev-30 [reviewer] · run rev-20261017-699-cleanup-correction · 2026-10-17T11:59:01.367Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-final · 2026-10-17T12:39:41.062Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-conflict-merge · 2026-10-17T13:44:13.476Z · commit 6c41aa96847cb9461ffda3b9b64bf85a479b4c5c
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-699 · 2026-10-17T11:46:41.996Z
  - verified: rev-30 [reviewer] · run rev-20261017-699-cleanup-correction · 2026-10-17T11:59:01.367Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-final · 2026-10-17T12:39:41.062Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - verified: rev-30 [reviewer] · run rev-20261017-699-conflict-merge · 2026-10-17T13:44:13.476Z · commit 6c41aa96847cb9461ffda3b9b64bf85a479b4c5c
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261017-699-final · 2026-10-17T12:39:41.062Z · commit d7539519cf80aad6155f5341a5246dc42bf10181
  - done: impl-699 · 2026-10-17T12:40:11.804Z
  - verified: rev-30 [reviewer] · run rev-20261017-699-conflict-merge · 2026-10-17T13:44:13.476Z · commit 6c41aa96847cb9461ffda3b9b64bf85a479b4c5c

## Comments

### coord · 2026-10-17T06:43:05.687Z

Coordinator correction from T-697: CLAND_TEST_DROPLET_MACHINE_MS is a readiness timeout in waitForMachine, not a fixed delay before the machine is ready. Lowering it from 2000 to 200 doesn't save 1.8 s per droplet by itself, so this ticket's speedup comes from the fixture and process work it removes (one fixture per test, in-process provider and scripted machine from T-697). Measure and report it that way. A case that needs real readiness timing keeps an explicit override, as T-697 did for the demo watchdog.

### impl-699 · 2026-10-17T11:33:47.410Z

Migration in progress: lock contention now uses retry receipts and FakeClock beyond the former 15s boundary; five refusal causes use a minimal in-process executor table with one 422 frame proof (Coordinator-approved interpretation). Retry causes share one provider fixture. Durability restarts now use projectHub except the real hub-stop/drain lifecycle proof. Serial whole-file measurements and assertion audit follow.

### impl-699 · 2026-10-17T11:46:56.888Z

Implementation pushed at 467ad0fa; source review requested from Reviewer in topic-435. Evidence A-4484 contains declaration-by-declaration assertion audit, Mac 35/35 serial full-file logs, timing summary and lint/typecheck receipts. Original pair median 204.579→107.770s; all seven factored files total119.574s. Explicit daemon call sites6→2, actual hub starts13→4. Eight legacy allowances removed, two shrunk; baselines unchanged. C5 awaits same-head droplet verification after clear source review.

### impl-699 · 2026-10-17T11:47:40.045Z

Coordinator timing disposition 76d73694: C1 applies to all seven files, judged on summed exact-head Linux droplet seconds. Mac medians total119.574s are disclosure only. C1 remains unverified pending that receipt; if Linux exceeds110s, report total and three costliest declarations to lead T-699 for a further-work/exception decision. Reviewer informed via ask.answer.

### rev-30 · 2026-10-17T11:51:53.331Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-699-source
commit: 467ad0fa25999b3e6d4cda6ec33d9f39582dd824
scope: full
findings: [{"severity":"medium","text":"M1: failure cleanup releases the held filesystem lock but leaves the in-flight acquisition asleep on remoteWaits/FakeClock. A failure at the pending-wait/no-create/no-fallback assertions (lines40–46) skips drive at48; remote-fixture then awaits stopHub and Suites.close awaits #launchWork, so teardown cannot finish. Own and settle the acquisition, including its registered product waits, before stopping the hub/removing roots; retain the pre-release assertions and add controlled assertion-failure cleanup proof for both lock kinds.","file":"hub/test/executor-admission-lock.test.ts","line":35},{"severity":"medium","text":"M2: failure cleanup cancels both pre-start acquisitions and then finish() waits for machine.started(). If an assertion fails while beforeCreate is held, cancellation makes Suites.#launch stop at its cancelled check before remote.start; scriptedMachine resolves started only from remote.start, so finish waits forever and never reaches f.stop. Drain/cancel tracked launch work without requiring a start receipt after cancellation; prove cleanup for a controlled pre-start assertion failure.","file":"hub/test/executor-safety-component.test.ts","line":84}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; two medium teardown findings in A-4491. M1 executor-admission-lock.test.ts:35 releases the native lock on failure but never drives/drains its pending FakeClock retry; stopHub awaits launch work indefinitely. M2 executor-safety-component.test.ts:84 cancels pre-start acquisitions then waits for machine.started, although cancellation prevents start; cleanup never reaches f.stop. Preserve existing assertions and prove controlled pre-start assertion-failure cleanup. C2–C4 otherwise supported by source/audit; no criterion verification on this pass. A-4484 normal paths35/35 whole-file logs pass (160 test receipts, zero failures/cancellations/skips). C1 remains pending all-seven exact-head Linux total<=110s under primary Coordinator76d73694; Mac119.574066211s disclosed only. No Reviewer execution. Exact corrected head needs source review before verify.

Criteria: C5 failed (New frozen-clock lock and pre-start cancellation tests can hang on assertion-failure teardown; correct and prove cleanup before fresh task verification.).

### impl-699 · 2026-10-17T11:57:43.774Z

M1/M2 fixed and new-head review requested at d7539519. A-4497 carries fresh 5/5 whole-file logs for both corrected files, controlled assertion-failure cleanup proofs for both lock kinds and both blocked same-name creates, and correction audit. Other five files unchanged from A-4484. C1 remains pending the all-seven exact-head Linux total (Mac119.038s disclosed only); C5 awaits that run after clear source review.

### rev-30 · 2026-10-17T11:59:01.367Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-699-cleanup-correction
commit: d7539519cf80aad6155f5341a5246dc42bf10181
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, A-4499; M1/M2 from A-4491 closed. Both owners track submitted runs, cancel by suite before releasing barriers, drive only registered waits to finished/released receipt, separately bound the report, then stop all tracked hubs and assert no waits/unreleased leases. Failure cleanup requires no start receipt. Original negative/concurrency/legacy ownership assertions preserved. Controlled assertion-failure proofs cover both locks and both blocked same-name acquisitions; ten fresh raw whole-file logs pass5/5 each with50 receipts/zero fail/cancel/skip. Other five unchanged files retain A-4484 evidence. Standards0/Spec0 findings; C2/C3/C4 verified. C1 pending all-seven exact-head Linux sum<=110s under Coordinator76d73694 (Mac119.037951755s disclosure only); overage requires total/top-three declarations and primary decision. C5 source blocker resolved, final mark remains pending exact-head droplet evidence. Normal mode-free verification can follow at this exact head, subject to hub admission. No Reviewer execution.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-699 · 2026-10-17T12:27:05.994Z

Coordinator e2104ead restores the standing Mac timing rule: C1 sums all seven Mac 5/5 file medians, with Linux seconds disclosed only. Corrected-head Mac total is119.038s (A-4497), 9.038s over110s and41.8% below204.579s baseline. A-4508 reports the three costliest declarations (15.056s sentinel lifecycle,12.329s shell/host deadline,12.015s failed replacement) and requests a recorded exception from lead T-699. C1 remains unsettled pending that primary decision; source head d7539519 and verify0734a342 unchanged.

### coord · 2026-10-17T12:27:15.520Z

Coordinator exception (2026-10-17): C1 accepted at 119.0 s Mac serial-median sum over all seven files carrying the migrated coverage (target 110 s; baseline 204.6 s; −41.8%), head d7539519, evidence A-4497/A-4508. The excess sits in three retained process-boundary proofs (sentinel lifecycle/redaction 15.1 s, remote shell/host deadline 12.3 s, failed replacement table 12.0 s). They are candidates for T-708's retirement once T-707's scenarios cover them.

### impl-699 · 2026-10-17T12:27:23.601Z

C1 accepted under Coordinator exception119f9aa2-a4e1-46da-ae36-f9dcfb51553b at d7539519: all-seven Mac119.038s (110s target;204.579s baseline;41.8% down). A-4508 identifies the three retained native process-boundary proofs. Coordinator directed no more tightening in T-699 and will note retirement candidates on T-708 after T-707 scenario coverage. Reviewer asked to settle C1 on this exception. Verify0734a342 continues unchanged; final verdict/C5 await its result.

### rev-30 · 2026-10-17T12:29:48.619Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-699-c1-exception
commit: d7539519cf80aad6155f5341a5246dc42bf10181
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1 settled only under primary recorded exception119f9aa2-a4e1-46da-ae36-f9dcfb51553b, independently read with correcting platform decisione2104ead. These supersede the earlier Linux-decisive ruling76d73694. Independently recomputed all-seven serial Mac5/5 median test-seconds119.037951755 from A-4497 corrected lock/component logs and A-4484's five unchanged files. This exceeds110s by9.037951755s; no numerical-target-met claim. Baseline204.579s,41.8% reduction. Coordinator explicitly accepts C1 at this exact head, retaining the three native proof declarations in A-4508 (15.056s sentinel lifecycle/redaction,12.329s remote shell/host deadline,12.015s failed replacement), with possible later T-708 retirement after T-707 coverage. Source clear A-4499/C2–C4 stands. C5/final execution remains pending run0734a342; Linux timing will be disclosed beside Mac, no rerun/head change requested.

Criteria: C1 verified.

### rev-30 · 2026-10-17T12:39:41.062Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-699-final
commit: d7539519cf80aad6155f5341a5246dc42bf10181
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear on A-4512/0734a342; current origin/source head matchesd7539519. Exit0:2083tests/2078pass/0fail/cancel/5platform skips, Neovim smoke12/12 green21.49s. Allseven owned files pass ordinarily (30top-level declarations/34test receipts including nested subtests), all11new owned identities5/5 (55/55), including M1/M2 controlled pre-release assertion-failure cleanup. No hard budget/load failure. Prior Mac35whole-file5/5 logs170receipts remain audited in A-4484/A-4497. C5 verified, historical cleanup blocker resolved; C2–C4 source-current refreshed. C1 preserved solely under primary recorded exception119f9aa2 and correcting platform rulinge2104ead: Mac119.037951755>110s, accepted41.8% reduction from204.579; no target-met claim. Linux allseven independently summed131.337114318s disclosed beside Mac. Host typecheck reused at7a6fcc889f6de6ec3f2ebeb51483a90bc99ee11f. Linux2workers,c-8lon1,suite2293.94s,peak11.20,lifetime2366s,$0.1643. AllC1–C5 verified; no findings/new run/head change.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-30 · 2026-10-17T13:44:13.476Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-699-conflict-merge
commit: 6c41aa96847cb9461ffda3b9b64bf85a479b4c5c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Conflict-only delta clear under primary7b8e68e9, independently read. Parentsd7539519 and dev24fe3ddf match A-4525. Structured durations exactly incomingdev plus task8allow removals/2reductions; every unrelated entry/nonallow baseline preserved. Tiers exact incomingdev+same5sorted task additions. All12 other own file patches normalized-identical relative to old/new dev, including production timing seams, native/migrated assertions and M1/M2 cleanup; no extra authored file. C2–C4 refreshed. C1 retained only under exception119f9aa2: Mac119.037951755>110 accepted, no numerical-pass claim. Primary explicitly carries0734a342/A-4512 green evidence across this conflict-only merge with no rerun; C5 refreshed from audited prior-head2083tests/2078pass/0fail/5skip+Neovim12/12 and unchanged35Macwholefile logs. Linux131.337114318s disclosed; no fresh merge-head execution/timing claim. Next integrated cover owns combined-tree evidence. Implementer typecheck/tiers green27free/237machine. No findings; C1–C5 verified at6c41aa96 under carry-forward disposition.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-17T14:19:12.173Z

Merged 45242cbc413f0269fc5624cfc7bbe8cffcdf74c2 onto dev.
