---
id: T-1464
kind: task
title: Periodic dev T3 skips a run when a newer integrated or stage cover just passed
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1229
branch: t/T-1464-periodic-dev-t3-skips-a-run-when-a-newer
created: 2026-10-30T05:44:58.711Z
updated: 2026-10-30T12:27:05.529Z
---

## Summary

Periodic dev T3 cost $9.01 and 35.9 h in v0.3.0 (25 % of spend); three runs repeated what the stage covers had just proven (retro A-14149). Skip a periodic run when an integrated, stage or release cover at the same or a newer dev tip passed within the last hour, and say so in the notice. Retro v0.3.0 change 4.

## Acceptance criteria

- [x] C1. A periodic tick after a fresh green cover at the same tip records a skip naming that cover.
  - done: impl-1464 · 2026-10-30T11:55:26.886Z

## Comments

### impl-1464 · 2026-10-30T10:18:39.809Z

Rule-20 consumer inventory: scheduler #checkDevT3 and suite-job durable records (suites.ts/Store); SuiteCandidate production and suite-unit/suite-component/harness/remote fixtures plus suite scheduling/queue tests; daemon onSoakNotice and dispatch periodic result delivery; CLI usage + commands.json fixture; suite-soak T1 and suite-soak-component T2 tests; dev-t3-search/component/probe tests consume admitted jobs unchanged; shared wire/web/nvim read suite projections unchanged. rg searches covered SuiteCandidate, dev-t3-attempt, verification-dev-t3-skipped, onSoakNotice, devT3EveryMs and periodic dev T3 across hub/web/nvim/shared, QA briefs, docs and shipped skills. No wire/persisted job shape changes planned: reuse attempt cursor and existing skip event/notice. Optional ancestry capability on candidate preserves older injected candidates conservatively (same-head remains supported); complete green full-T3 integrated dev receipts only, fresh <=1 hour, positive ancestry for newer cover.

### rev-26 · 2026-10-30T11:54:33.964Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1464-source-1
commit: c303016c2655bf68bdae98041a00e719e8634c31
scope: full
findings: [{"severity":"medium","text":"M1: new raw native Git helper is timeout-only, with no cancellation/process-close owner before fixture deletion. Reuse shared commandIn ownership/sealed env/explicit exits and retain ancestry assertions; fixture also joins native ancestry calls if its observer aborts.","file":"hub/test/suite-soak-component.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14320 full source not clear: one medium Standards lifecycle finding M1; no additional Spec findings. Complete fresh-cover policy, compact summary compatibility and existing negative/restart assertions otherwise match request. No Reviewer workloads. Correct shared native ownership without weakening final facts, then exact-head source review before verification.

Criteria: C1 failed (New native ancestry proof lacks cancellation and close-before-directory-removal ownership; replacement source and configured execution needed.).

### rev-26 · 2026-10-30T11:56:46.093Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1464-source-2
commit: ea04b0eba3e3b603ed174a43c63fb1d55874d78a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14324 source2 clear: sole M1 resolved with shared scratchMachine/commandIn setup and caseDeadlines pending ancestry drainage before proxied cleanup; assertions preserved. Production policy/T1 unchanged from full source1. No Reviewer workloads. C1 runtime remains pending exact-head configured evidence and final review; local receipts not a configured pass.

### rev-26 · 2026-10-30T12:14:07.910Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1464-evidence-1
commit: ea04b0eba3e3b603ed174a43c63fb1d55874d78a
scope: evidence
findings: [{"severity":"medium","text":"Original A-14344 fails Inbox archive locator visibility within3000ms (5.241889533s case). Cause/classification unresolved; whole configured result blocks final clearance despite new policy cases passing.","file":"web/test/phone-asks.test.ts","line":195}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14346 original audit:4271ordinarypass1fail+205loadpasses;20newpolicy/ancestrycases base+5/5load each. T0/T1/allT2pass,Webfail,T3/T4unrun. Source2clear retained separately; C1 final mark pending admissible green evidence. No flake/shared attribution assumed and no Reviewer workload. Hold head/retry for Coordinator disposition.

### impl-1464 · 2026-10-30T12:20:20.302Z

Coordinator-authorized temporary evidence exception (2026-10-30T12:19:57.872Z, Agents msg 75144d46-165f-46c4-b27f-2c1b8e58c530): run 98026613 / A-14344 at ea04b0eba has exactly one failure, web/test/phone-asks.test.ts::a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure. Coordinator identified a time bomb: fixture FakeClock pins 2026-10-23T12:00Z but archive 7-day filtering partly reads real time, expiring at 2026-10-30T12:00Z on every head. Shared fix is T-1485. Until it lands, Coordinator says a run whose sole failure is this identity counts as passing with this exception stated on the item (rule 7), and explicitly says T-1464 must not resubmit. A-14344 remains recorded as native exit1; exception is disposition, not a rewritten green receipt. T0/T1/all T2 passed; Web carries this one exception; T3/T4 unexecuted. Final evidence review requested with source-clear A-14324 plus original A-14344 and this authorization. Solo/historical diagnosis receipts A-14350/A-14351/A-14354 remain separate.

### impl-1464 · 2026-10-30T12:27:05.529Z

Coordinator correction at 2026-10-30T12:26:40.710Z (Agents msg7667fab0-4a60-4a2f-83a1-98e8425f9bca) supersedes earlier evidence-exception interpretation: phone-asks exception applies only to Coordinator merge-gate decision; Reviewers do not issue clear evidence on failed A-14344. Final evidence review is held until Coordinator's T3-inclusive verify all after shared fix T-1485 lands. Original A-14344 remains red, source review A-14324 remains clear at frozen ea04b0eba. No resubmission by Implementer.
