---
id: T-566
kind: task
title: planned-stage query-budget test sits at 94–95% of its 10,000-query limit and fails under droplet load
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-362
branch: t/T-566-planned-stage-query-budget-test-sits-at
created: 2026-10-16T03:20:19.880Z
updated: 2026-10-16T07:19:06.168Z
---

## Summary
On 2026-10-16, T-527's droplet run a679d54c at b6a65756 (A-3633) failed hub/test/planned-stage.test.ts:249, "stage landing and ten close frames keep a fixed query budget": one landing used 10334 tracker queries against the `< 10000` bound. T-527 doesn't touch the tracker. On dev 58696d94, alone on the Mac, it passed 5/5 at 9406–9546 queries. The count includes whatever runs during the `eventually('next stage planned')` poll, so load pushes it over a limit it already sits close to. 9.4k queries for one landing is itself a cost smell (see T-538, T-539).

## Acceptance criteria
- [x] C1. Find what makes one landing issue about 9.4k tracker queries with 64 unrelated items and 8 plans, and either cut it or make the count exclude polling and background work, so the measured number doesn't depend on load; record the cause on this item.
  - done: impl-566 · 2026-10-16T06:49:59.078Z
  - verified: rev-30 [reviewer] · run rev-20261016-566-source · 2026-10-16T06:51:57.775Z · commit 36140373a015a9c7cf4d59d877d46a4366d7d68b
  - verified: rev-30 [reviewer] · run rev-20261016-566-final · 2026-10-16T07:19:05.568Z · commit 36140373a015a9c7cf4d59d877d46a4366d7d68b
- [x] C2. The test passes 5/5 serially on the Mac and once on a droplet with a margin of at least 25% under its bound.
  - done: impl-566 · 2026-10-16T07:18:22.524Z
  - verified: rev-30 [reviewer] · run rev-20261016-566-final · 2026-10-16T07:19:05.569Z · commit 36140373a015a9c7cf4d59d877d46a4366d7d68b

## Comments

### coord · 2026-10-16T06:45:53.252Z

Escalated: integrated cover efaa6344 at dev 4dc49979 went red on this test alone, with 10412 queries and 3 stage checks (A-3791 line 2264); hub 1910 pass otherwise. Coordinator Mac measurements: 9598–9668 at 4dc49979, against 9406–9546 at 58696d94, so the count is drifting up with tonight's merges. One flaky-rule resubmit 1d78a0ff is running. impl-566 was launched to fix forward (rule 6: within the hour; dev unreleasable until green).

### impl-566 · 2026-10-16T06:48:23.091Z

Baseline on 4dc49979: one landing 9598 tracker statements / 3 stage checks; ten closes 7038. Grouped trace A-3795 shows select-kind 2933, per-row select-label 1823, select-blocker 1823, holds 1057, item get 829, plans 493. The label/blocker hydration pair alone contributes 38% (3646 prepares) on top of the selected item row. This is separate from T-538's own-id lookup and T-539's freshness full-list call. Regression at the existing 65-row list boundary fails pre-fix with 130 redundant edge statements, expected 0. Fix selects ordered JSON edge arrays with each item row (same pattern as existing follows_json), preserving referenced-id canonicalization.

### impl-566 · 2026-10-16T06:49:59.365Z

After fix: grouped landing trace A-3797 = 5952 (baseline 9598), with the same 3 stage checks and all other grouped statement counts unchanged; 3646 prepares eliminated exactly. Ten closes 4614 vs 7038 baseline. Temporary tracer removed. Clean Mac serial fresh-process runs A-3799 passed 5/5: landing 5768, 5814, 5952, 5906, 5952 (worst margin 40.48%); closes 4798, 4752, 4614, 4660, 4614. All runs guarded with no targeted PIDs, one-minute load 1.98–2.43. Existing budget remains <10000 and its observation window is unchanged. Full task-card file 6/6 green, including the formerly red 65-row edge-query regression and ordered/nonempty/empty edge assertions. Awaiting reviewed-head droplet for C2 completion.

### rev-30 · 2026-10-16T06:51:57.775Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-566-source
commit: 36140373a015a9c7cf4d59d877d46a4366d7d68b
scope: full

# T-566 source review clear

Head `36140373a015a9c7cf4d59d877d46a4366d7d68b`, pushed branch `t/T-566-planned-stage-query-budget-test-sits-at`; local/origin agree. Fixed point `4dc49979ee387541a360ca4e8661be7170c86b8e`, current fetched dev already present before first review. Reviewed `git diff 4dc49979...HEAD`; one implementation commit36140373, two files,18 additions/7 deletions. task.view confirms live claimant, C1 done and C2 pending. Direct Standards/Spec review; no Reviewer tests, compiler execution, edits or subagents.

## Standards

0 high, 0 medium, 0 low findings. The change deepens existing ITEM_COLUMNS/#hydrate behavior instead of adding a new cache, alias map, schema, global invalidation or polling exception. It follows the established ordered follows_json selection pattern. No unrelated T-538 canonical-self lookup or T-539 freshness-selection change. Whitespace clean.

All three #hydrate entry paths (list, children, get) select ITEM_COLUMNS, so labels_json and blockers_json are supplied consistently. Schema label/blocker values are non-null text; correlated aggregates provide arrays, including empty edge sets, without an outer join's synthetic null row. Inner selections retain the previous order-by-rowid contract. Label strings are parsed unchanged; blocker references still pass individually through the unchanged #canonical resolver. Item ID, parent, regression reference, follows and criterion hydration remain unchanged. The old per-item prepared reads are removed without changing edge writes or canonical storage.

## Spec

C1 verified. I independently parsed A-3795/A-3797 grouped traces: baseline **9598** prepared tracker statements versus **5952** after, both with **3 stage checks**. Exactly **1823 label +1823 blocker =3646** standalone edge reads disappear. Normalizing the expanded ITEM_COLUMNS select text shows **all other grouped statement counts equal**. Ten closes fall **7038→4614** at the same20 stage checks. This is an actual reduction in separately prepared statements; it does not claim that SQLite stops reading edge data internally or eliminate every remaining hydration cost.

The existing planned-stage test, its `<10000` assertion, unrelated-item/plan workload, eventually observation and stage-check window are byte-unchanged (no diff in that file). The fix reduces measured work rather than raising the budget or excluding poll/background work. Remaining totals vary modestly with the observation, but required margin is measured directly instead of claiming perfectly load-independent execution.

The existing task-card list regression now creates nonempty representative edge values, asserts label insertion order `z-last,a-first`, canonical nonempty blocker output and empty blocker output, and requires zero separate label/blocker prepares during the synchronous65-row list boundary. It retains no-item-file reads, already-selected criteria assertions and later completion/query/event checks. A-3796 old-source raw failure is130 extra edge statements versus0, directly proving the removed N+1 class rather than mirroring only returned arrays. Full task-card6/6 and prefixes8/8/typecheck are reported green in A-3800; the latter exercises current-prefix/reference behavior.

## C2 evidence and next gate

A-3799 contains **five serial clean Mac landing passes**: **5768,5814,5952,5906,5952** tracker statements, each3 stage checks; ten-close counts4798,4752,4614,4660,4614. Worst landing5952 leaves **40.48%** below10000, exceeding the criterion's25% margin. Raw summaries show no failures/cancellations/skips; per-run guards report no test PIDs and loads1.98–2.43. Temporary grouped instrumentation is absent from the committed diff.

C2 remains unverified until the fresh exact-head droplet run proves the existing landing case passes with at least25% margin (no more than7500 queries). Ensure its diagnostic count is present in the durable receipt. The overall gate must also pass; any own new failure requires correction/source re-review. No full local suite requested. QA policy none; no per-item QA criterion. Source clear verifies C1 only, with final runtime settlement pending.

Findings: Standards0; Spec0.

Artifact A-3806 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3806-t-566-source-clear-ordered-edge-hydration-removes-3646-redundant-prepares.md

Criteria: C1 verified.

### impl-566 · 2026-10-16T07:18:22.508Z

C2 complete at unchanged reviewed head 36140373a015a9c7cf4d59d877d46a4366d7d68b. Fresh droplet run d9876590 passed (A-3819, lines 2330–2332): landing 6064 tracker queries / 3 stage checks = 39.36% margin under <10000; ten closes 5392 = 46.08% margin. Full selected gate: 1923 passed, 0 failed, 5 skipped, Linux x64 Node24.21.0, peak1m load15.08. Combined with A-3799 Mac5/5 at5768–5952 (minimum40.48% margin), C2 meets both platform requirements. No source/head changes since clear source review; waiting on final Reviewer verdict and Coordinator restart/merge sequence.

### rev-30 · 2026-10-16T07:19:05.569Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-566-final
commit: 36140373a015a9c7cf4d59d877d46a4366d7d68b
scope: evidence

# T-566 final evidence review clear

Reviewed unchanged pushed head `36140373a015a9c7cf4d59d877d46a4366d7d68b`, branch `t/T-566-planned-stage-query-budget-test-sits-at`. Local/origin agree. task.view confirms source C1 current, claimant C2 done, and fresh exact-head run d9876590 passed. Evidence-only final settlement; no new source review or Reviewer execution.

## Standards

No new high/medium/low findings (0/0/0). Source review A-3806 / rev-20261016-566-source stands: the two-file change selects ordered label/blocker arrays through every #hydrate entry path, preserves canonical references, removes the separate per-item prepares, and strengthens the existing list regression. The planned-stage workload, observation and `<10000` bounds remain unchanged.

## Spec

Both C1/C2 verified. Cause/reduction evidence A-3795/A-3797 remains: 9598→5952 Mac landing prepares at equal3 stage checks, exactly3646 separate label/blocker reads removed with other grouped counts unchanged. No claim of eliminating the underlying SQLite edge reads or every other remaining query class.

A-3799 five serial Mac passes are5768,5814,5952,5906,5952 landing queries; worst5952 leaves **40.48% margin**, exceeding25%. Existing source audit independently checked all raw repetition summaries and guards.

Fresh actual Linux c-8 lon1 run **d9876590-33bf-435a-9179-3f90368884d0 / A-3819** at this exact head exits0. Raw diagnostics at2330–2332 report:
- One landing: **6064 tracker queries /3 stage checks**, **39.36% below10000** (well within the required≤7500).
- Ten closes: **5392 tracker queries /20 stage checks**, **46.08% below10000**.

The unchanged planned-stage case passes in6.222s. The strengthened65-row list regression passes in4.763s and all six task-card cases pass; no owned cases skip. This supplies the criterion's once-on-droplet measured margin, not merely a suite pass label.

## Gate

Raw phase counts: hub free38/38; hub machine1873pass/0fail/5skip; Neovim smoke12/12. Total **1928 tests /1923 pass /0 fail /0 cancelled /5 skips**, no hard duration-budget or load-gate failure. Host and delivered root typecheck commands complete, then all selected package phases finish. Mode hub-only, coverage fallback for top-level index-db.ts edit; all hub tests plus Neovim smoke run. This is Neovim smoke, not a full Neovim package claim.

Node24.21.0, Neovim0.12.5, four workers. Suite1475.97s, peak one-minute load15.08, extra load-gate wall14.27s. Lifetime/cost unknown in receipt. Routine known duration-regression notices do not fail the run.

Final review clear; refresh **C1/C2** at36140373. No further verification or head change required for T-566. Coordinator's restart-before-merge hold remains in force; this verdict does not waive it. QA scope none, no per-item QA criteria. No Reviewer tests, compiler execution, source edits, signals or provider actions.

Findings: Standards0; Spec0.

Artifact A-3820 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3820-t-566-final-clear-linux-6064-query-landing-has-39-36-margin.md

Criteria: C1 verified, C2 verified.
