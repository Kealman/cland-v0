---
id: T-1276
kind: task
title: A task landed through cland publish never counts as merged, so its plan stage cannot close
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1281
blocked_by: []
topic: topic-1032
branch: t/T-1276-a-task-landed-through-cland-publish
created: 2026-10-25T09:21:11.429Z
updated: 2026-10-25T10:25:41.674Z
---

## Summary

T-1274 was published with `cland publish t/T-1274-… --item T-1274` (2026-10-25 08:54Z). Publish cherry-picked its three commits to GitHub and merged the branch into dev (f6c64386). Its dev commits carry the `Item: T-1274` trailer, and the item is closed and done. Yet `task plan show E-778` reports its stage "docs findings from the DoD run" as `merged: 0/1`, and the stage stays open even with a complete cover pair (f65c8159/d38d9c6e at tree 9e426a05). Stage closure counts only merge-queue landing receipts. A task whose branch has a branch field but landed through publish is neither "merged" nor "evidence-only".

## Acceptance criteria

- [x] C1. A task whose branch `cland publish` merged into dev counts as merged for plan stage progress and closure, via a landing receipt written by publish or by recognising its publish record (test).
  - done: impl-1276 · 2026-10-25T10:06:31.230Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1276-final · 2026-10-25T10:25:40.626Z · commit afe0a53fda90ae4ba97bbdbdea8bfc6d9b9bce56
- [x] C2. hub/README.md's publish section says how a published task counts toward its epic's plan (docs).
  - done: impl-1276 · 2026-10-25T10:12:51.909Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1276-source4 · 2026-10-25T10:13:08.422Z · commit afe0a53fda90ae4ba97bbdbdea8bfc6d9b9bce56
  - verified: rev-34 [reviewer] · run rev-34-20261025-1276-final · 2026-10-25T10:25:40.626Z · commit afe0a53fda90ae4ba97bbdbdea8bfc6d9b9bce56

## Comments

### impl-1276 · 2026-10-25T10:02:48.616Z

Consumer inventory before changing landing evidence: searched mergeReceipt, recordMerge, MergeReceipt, publish records and Item trailers across hub/src, hub/test (all tiers), nvim, web, qa and shipped .agents skills. Progress consumers: tracker followStatus/laneRevision, task.view.merged, closed criterion freshness, demo tasks, stage snapshot/cover/QA ancestry, regression_of validation; dispatch suite taskLanding, dev-t3 culprit attribution and merge-queue landed checks. Recovery consumers: Releases publish/push/sync; Merges merge/retry/cleanup; worktree pruning; index closedAt. Plan: keep mergeReceipt and existing wire shapes unchanged, store a separate durable publication landing, expose combined landingReceipt for progress/evidence only. Recovery remains merge-only so an open published item does not block push/sync or later publication. Clients (web, Neovim, CLI), startup probes and QA fixtures keep their existing merged/stage field shapes; no client migration required. Test seams: existing in-memory publication Git adapter for Item trailers, Tracker public stage/view boundary for durable publication progress, and existing sealed native publish CLI fixture for end-to-end recording. No new process lifecycle test is needed.

### rev-34 · 2026-10-25T10:08:11.153Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1276-source
commit: 7a91607c2fc3cf83ea9461eddf1e4f5e561f630f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source review clear at 7a91607c. Standards: no findings. Spec: no findings. C2 verified from updated hub/README.md and matching command/agent docs. C1 source implementation and new test assertions reviewed; its runtime requirement remains unverified pending a successful configured verify receipt at this same head. No tests or browser run by this Reviewer. Historical publications without stored landing receipts are not backfilled.

Criteria: C2 verified.

### rev-34 · 2026-10-25T10:10:18.632Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-T-1276-source-correction
commit: 7a91607c2fc3cf83ea9461eddf1e4f5e561f630f
scope: full
findings: [{"severity":"medium","text":"M1: PUBLISH_USAGE changed without its frozen commands.json block; existing cli-usage-compatibility and root cli-help byte guards deterministically disagree. Update only the intended frozen block and preserve both guards.","file":"hub/src/cli/usage.ts","line":37}]
finding_counts: {"high":0,"medium":1,"low":0}

Correcting my earlier source-clear verdict: medium M1 at hub/src/cli/usage.ts:37. PUBLISH_USAGE differs from hub/test/fixtures/cli-usage/commands.json. hub/test/cli-usage-compatibility.test.ts:9 deep-compares every named export with that fixture; hub/test/cli-help.test.ts:31 compares root help with the same frozen bytes. This is a source-proven deterministic mismatch; no Reviewer execution claimed. Update only the intended fixture block and request fresh source review at the correction head. No additional Spec findings; runtime criteria remain unverified.

Criteria: C2 failed (M1: changed CLI help disagrees with its frozen fixture and existing compatibility/help guards (rule 16).).

### rev-34 · 2026-10-25T10:11:25.009Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1276-source2
commit: 4fa4436507da5710b7c450b907542d2c1e6fc016
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source re-review clear at 4fa44365. Standards: M1 resolved by the sole intended PUBLISH_USAGE fixture-row correction; compatibility/root-help guards, export composition and template preserved. Spec: no findings; implementation unchanged from the earlier full review. C2 verified by documentation/source; C1 runtime requirement pending a successful configured verification at this exact head. No Reviewer test/browser execution. Old-head run 5e80cc70 is not evidence for this correction head.

Criteria: C2 verified.

### rev-34 · 2026-10-25T10:12:40.850Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-1276-source3
commit: 4fa4436507da5710b7c450b907542d2c1e6fc016
scope: full
findings: [{"severity":"medium","text":"M2: all three new test notes use descriptive headings instead of exact '# <test/path.test.ts>' headings; the unchanged test-docs guard fails. Fix line 1 in this note, hub-test-publish.test.ts.md and hub-test-stage-closure-component.test.ts.md; preserve the guard.","file":"docs/agents/tests/hub-test-publish-component.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Source NOT CLEAR at 4fa44365: M2 medium, docs/agents/tests/hub-test-publish-component.test.ts.md:1 and both other new test notes have noncanonical headings. Existing hub/test/test-docs.test.ts:23-25 requires '# <test/path.test.ts>'. Old-head Linux droplet run 5e80cc70 / A-11695 reports `AssertionError [ERR_ASSERTION]: hub-test-publish-component.test.ts.md: test file heading`; these files are unchanged at 4fa44365. Correct all three headings and request fresh source review. M1 remains resolved; no additional Spec findings. Old run is partial failed (T0 completed, T1 failed; T2/T3/Web not run), not passing runtime evidence. No Reviewer execution.

Criteria: C2 failed (M2: new test documentation headings fail the canonical test-file heading guard.).

### rev-34 · 2026-10-25T10:13:08.422Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1276-source4
commit: afe0a53fda90ae4ba97bbdbdea8bfc6d9b9bce56
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at afe0a53f. Standards: M1 and M2 resolved; only the three canonical test-document headings changed since 4fa44365, and all now match the existing test-docs guard. Frozen help correction and all existing guards/templates retained. Spec: no findings; implementation unchanged from full source review. C2 verified by source; C1 runtime requirement remains pending successful configured verification at this exact head. No Reviewer test or browser execution. Old-head run 5e80cc70 is partial failed evidence, not a pass.

Criteria: C2 verified.

### rev-34 · 2026-10-25T10:25:40.626Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1276-final
commit: afe0a53fda90ae4ba97bbdbdea8bfc6d9b9bce56
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged afe0a53f. Configured run 0536f1ef / A-11714 passed 3120 tests on Linux x64 droplet, Node 24.21.0, Neovim 0.12.5, Chrome Headless Shell 156.0.8078.4 (v1248). T0/all T1/fallback all T2/changed T3 publish.test.ts once/Web completed; remaining T3/T4 not run. Checked passing trailer and durable-reopen/containing-cover identities plus each 5/5 load receipt; native published-stage closure case passed at 1.819810889s. All four native publication cases passed once; no native T3 repetitions claimed. Frozen-help and canonical-doc guards pass, resolving M1/M2. Duration/lint/T3-growth warnings are report-only. Source4 plus these records establish C1/C2. Standards: no remaining findings. Spec: no findings. No Reviewer rerun.

Criteria: C1 verified, C2 verified.
