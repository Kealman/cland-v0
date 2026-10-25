---
id: T-1036
kind: task
title: explorer-component counts one task.view for an unselected task under load
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1043
branch: t/T-1036-explorer-component-counts-one-task-view
created: 2026-10-21T06:00:35.930Z
updated: 2026-10-25T12:03:04.453Z
closed: 2026-10-25T12:03:04.453Z
---

## Summary

`nvim/test/explorer-component.test.ts` "release rows, derived glyphs, rank then close order, folded roots and za cursor identity" failed once with `tree never fetches detail for unselected tasks`, `1 !== 0`, at line 286. That was on the Linux stage cover at 8f9e38c0 (b7638924 shard-1, A-8134). The file passes 20 of 20 tests in each of 5 runs alone on macOS at the same commit.

## What to build

Find what sends one `task.view` for a task while the cursor stays on E-3. A likely cause is a card or detail fetch fired by a transient cursor position during `za` or the redraw, which the T-1002 explorer card work made reachable. Then do one of two things: make the explorer never fetch detail for a row the cursor only passes through, or make the test wait for the settled cursor before it counts requests. A real extra fetch is a product fix, not a test change.

## Acceptance criteria

- [x] C1. The cause is named in the item topic, with the request that was observed.
  - done: impl-1036 · 2026-10-25T11:29:05.883Z
  - verified: rev-26 [reviewer] · run rev-20261025-1036-source-1 · 2026-10-25T11:30:42.669Z · commit 9511273eb9eb4583612df49d2ad8863ad49f60ac
  - verified: rev-34 [reviewer] · run rev-34-20261025-1036-source2 · 2026-10-25T11:44:34.896Z · commit e62c50b9aec98965e8f112d4a1fd4fa9f21ebd89
  - verified: rev-34 [reviewer] · run rev-34-20261025-1036-final · 2026-10-25T11:57:09.355Z · commit e62c50b9aec98965e8f112d4a1fd4fa9f21ebd89
- [x] C2. The test passes 20 sequential repetitions on a droplet at workers 2, and the assertion that unselected tasks are never fetched stays in place (evidence in the item topic).
  - done: impl-1036 · 2026-10-25T11:42:40.986Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1036-final · 2026-10-25T11:57:09.355Z · commit e62c50b9aec98965e8f112d4a1fd4fa9f21ebd89

## Comments

### impl-1036 · 2026-10-25T11:26:45.924Z

C1 red reproduction (macOS local, ff73a3d0 + settled-card test wait): observed task.view E-3 then task.view T-10 while E-3 remained selected; assertion `tree never fetches detail for unselected tasks` failed 1 !== 0. Cause: explorer_card.compose latest descendant verdict calls item_view.get(owner.id, {summary_only=true}), which still fetches. The card-follow delay races the prior assertion. Fix: read existing descendant cache only. No wire/schema shape changes. Local coverage: existing T2 explorer-component seam plus explorer-card-component (uncached/cached descendant reason); C2 will use mapped T4 shared-case 20 sequential repetitions on droplet workers 2 as Coordinator instructed.

### rev-26 · 2026-10-25T11:30:42.669Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1036-source-1
commit: 9511273eb9eb4583612df49d2ad8863ad49f60ac
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full in-session Standards/Spec audit CLEAR, A-11808. C1 verified: observed task.view T-10 while E-3 stayed selected comes from descendant latest-verdict item_view.get; summary_only still fetches, and card-follow timing raced the old request count. Production now uses existing cache only, retaining cold summary verdict facts and omitting uncached reason as Coordinator directed. Shared T2/T4 case retains all original assertions, adds settled-card/same-stream reply receipts, and runs 20 complete sequential child cases under mapped T4. C2 remains unchecked/runtime-pending for exact-head Linux droplet workers-2 receipt. Local A-11802 summary/precommit capture limits retained; no runtime/QA/landing pass claimed. Generic new-test duration gate remains separate from no T4 tier budget.

Criteria: C1 verified.

### impl-1036 · 2026-10-25T11:42:40.918Z

Linux behavior evidence (not an overall green run): A-11835 / run 7ee71778 at reviewed 9511273e, c-8 lon1 Linux x64, Node 24.21.0, Neovim 0.12.5, workers 2. Exact generated parent `explorer settled card preserves unselected-task isolation 20/20` and children `explorer case 1` through `explorer case 20` each have passing finish records; parent 12.329751445 s includes setup/teardown. T0/T1/T2 completed exit 0; T4 assertions passed but enforced generic new-identity gate failed 12.33 > 5 s; Web did not run. No ordinary T3 ran. Remote lifetime 590 s, cost $0.0410. Added only measured E-1282 allowance 19 s (ceil 1.5x sample), per Coordinator instruction; all assertions, waits and teardown unchanged. Fresh source review and new-head mode-free verification required before final evidence review.

### rev-34 · 2026-10-25T11:44:34.896Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1036-source2
commit: e62c50b9aec98965e8f112d4a1fd4fa9f21ebd89
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at e62c50b9, carrying full audit A-11808. Entire correction is one exact-key duration allowance: 19s = ceil(1.5*12.329751445), open E-1282 owner, reasoned run/head/Linux provenance, 2026-10-25 to 2026-11-01 seven-day expiry, directly authorized by Coordinator abe8c0a5. Tests/assertions/repetitions/deadlines/teardown unchanged. Independently checked A-11835 parent and all twenty exact child pass records; old run still failed the enforced generic 5s gate and did not run Web. Standards: no findings. Spec: no findings. C1 unchanged source/item diagnosis verified; C2 awaits successful configured evidence at this exact corrected head. No Reviewer test or browser execution.

Criteria: C1 verified.

### impl-1036 · 2026-10-25T11:56:37.759Z

C2 current-head configured receipt: mode-free run cc94e143-b176-4ed1-895d-0073bea48420 at e62c50b9aec98965e8f112d4a1fd4fa9f21ebd89, log A-11861, overall exit0. T0/T1/T2/T4/Web each exit0; 3175 tests pass, zero failures/skips. Independently parsed exact generated explorer case 1..20: twenty passing finish records, plus parent `explorer settled card preserves unselected-task isolation 20/20` passing in 11.246 s. Twenty sequential shared cases retain zero unselected task.view and all original assertions. Linux x64 c-8 lon1 workers2, Node24.21.0, Neovim0.12.5; lifetime640s cost$0.0444. T4 once in base phase, no extra T4 load repetitions; remaining T3 deferred, absent from configured batch tiers. Enforced generic duration gate satisfied by measured 19s allowance; other tier/lint budgets report-only. Final evidence review requested at unchanged head.

### rev-34 · 2026-10-25T11:57:09.355Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1036-final
commit: e62c50b9aec98965e8f112d4a1fd4fa9f21ebd89
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear: cc94e143 / A-11861, audit A-11863 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11863-t-1036-final-evidence-at-e62c50b9.md). Independently parsed 3175/3175 ordinary passing records. All twenty generated explorer case 1–20 finish records and parent pass; parent11.246003015s is within authorized19s allowance, original zero-unselected-task and cursor assertions retained. Host T0 and Linux droplet T1/allT2/mappedT4 once/Web completed, workers2; no ordinaryT3/otherT4 or extraT4 load repetitions. Prepared-tree host typecheck was not repeated remotely. C1 carries source2 diagnosis; C2 established by twenty sequential child executions. Report-only warnings preserved, prior failed run remains partial failed evidence. No QA required.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T12:03:04.453Z

Merged 9f31a3b7140f6c321eed297b66beca224591589c onto dev.
