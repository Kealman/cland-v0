---
id: T-739
kind: task
title: "ask-chain: 'a question climbs an epic and release one level per forward' failed once in a timed-out droplet run"
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: topic-553
branch: t/T-739-ask-chain-a-question-climbs-an-epic-and
created: 2026-10-17T14:59:41.309Z
updated: 2026-10-19T05:48:02.631Z
---

## Summary

In T-730's run 6569987b (A-4557, line 1189), `hub/test/ask-chain.test.ts::a question climbs an epic and release one level per forward, reaching each fake harness` failed after 9.7 s. The run hit its 75 min timeout before printing a failure summary, so the assertion text is missing. The same droplet was loaded by two 120 s lock waits from T-730's own regression at the time. No other run shows this failure.

## What to build

Triage: run the case whole-file 10/10 on the Mac at dev. If it's red, find the cause. If it's green, watch the next covers, and close this as a one-off if it doesn't recur in five integrated runs.

## Acceptance criteria

- [x] C1. Either the cause is named and fixed with the case passing 5/5 on the Mac and once in a droplet verify, or five consecutive integrated covers pass it and the ticket closes as a one-off under load.
  - done: impl-739 · 2026-10-19T05:47:16.205Z
  - verified: rev-31 [reviewer] · run rev-20261019-739-final · 2026-10-19T05:48:02.113Z · commit 1497dcf76f4906e3a42d8138806e24d2aec9d9fe

## Comments

### impl-739 · 2026-10-19T05:37:03.197Z

Implemented receipt-based synchronization for the T2 ask-chain fixture at 1497dcf76f4906e3a42d8138806e24d2aec9d9fe. The old test forwarded before receiving-Lead observation and considered fake.injections (recorded before adapter acceptance) a harness-completion receipt. Controlled held injections prove delivered != injected; each hop now observes its channel event and confirmed injection before forwarding. Preserved every original behavioral assertion, strengthened the hint check to the exact ask ID, and removed polling. The original timed-out run omitted its assertion text, so exact historical attribution remains unavailable.

Evidence: A-5793 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5793-t-739-controlled-delay-diagnosis-and-mac-repetition-evidence.md. Controlled-delay red (0.474s) to green; 20/20 serial macOS whole-file runs (260 tests, 42.930s summed; 1.977–2.651s per file); final typed source run 13/13 in 2.348s. npm run check (host lint + both typechecks) passed. origin/dev fetched and merged before review; only tracker metadata changed in that merge. No required per-item QA scope or QA criteria; source review requested before mode-free droplet verify.

### rev-31 · 2026-10-19T05:40:44.040Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-739-source
commit: 1497dcf76f4906e3a42d8138806e24d2aec9d9fe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-739 source review: clear

Head: 1497dcf76f4906e3a42d8138806e24d2aec9d9fe
Fixed base: c5d545d0c976a4b1f58d395d416769b9ef24198a
Scope: full. Only hub/test/ask-chain.test.ts changes.

Standards: clear; no findings. The T2 fixture keeps FakeClock frozen and uses existing in-process session, adapter and real-frame seams. Each receiving Lead first observes its correlated channel event and delivered stage. Before release, history must still say delivered. After fake.settle, a separately bounded exact-message injected frame and final history assertion establish completion before forwarding. The hint assertion now matches the exact ask ID. No polling, sleep, subprocess, tier change, allowance or baseline update is added.

Held-injection failure cleanup is owned by projectHub's beforeDirectories stop. Core.close and Dispatcher.close do not join these injection promises before adapter shutdown; Sessions.close synchronously closes every adapter, and FakeHarness.close rejects every pending hold and clears timers. That owner runs before fixture removal. Existing topic cancellation, duplicate-forward, stale-answer, recipient routing and whitespace assertions remain.

Spec: clear source for the reproduced current test-ordering defect. The old fake.injections entry recorded an attempt before acceptance; the held-injection red control proves delivered is not injected. Both Lead hops now await acceptance before the next action. This does not establish the missing historical assertion or explain A-4557's timeout.

A-5793 and A-5797 retain controlled red output, serial runner summaries for 20/20 Mac whole-file runs (13 passes each), and one complete exact-source 13/13 run (2.348 s file; target 0.167 s). Full successful child transcripts for the 20 repetitions were discarded, so those receipts are aggregate runner evidence, not independently inspectable per-case transcripts. The repeated runtime source preceded only an erased Session type import/parameter annotation; the complete final run exercises the committed source. Host lint and both typechecks are reported green. No Reviewer test run was performed.

Coordinator decision 0030d4e9-30db-4e80-9bea-c6b9787af51f independently confirms C1's accepted route is this reproduced current defect plus retained assertions, Mac repetitions and the required same-head droplet task proof. The five-cover route is not required. Historical attribution remains explicitly unavailable.

Result: source clear. C1 remains unverified pending positive exact-head droplet evidence. Submit one mode-free configured task verification at this unchanged head; no full-suite request or per-item QA. Any head change needs fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5798.

### impl-739 · 2026-10-19T05:47:23.705Z

C1 marked done after same-head mode-free droplet verify 619a0281-3139-42fe-9b4c-c9029efd8bab passed at 1497dcf76f4906e3a42d8138806e24d2aec9d9fe. hub-selected T0–T2 result: 385 tests passed, zero failures/cancelled/skipped; selected ask-chain file 13/13 passed. Linux x64 6.8.0-142-generic, Node v24.21.0, c-8 lon1; droplet lifetime 320s, cost $0.0222. Exact log A-5800: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5800-suite-619a0281-3139-42fe-9b4c-c9029efd8bab-auto-at-1497dcf.log. No head change after source review. This completes the Coordinator-accepted current defect route; historical A-4557 attribution remains unavailable. Reviewer already received the result directly and is settling final evidence.

### rev-31 · 2026-10-19T05:48:02.113Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-739-final
commit: 1497dcf76f4906e3a42d8138806e24d2aec9d9fe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-739 final evidence review: clear

Head: 1497dcf76f4906e3a42d8138806e24d2aec9d9fe, unchanged from source review rev-20261019-739-source / A-5798.
Run: 619a0281-3139-42fe-9b4c-c9029efd8bab / A-5800, raw exit 0.
Scope: evidence. Branch tip and task receipt independently match; C1 is claimant-done.

Standards: clear; no findings. All 13 ordinary ask-chain cases positively finish pass, with no skip, cancellation, quarantine or runtime tier mismatch. The corrected question-climbing case passes in 0.336039061 s (A-5800:41535); the whole file sums to 3.694762862 test-seconds, and its file process finishes in 4.442153264 s. Every owned case is below the T2 2 s budget (maximum 0.869855663 s). No owned or global per-test budget overrun is reported in this receipt. Both shard failure arrays are empty. The 147 reported new-identity load gates all pass 5/5; the unchanged ask-chain identity has no separate new-identity gate, so no Linux five-repetition claim is made for it.

Spec: verify C1 through the accepted fix route. Source review establishes the reproduced current attempt-versus-acceptance defect, correlated channel and injected receipts before forwarding, pre-release assertions, owned hold cleanup and retention of all original behavioral assertions. A-5793/A-5797 retain 20/20 Mac whole-file runner summaries (13 passes each), controlled red output, and a complete final exact-source whole-file pass. Their successful-child transcript retention and erased type-only source-equivalence limits remain as disclosed in A-5798.

Coordinator decision 0030d4e9-30db-4e80-9bea-c6b9787af51f explicitly accepts this reproduced current defect plus Mac and same-head droplet evidence as C1's first route. A-5800 now supplies the required positive Linux execution. This does not recover the missing historical assertion or establish why A-4557 timed out; the five-integrated-cover route is not claimed.

Overall ordinary result: 385 tests, 385 pass, zero failure/cancelled/skip/TODO (372 whole-T1 phase plus 13 selected hub T2). Host check includes lint and both typechecks. Runtime trips are absent; existing static lint findings and 22 missing duration baselines remain disclosed external report-only debt. T3 remains deferred to the merge batch under the task protocol; no T3 execution, integrated-cover pass or completed batch landing is claimed. Reported T3 ratchet is unchanged at 2651.501 s versus base 2651.501 s, with incomplete timings separately disclosed.

Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5 installed; lifetime 320 s, cost $0.0222, peak load 3.72. Suite duration 222.94 s including 178.10 s load-gate extra wall. No additional task verification or per-item QA required.

Result: final clear; C1 verified.
Findings: Standards 0; Spec 0.

Evidence: A-5801.

Criteria: C1 verified.
