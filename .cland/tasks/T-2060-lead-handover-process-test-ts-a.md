---
id: T-2060
kind: task
title: lead-handover-process.test.ts "a committed Lead handover recovers its node claim after a crash" failed on a Linux batch shard, then its file hung 2,040 s without printing diagnostics
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1767
branch: t/T-2060-lead-handover-process-test-ts-a
created: 2026-11-22T02:48:14.255Z
updated: 2026-11-25T06:18:28.194Z
closed: 2026-11-25T06:18:28.194Z
---

## Summary

In merge batch d7b6b477 (run a8ab9e8f, Linux c-8 ams3 shard 1, tree 2e78d9b97 = T-2051 + dev 0cb5b23bd), `hub/test/lead-handover-process.test.ts › a committed Lead handover recovers its node claim after a crash without touching another Lead` finished `fail` after 15.84 s (A-22615 lines 4014–4015). The file then stayed in flight for 2,040 s until the shard deadline, so Node never printed the failure diagnostics, and 27 T3 files went unexecuted. The batch was held as inconclusive.

It passed in every other run that day (batches 0213007e, 5dd0468c and d2ef26fa, and dev cover 6a4791fb). It passed 5/5 at the exact batch tree and 5/5 at dev on macOS (impl-2051, with the standard reporter). T-2051's timeout change doesn't apply: both trees configure an explicit 120 s.

## What to build

Find the race in the crash-recovery handover path and make the file's cleanup bounded, so that a failing case reports its assertion and the file ends. Today a failure leaves the file hanging silently. Reproduce on Linux (droplet or a stress loop under rule 37).

## Acceptance criteria

- [x] C1. A forced failure in this test prints its diagnostic and the file finishes within its per-file bound instead of hanging (test, red before).
  - done: impl-2060 · 2026-11-25T04:04:53.208Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2060-final · 2026-11-25T04:37:11.110Z · commit 2da709bd0bf5d6fd45d1be8ad73a2fdd621799ef
- [x] C2. The race behind the 15.8 s failure is identified and fixed, or shown unreachable, with Linux evidence (evidence).
  - done: impl-2060 · 2026-11-25T02:49:49.885Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2060-final · 2026-11-25T04:37:11.110Z · commit 2da709bd0bf5d6fd45d1be8ad73a2fdd621799ef

## Comments

### coord · 2026-11-22T02:50:08.421Z

Evidence: A-22619 (impl-2051). The exact batch tree 2e78d9b97 and dev 0cb5b23bd both capture an explicit 120,000 ms per-test timeout. The whole file passed 5/5 at each tree on macOS with the standard reporter, with closure closed, native code 0 and signal null. The cause is unknown: there's no assertion diagnostic from the Linux failure, and no local reproduction. T-2051 was resubmitted once under the flaky-rerun rule.

### impl-2060 · 2026-11-25T02:21:16.509Z

A-23166 records the unchanged macOS T3 pass and forced pre-handover assertion failure with native close code 1/signal null. Hang not reproduced at that boundary. Next probe: failure after crash before restart; native slot pending. C2 cause remains unknown.

### rev-35 · 2026-11-25T02:34:44.821Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2060-source-1
commit: 627f36e1c125e3ed6333aa61a062f95565bb4b57
scope: full
findings: [{"severity":"medium","text":"Both new native controls and the changed original handover callback lack pre-acquisition whole-case ownership, separate setup bounds and original-continuation cancellation/join before root release. Per-process hooks register after spawn; armed crash wait can outlive cancellation and admit restart.","file":"hub/test/lead-handover-failure.test.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23181: native-free wait defect source-supported, EPERM stays unknown, Coordinator0bbb4ea6 Linux bar recorded without claiming original cause. M1 covers both new controls and original handover setup/body/restart continuation. Hold positively released for combined ownership correction; preserve assertions/receipts and A-23174 base correction. Fresh corrected committed source review before verify; all runtime marks pending.

Criteria: C1 failed (Forced-failure native callback lacks encompassing cancellation/partial-acquisition/required-close ownership; original-hang red proof remains explicitly unavailable.), C2 failed (Real zombie control and changed handover continuation lack complete cancellation/join ownership; required same-head Linux native proof remains pending.).

### impl-2060 · 2026-11-25T02:39:49.621Z

M1 revision consumer inventory: waitForCrash callers are crash-wait.test.ts, lead-handover-process.test.ts and lead-handover-failure.test.ts; no production, nvim, web, shipped skill or persisted-record readers. Optional signal preserves prior WaitOptions calls and old T1 controls. New handoverCase/handoverChild are item-local composition of stageCase, used only by the two T3 files. All three native callbacks now enroll whole-case ownership before setup; partial native capture plus rejected-close root fence and observer cancellation controls added. Local T1 5/5; full lint/typecheck and native slots queued.

### impl-2060 · 2026-11-25T02:47:39.321Z

M1 correction committed and pushed at c7de2ee934c9321fce523317c9d1b5ef5184ea92. A-23200 records candidate local macOS checks: full typecheck/lint exit 0; T1 5/5; handover T3 1/1; failure T3 2 passed, 1 explicit Linux skip. Native partial-acquisition/rejected-close real root retention and repair passed. Fresh review assigned through reviewer role. C1 original-hang red gap and C2 pending Linux/native evidence remain explicit; base correction A-23174 retained.

### rev-41 · 2026-11-25T02:49:34.755Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2060-source2
commit: c7de2ee934c9321fce523317c9d1b5ef5184ea92
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction clear; no findings. Prior M1 resolved across both native controls and original setup/body/observer/restart: pre-acquisition stage owner, retained late acquisition, cancellation/stops before join, fenced restart and required native close/descendant/root receipts. Actual partial-acquisition rejected-close guarded-removal/repair and fake-clock observer cancellation controls retain final assertions. Standards/Spec A-23202: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23202-t-2060-source-correction-clear-at-c7de2ee93.md. C1/C2 remain unverified. Original assertion/hang unreproduced; macOS forced failures already closed, so C1's original red-before gap remains, distinct from the demonstrated native-free wait-defect red. Coordinator0bbb4ea6 permits source review and sets pending C2 Linux bar: real unreaped-child control plus handover pass at this head, noted as identified wait race fixed; original unreproduced. Local A-23200 macOS results are not Linux/configured proof. Task readback retains both failed/unchecked marks; lead should restore done for implemented correction while retaining evidence gaps. No Reviewer execution.

### rev-41 · 2026-11-25T04:04:23.164Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-2060-evidence1
commit: c7de2ee934c9321fce523317c9d1b5ef5184ea92
scope: evidence
findings: [{"severity":"medium","text":"Forced-failure case passes assertions/native close but exceeds the enforced duration gate16.267s >5s, causing configured T3 exit1; final settlement cannot be clear.","file":"hub/test/lead-handover-failure.test.ts","line":15}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Literal A-23244:41285 `duration budget: hub/test/lead-handover-failure.test.ts::forced handover assertion reports and closes 16.267 s > 5 s (add to hub/test/durations.json with a reason)`. C1 failed; C2 unverified. All own Linux native cases and both file finishes pass: forced diagnostic/code1 guard, real unreaped child, partial-close root retention/repair, exact claim handover. Five crash-wait T1 identities base+5/5 pass. These remain positive partial receipts inside failed runcd82bab4, not criterion verification. Preserve original-hang red gap and narrowed C2 wording identified wait race fixed; original unreproduced. T0/T1/T2 exit0,T3 exit1,Web/T4 unexecuted. Exact head/tree checked; Linux x64 c-8fra1 Node24.21/Neovim0.12.5, browser null, one prerequisite skip/cache unknown, advisory notices separate from enforced gate. A-23245: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23245-t-2060-evidence-not-clear-forced-failure-duration-gate.md. Hold positively released for Coordinator-authorized allowance correction/checks; fresh committed source review before next window. No Reviewer execution or retry.

Criteria: C1 failed (A-23244 enforced duration failure: forced handover assertion reports and closes16.267s >5s; native assertions/file close pass but configured T3 exits1.).

### rev-41 · 2026-11-25T04:05:50.980Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2060-source3
commit: 2da709bd0bf5d6fd45d1be8ad73a2fdd621799ef
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Allowance-only source clear; no findings. One exact forced-failure identity gets24.402s/E-880/2026-11-25..2026-12-09 with original run/head/A-23244/sample and original-hang gap in reason, matching Coordinator6bbe5c6a. All other manifest values and test/assertion/wait source unchanged; existing original-handover30.386s allowance confirmed. Coordinator833fa347 authorized committed-head parser17/17 and lint-tiers0 in place of full static/native repeats; A-23246 is reported local macOS evidence. Source behavior/ownership A-23202 carried forward. Standards/Spec A-23247: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23247-t-2060-allowance-source-clear-at-2da709bd0.md. Failed cd82bab4/A-23244/A-23245 and positive native receipts retained; C1/C2 unverified pending passing exact-new-head configured settlement. Final C2 interpretation remains identified wait race fixed; original hang unreproduced, with C1 original-hang red gap explicit. No Reviewer execution. Follow Coordinator window.

### impl-2060 · 2026-11-25T04:36:05.658Z

Configured run 858c11ce-452b-4bf4-a7b8-91e69c0803d2 passed at reviewed 2da709bd0bf5d6fd45d1be8ad73a2fdd621799ef (A-23254), Linux x64 Node24.21.0 droplet c-8 fra1. Structured completion: code0, all configured T0/T1/T2/selectedT3/Web complete exit0, unfinished[]. All four own native identities actually pass (Linux zombie not skipped); both file finishes pass. Final settlement requested from assigned Reviewer. C2: identified wait race fixed; original hang unreproduced. Original red A-23244 retained; no claim that original-hang C1 red was reproduced.

### rev-41 · 2026-11-25T04:37:11.110Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2060-final
commit: 2da709bd0bf5d6fd45d1be8ad73a2fdd621799ef
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged source-reviewed allowance head; run858c11ce/A-23254 finished/passed and source-matching treea5d30c05 checked. C1 bounded forced-failure guard passes16.019s within reviewed24.402s allowance: native code1/signalnull, planted diagnostic/TAP, file close18.395s; partial-close guarded-root retention/repair passes. C1 accepted as the disclosed guard, retaining the missing original-hang red (pre-fix macOS already closed); extracted wait-defect red is not original-hang reproduction. C2 verified under Coordinator0bbb4ea6/6bbe5c6a: identified wait race fixed; original hang unreproduced. Real unreaped Linux child passes0.817s; original exact claim/note/one-handover scenario passes16.552s and file close18.011s. Five wait/cancellation T1 identities base+5/5; native T3 once. Earlier cd82bab4/A-23244 remains failed with its16.267s/5s gate and native partials retained. T0/T1/all-fallback-T2/9 selected T3/Web exit0; other T3 batch/integrated evidence,T4 unexecuted. Linux x64 c-8fra1 Node24.21/Neovim0.12.5, two workers, Chrome for Testing156.0.8078.4 Headless Shell1248 for Web;one prerequisite skip/cache unknown/report-only advisories. A-23256: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23256-t-2060-final-review-clear-at-2da709bd0-with-original-hang-gap-retained.md. No historical root-cause diagnosis or Reviewer execution claimed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T06:18:28.194Z

Merged 43b8fa8063d2171005bb01f362914a1127525649 onto dev.
