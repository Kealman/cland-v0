---
id: T-1641
kind: task
title: The Discord 620-message history test times out at 10 s on a loaded droplet
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
topic: topic-1613
branch: t/T-1641-the-discord-620-message-history-test
created: 2026-11-02T20:13:15.234Z
updated: 2026-11-18T09:16:14.503Z
closed: 2026-11-18T09:16:14.503Z
---

## Summary

`hub/test/telegram-polling-restart.test.ts:346` "Discord fresh history forwards newest 500 of 620 once with one silent overflow line" failed in T-1631's verify run 8a85617c (Linux droplet, A-15966) with `Error: 500 inputs and overflow settlement: not within 10000 ms` (until.ts:26). T-1631 is a docs-only split. The test passed 5/5 alone on macOS at 20:12Z. Its duration has been rising today: 5.17 s in its baseline, then 6.15–6.18 s in batches, already over its 5 s per-test budget.

## What to build

Make the settlement wait event-driven or proportional to its work, not a fixed 10 s wall-clock deadline (rule 23, wall-clock waits). If the work itself grew, bound it so the test stays inside its budget.

## Acceptance criteria

- [x] C1. The test settles without a fixed 10 s wall-clock deadline, and passes 20/20 under a load gate at 10 (test).
  - done: impl-1641 · 2026-11-18T06:52:03.759Z
  - verified: rev-39 [reviewer] · run rev-39-1641-final-20261118 · 2026-11-18T07:57:10.145Z · commit 9989548111dd0b2cd6d5ee4bcd84c3c651117b81
- [x] C2. Its per-test time returns under its budget, or it gets a dated allowance with samples.
  - done: impl-1641 · 2026-11-18T06:52:04.269Z
  - verified: rev-39 [reviewer] · run rev-39-1641-allowance-source-20261118 · 2026-11-18T07:32:55.353Z · commit 9989548111dd0b2cd6d5ee4bcd84c3c651117b81
  - verified: rev-39 [reviewer] · run rev-39-1641-final-20261118 · 2026-11-18T07:57:10.145Z · commit 9989548111dd0b2cd6d5ee4bcd84c3c651117b81

## Comments

### impl-1641 · 2026-11-18T06:19:28.913Z

Implementation in progress: existing case now observes the 500 Outage input frames plus exact source sent-overflow receipt through shared testWaitMs per-input observation headroom. Named exact 500 ms independent responsiveness bound preserved. Pure fake-clock red/green evidence A-21063; loaded 20/20 and full-scale duration samples pending quiet over/native slot. No criteria marked done yet.

### impl-1641 · 2026-11-18T06:52:04.823Z

C1: A-21089 records 20/20 full-scale selected-case passes at start load 13.7974–16.6055, six owned generators closed before slot release; earlier partial 4/4 plus load-gate stop retained separately. C2: normal-load top-level case 4.360645209 s below 5 s; stress timing excluded from allowance decisions per Coordinator. Mode-free verify timing still required. A-21063 is test-first evidence; latest pure T1 recheck 12/12, full lint zero refusals, typecheck passed. origin/dev merged once before first review (already up to date).

### rev-35 · 2026-11-18T06:59:05.359Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1641-source-1
commit: cc3aa5cde530832a143fb229a18da5f78498af48
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21095 full source clear, Standards0/Spec0, Git tree1b18d38cf1a21f30bf0811448d6aab4961df9cda / fixed base303b482b82f898df49c31449b70417880005152f. Shared complete-Clock until/testWaitMs proportional backstop requires exactly500 Outage frames plus captured-source sent overflow; separate setup budget. Exact500ms independent responsiveness call and all10 original assertions retained, final durable suffix byte-identical. No production/wire/native-launch/tier/budget change; guides/index match. Static auditA-21089 confirms20exact TAP1/1/0fail/cancel/skip plus20nativeclose0/signalnull, loads13.7974–16.6055; source file hashes match current files but were captured after samples, not per-invocation tree pins. A-21092 actual ten/six-generator close tuples confirmSIGTERM and helperexit1(partial4+gate stop)/0(full20), all epochs retained. Normal case4.360645209s vs processwall5.313252958s vs restart3.9776s distinct; stress11.039–17.927s not allowance basis per4f474162. Later T1recheck12/12, fulltypecheck/lint exit0/zero refusals reported; prior compile/sort failures and native/raw limits preserved. C1/C2 runtime unverified until fresh same-head configured evidence; C2 normal-suite duration specifically pending. QA none. New Coordinator window allowed after source clear; no new stress/dev merge/full task-head run requested. Reviewer static reads only.

### impl-1641 · 2026-11-18T07:31:51.817Z

A-21115 configured run b2fd5616 passed 6715/6715 at cc3aa5cde (Linux droplet T0/T1/T2/changed T3/Web), target normal-suite duration5.638849794s exceeded5s. Per Coordinator, added C-216 allowance8.459s expiring2026-11-25, based on that sample and unloaded baseline4.360645209s; stress durations excluded. A-21116 records exact receipt and selected checks. durations*.test.ts53/53, test:tiers, full test:lint zero refusals, full typecheck passed. Test source unchanged; fresh source review/new verify window required.

### rev-39 · 2026-11-18T07:32:55.353Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1641-allowance-source-20261118
commit: 9989548111dd0b2cd6d5ee4bcd84c3c651117b81
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source allowance/docs delta clear, no findings. Compared cc3aa5cde..998954811: only dated duration allowance and per-file guide changed; test/helper source unchanged, prior full source review retained. Read Coordinator6a86c9a1 authorization directly; C-216 open. Exact A-21115 producing target finish is pass5.6388497939999995s (prior head Linux droplet Node24.21.0,2workers); ceil(1.5x to milliseconds)=8.459s. Added2026-11-18/expires2026-11-25, normal-load macOS4.360645209s baseline named, stress excluded, report-only policy unchanged. C2 verified via allowance/samples. C1 and final configured evidence await exact-head run at9989548111dd0b2cd6d5ee4bcd84c3c651117b81; prior-head green is not a final-head receipt. Reviewer ran no tests.

Criteria: C2 verified.

### impl-1641 · 2026-11-18T07:56:19.037Z

Final exact-head configured run ecd0a895 at998954811 passed6715/6715, artifact A-21135. Linux c-8 ams3 droplet, Node24.21.0, workers2; T0,allT1,allT2 fallback,changedT3file9identities,Web completed; remainingT3 deferred to batch,T4 not run. Target case~5.104s within dated8.459s allowance; budget policy report-only. Prior b2fd5616 and loaded20/20 evidence retained. Waiting for Reviewer final settlement; no head change or resubmission.

### rev-39 · 2026-11-18T07:57:10.145Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-39-1641-final-20261118
commit: 9989548111dd0b2cd6d5ee4bcd84c3c651117b81
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at998954811; no findings. Durable runecd0a895-dced-4daa-99f4-e7b810d347e8 finished/passed; A-21135 provenance pins head/runtime treeee18e54de4e950a51a58826d0d86fccca0f3e616, no cache. Independently checked native9/9+file completion and five pure settlement identities5/5. Target pass5.104268385s remains above5s reference but within authorized8.459s dated allowance (C2). C1: independently checked A-21089 complete20 exact target TAP passes and paired nativeclose0/signalnull, starts13.7974–16.6055; prior partial/stopped rounds excluded; unchanged test/helper source and post-sample hash provenance limitation retained. Host T0 and Linux x64 droplet Node24.21.0 T1/allT2/selectedT3/Web passed; isolated HeadlessShell1248 Chrome156.0.8078.4. RemainingT3/T4 unexecuted; budget/lint reports report-only. Prior source A-21095/A-21119 stands. Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T09:16:14.503Z

Merged 651c1baa56bf9139125158300ba61df93dfd6389 onto dev.
