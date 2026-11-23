---
id: T-2064
kind: task
title: Under load the merge tests merge before the reviewed task's ready status and review freshness settle, so merge-policy and merge-recovery-native fail with review-pending or merge-not-ready on macOS
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
regression_of: T-2055
found_by: cover
topic: topic-1716
branch: t/T-2064-under-load-the-merge-tests-merge-before
created: 2026-11-23T18:41:27.464Z
updated: 2026-11-23T21:13:43.132Z
closed: 2026-11-23T21:13:43.132Z
---

## Summary

macOS epic cover 857f8e7c (2026-11-23, dev 40f68c7d9, A-22674, local darwin arm64, peak load 7.1) failed three T3 cases:
- `hub/test/merge-policy.test.ts › queue-enabled reviewed documentation lands immediately with its review receipt`, with `review-pending: T-1: review is still checking freshness; try again`;
- `merge-policy.test.ts › enqueue refuses a conflicting queued member immediately with its item and files`, which got `review-pending` where it expected `merge-conflict`;
- `hub/test/merge-recovery-native.test.ts › a close write failure reports merged follow-up failure; retry closes and prunes without a second commit`, with `merge-not-ready: T-1: status backlog; ready required`.

Both files pass at load about 3 on the same Mac and commit (26/26 and 12/12), and they passed on Linux batches and covers. The cause is timing: since T-2050 (ready waits for a completed same-head receipt) and T-2055 (merge admission requires ready and a receipt), these fixtures call merge before the asynchronous review-freshness and ready transitions have settled.

## What to build

Make each case wait for the task's observable ready state, and for review-freshness settlement, through the public seam before it merges. That's an owner wait with a named setup bound, not a fixed delay. Alternatively, have the fixture create the state synchronously. Check whether `review-pending … try again` right after a fresh verdict is also a production papercut for a CLI `cland merge`. If it is, report it as a separate finding; keep this item to the tests unless the fix is trivial. Search every merge-path test that merges right after a verdict (rule 20), the T2 and T3 merge and merge-queue files included.

## Acceptance criteria

- [x] C1. The three named cases pass 5/5 on macOS under an added CPU load of about 7, and still pass on Linux (evidence).
  - done: impl-2064 · 2026-11-23T20:25:34.507Z
  - verified: rev-35 [reviewer] · run rev-35-2064-evidence-1 · 2026-11-23T20:27:15.234Z · commit a3ad152d3ed0636c40b66e02f43c68f652ae9c5f
- [x] C2. Every merge-path test that merges right after a verdict waits on the observable ready or freshness state instead of racing it, listed in the item (test).
  - done: impl-2064 · 2026-11-23T19:37:25.936Z
  - verified: rev-35 [reviewer] · run rev-35-2064-source-4 · 2026-11-23T19:38:29.785Z · commit a3ad152d3ed0636c40b66e02f43c68f652ae9c5f
  - verified: rev-35 [reviewer] · run rev-35-2064-evidence-1 · 2026-11-23T20:27:15.234Z · commit a3ad152d3ed0636c40b66e02f43c68f652ae9c5f

## Comments

### impl-2064 · 2026-11-23T18:49:53.473Z

Consumer audit: docs/evidence/T-2064-merge-waits.md inventories merge/native helpers and importers, T2 recovery and queue, T1 queue/batches, scenarios and clients. Tests only; public task.view ready plus current review observation; no production contract or frozen bytes changed. Local red reproduced review-pending and merge-not-ready. Three selected cases passed 5/5 under 8 owned CPU workers on macOS; Linux proof pending exact-head configured verification.

### rev-35 · 2026-11-23T19:03:54.210Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2064-source-1
commit: 9cdd713832bb44c15d917f23d1f7afc246daaedc
scope: full
findings: [{"severity":"medium","text":"M1: the new observation uses bare eventually, and new Tracker.start/setup paths plus native/T2 callers lack an encompassing pre-acquisition callback owner that joins pending observation/setup before fixture/root/seam release. Existing close hooks do not establish cancellation/timeout or success-only restoration. Enroll these exact paths in the shared owner with separately named setup bounds and positive close receipts; retain one-shot merge assertions.","file":"hub/test/merge-readiness.ts","line":6},{"severity":"medium","text":"M2: the claimed Mac5/5 campaign is not bound to one final source epoch: helper/source changed during round5, no per-round tree/file snapshot retained, and only a narrative of stress liveness/stop/join was exported. Preserve these as observed historical attempts; obtain fixed-reviewed-head command/source/load/owner-completion receipts before treating C1's Mac campaign as established.","file":"docs/evidence/T-2064-merge-waits.md","line":43}]
finding_counts: {"high":0,"medium":2,"low":0}

Two medium findings: M1 new public observation/start paths need pre-acquisition whole-callback ownership, separate setup bounds and positive close/restoration fencing; bare eventually plus existing resource hooks is insufficient. M2 A-22676 is changing-source historical passing attempts, not an exact-final-tree Mac5/5 campaign: no per-round source epoch and raw load-owner liveness/stop/join exported; lead e5f4bef0 confirms limits. Correct public ready/current predicate, refresh/indexed authoritative rebase observations, one-shot merge assertions and consumer inventory are retained positives. T2065 already files separate CLI retry papercut; no production change requested. A-22677 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22677-t-2064-source1-readiness-owner-and-stress-provenance-gaps.md consolidates scope/evidence and existing Coordinator slot limits. C1/C2 failed/unverified. Hold releases for owner correction and fresh source review, then fixed-head Mac/Linux evidence under appropriate Coordinator capacity. No verify at not-clear head, dev merge/full-suite request or Reviewer execution/edit.

Criteria: C1 failed (New wait/start paths lack encompassing ownership; Mac five-round evidence spans source mutations without per-round final-tree/load-owner receipt binding. Retain historical attempts and obtain fixed-head evidence after correction.), C2 failed (Public readiness predicate and inventory are present, but added bare eventually/Tracker.start/native-T2 observations are not joined by an encompassing owner before teardown on timeout/cancellation/rejected close.).

### impl-2064 · 2026-11-23T19:11:56.255Z

Source1 review A-22677 corrections: added pre-acquisition whole callback/subtest fixtureWork ownership, retained named setup and predicate producers, fenced positive resource closure before actual ownDirectory removal/seam release. Three controlled T2 owner regressions pass; disabling producer enrolment supplies the expected red. Source1 campaign A-22676 is historical changing-source evidence, not fixed-head C1 proof. Fresh reviewed-head Mac and Linux evidence remains pending; no native or verify run since review release.

### rev-35 · 2026-11-23T19:19:44.676Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2064-source-2
commit: 711f7148753fb68e9329d99b07a6da24802e60d3
scope: full
findings: [{"severity":"medium","text":"M1 remains: the context proxy forwards mock unchanged, so migrated t.mock.method and t.mock.timers restorations remain owned by node:test rather than the positive-close fence. After a required closer rejects, context teardown can restore those actual seams while retained fixture work/resources remain live; the boolean release control does not exercise this boundary.","file":"hub/test/merge-case.ts","line":47}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22679 records source2 review. M1's original-work, named setup and actual directory-removal controls are resolved; actual method/native mock and mock-timer restoration remains unfenced at merge-case.ts:47–50, confirmed by lead decision 6b81b86e. M2's changing-source evidence wording is corrected; C1 still awaits fixed-reviewed-head macOS loaded and Linux evidence, with no historical failed attempt superseded. No source criterion verified on this not-clear pass. Read-only review; no new execution. Correct this shared restoration seam and request fresh source review at the changed head before verification.

Criteria: C2 failed (The new owner forwards actual context mocks/timers unchanged; their automatic restoration is not fenced by confirmed resource closure on rejected cleanup.).

### rev-35 · 2026-11-23T19:35:12.541Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2064-source-3
commit: 1b9a7a3c064a3749ab1de7792cf1dcb0fc3697ee
scope: full
findings: [{"severity":"medium","text":"M3: the new restoration control acquires its root and installs closer/method/timer seams inside bare owner.run. Neither that whole-callback bound nor pruneCase's whole-case bound separately bounds setup before the rejected-close behavior. Enclose this acquisition/setup in a named owned step; retain the real tracker, direct removal, rejection, repair and final restoration assertions.","file":"hub/test/merge-case.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22681 records source3 review. M1's actual context method/timer restoration fence and real guarded-removal/rejected-close/repair control are resolved. Only medium M3 remains: merge-case.test.ts:22–32 puts acquisition/setup in bare owner.run, with no separate setup observation deadline; lead d18bc5b5 confirms the gap. Enclose that phase in the existing named owned step and retain the complete assertions. C2 failed; C1 remains pending fixed-reviewed-head Mac loaded and Linux evidence. Read-only source/evidence inspection, no reviewer execution. Source3 hold releases for this narrow correction and fresh source review before verification.

Criteria: C2 failed (The new real mock/timer control acquires root and installs seams without a separately named setup bound before rejected-close behavior.).

### rev-35 · 2026-11-23T19:38:29.786Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2064-source-4
commit: a3ad152d3ed0636c40b66e02f43c68f652ae9c5f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22683 records source4 clear. The only two-line change encloses the actual mock restoration control's acquisition/setup in owner.step('actual mock restoration fixture setup', ...) within owner.run, resolving M3 while retaining original producer ownership and every real tracker/removal/rejected-close/repair/final assertion. Prior readiness inventory and resource/root/method/timer restoration corrections remain resolved. C2 verified from source; C1 remains unverified pending the three named cases' fixed-reviewed-head macOS5/5 loaded campaign and Linux evidence. A-22676 remains historical changing-source attempts; A-22682's local checks are scoped producer reports. Read-only review, no reviewer execution. Normal same-head verification may proceed subject to Coordinator grants/slots; no full task suite requested.

Criteria: C2 verified.

### impl-2064 · 2026-11-23T19:50:50.021Z

A-22684 records the fixed-reviewed-head a3ad152d3 Mac C1 campaign: all three exact cases passed five counted rounds; 10 selected commands exit0 with positive case facts. Raw source/command/load/worker launch/liveness/literal stop/reap receipts retained, plus incomplete precursor explicitly excluded. Native slot released; five targeted T1 files passed at same head. Configured Linux evidence remains pending.

### rev-35 · 2026-11-23T19:53:12.111Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2064-mac-evidence-1
commit: a3ad152d3ed0636c40b66e02f43c68f652ae9c5f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial C1 evidence audit clear, not final task settlement: A-22685 independently checks A-22684's ten selected native exit0 command receipts and exact generated outcomes, confirming each of the three required cases5/5 at the source-cleared head/tree. All45 source/status/load/worker snapshots agree; sampled one-minute load8.33252–10.39990, eight captured same-parent/same-birth workers running; literal stop plus8 parent wait/reap signal15 receipts, parent exit0 and empty final ps establish shutdown. Local macOS arm64 Node24.21.0, no browser/provider; selected cases only, timing report-only. Epoch1 incomplete precursor remains unknown/excluded and A-22676 stays historical. Five post-release T1 files19/11/19/4/5 confirmed, not complete T1. C1 remains unverified pending Linux; C2 keeps source4 verification. Admitted a4604720 is pending, no pass inferred. Read-only review; no duplicate run/source change requested.

### impl-2064 · 2026-11-23T20:25:34.837Z

Configured same-head Linux run a4604720 finished passed (A-22686): T0, all T1/T2 fallback, selected T3/importers and Web; 7544 passed,0 failed,1 Mac-only prerequisite skip. The three C1 generated case pass receipts are present. Mac5/5 independently accepted A-22685. C1 implementer done marked; Reviewer same-head settlement pending. Remaining T3 and integrated Mac epic cover belong to merge/Coordinator flow.

### rev-35 · 2026-11-23T20:27:15.234Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2064-evidence-1
commit: a3ad152d3ed0636c40b66e02f43c68f652ae9c5f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-22687 consolidates source4/A-22683, audited Mac5/5/A-22685 and completed Linux a4604720/A-22686 at unchanged a3ad152d3. All three required Linux generated cases have matched start/finish pass receipts (4.669495139s,15.109601441s,7.547151812s); all four new ownership/restoration controls pass base+5 distinct loaded executions. C1/C2 verified. Hub aggregate7545 tests/7544pass/1prerequisite skip/0fail/cancel/todo, plus separate20loadedpasses/5prerequisite skips. File receipts match all243T1/445T2/55Web and selected16T3;257T3 deferred batch,18T4 unexecuted. LocalT0 and Linux droplet c8sfo2 Node24.21.0/Nvim0.12.5, Headless1248/CfT156.0.8078.4; timing/ratchet/lint report-only. Verification tree d5e295bf differs from Git source tree7546ef4b; cache flag null unknown. Existing three F2 finish-only entries remain separately accounted. Historical changing-source Mac attempts and unknown precursor remain excluded, not reclassified. Read-only audit; no additional run/source change or manual Coordinator relay requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-23T21:13:43.132Z

Merged de6e4664fcd3b0cc708ecb9512b2698bbd61d254 onto dev.
