---
id: T-1453
kind: task
title: cland verify runs the tier lint and T3 header check locally before submitting
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1232
branch: t/T-1453-cland-verify-runs-the-tier-lint-and-t3
created: 2026-10-30T05:44:56.925Z
updated: 2026-10-30T14:32:46.507Z
---

## Summary

Before admission, `cland verify` runs `npm run test:tiers` and the T3 lifecycle header check in the caller's worktree and names the cause (stale duration keys after a rename, unsorted tier rows, imports above or a missing `T3:` header), so a refusal costs seconds instead of a review round. On 2026-10-29 five submissions were refused this way (T-1445, T-410, T-1436, T-1082, T-1373). Rule batch 4 C1 (A-14151).

## Acceptance criteria

- [x] C1. The local check reports each refusal class the hub's admission reports, with file and line, before any queue entry.
  - verified: rev-26 [reviewer] · run rev-20261030-1453-evidence-1 · 2026-10-30T10:48:40.124Z · commit c2217bb929755acb533ab5e3d68d72db1a434ed7
  - done: impl-1453 · 2026-10-30T14:29:49.674Z

## Comments

### impl-1453 · 2026-10-30T10:20:14.352Z

Consumer inventory before shared admission extraction: hub/src/hub/suite-candidate.ts (production suite admission), hub/src/territory.ts (merge policy; unchanged), hub/src/protocol.ts (existing refusal codes; unchanged), CLI suite.ts (new local caller), suite-shards.ts / test-lint-policy.ts (shared existing checks), suite-selection.ts (infrastructure full-selection trigger). Tests across tiers found by names/fields: suite-admission*, suite-dry-run, suite-protocol, suite-task-selection, suite-selection, suite-tiers, test-lint, merge*, durations, web-phase, request-guard. Shipped docs/skills: implement SKILL.md, docs/agents/tests.md, hub/README.md; QA brief consumers use verify unchanged. No wire/schema change; retain prior-wire regression in suite-admission.test.ts. Only CLI adds an invocation; hub refusal policy stays identical.

### rev-26 · 2026-10-30T10:28:35.375Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-1
commit: 1efd2afc739a41f0a8cd47ba9d29c293d7b60e39
scope: full
findings: [{"severity":"medium","text":"M1: New guide has a prose H1 and no owning Notes index row; SUITE_USAGE changed without its frozen commands.json migration. Reproduce unchanged docs/help guards red/green and correct only owning metadata/fixture rows.","file":"docs/agents/tests/hub-test-suite-preflight.test.ts.md","line":1},{"severity":"medium","text":"M2: Tier locations use disk even when rejection came from committed HEAD. Repair/reorder/remove the committed bad row on disk and the printed row refers to another source or :1. Carry actual rejected-source provenance and exact location through shared diagnostics; add committed-manifest/disk-repair controls.","file":"hub/src/cli/suite.ts","line":81},{"severity":"medium","text":"M3: Both raw promisified Git helpers lack cancellation, finite command bound and registered process/close owner. Held or aborted Git can outlive root cleanup. Reuse shared commandIn ownership with sealed environment, explicit exit assertions and shared adverse cleanup controls.","file":"hub/test/suite-preflight.test.ts","line":17}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear: consolidated A-14265. Standards M1 owning docs/help records and M3 native Git command ownership; Spec M2 wrong source provenance for manifest line locations. Shared admission extraction and report-only semantics otherwise preserved. No Reviewer workloads. Exact replacement-head source review must precede configured verification.

Criteria: C1 failed (Committed manifest refusals are located against repaired disk rather than the rejected HEAD source.).

### impl-1453 · 2026-10-30T10:29:21.556Z

Source1 fixes: M1 corrected only owning guide heading/index and SUITE_USAGE frozen row; unchanged test-docs and cli-usage-compatibility guards red before/green after. M2 moved location formatting out of CLI into suite-shards shared diagnostic owner, with exact source supplied by shared admission and HEAD/worktree label. New committed-unsorted/repaired-disk and committed-stale-duration/repaired-disk regressions assert original lines 5/12 and commit provenance; both red before, green after. M3 all test Git uses existing commandIn owner, final fixtureEnvironment and explicit zero exits; existing init-machine-lifecycle cancellation regression passes. Consumers of formatted error.message are unchanged wire readers and suite tests listed earlier: code/files remain identical, only additive source/location text changes; deep-equal dry-run/live same-source policy preserved.

### rev-26 · 2026-10-30T10:31:13.259Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-2
commit: e368cba7d549ebe43ea7902efc538428af830e5a
scope: full
findings: [{"severity":"medium","text":"M4: source-qualified shared error now differs from unchanged exact expectations at134/204 and cross-HEAD/disk equality at206. Preserve exact source-specific message/code/files/cause, dry/live equality within each source and queue/reservation assertions; migrate owning consumer after red/green. M1–M3 resolved.","file":"hub/test/suite-admission-cost.test.ts","line":134}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14271: M1–M3 source corrections accepted; one remaining medium Standards finding M4 missed exact diagnostic consumer. No new Spec issue; C1 runtime unverified. No Reviewer workloads. Replacement exact-head source review before configured verification.

### impl-1453 · 2026-10-30T10:32:02.679Z

M4 owning consumer migration: complete unchanged suite-admission-cost.test.ts red at e368cba7 (exact old messages); replacement passes 6/6, asserting exact code/files/full cause and each expected HEAD/worktree suffix, exact dry/live equality per source, stable cause across sources, and all no-queue/no-reservation facts. Full-repo literal/code consumer rescan also found QA E-676 D6/L5–L7; updated for committed plant HEAD provenance, keeping standalone lint output unchanged. Evidence A-14272. Typecheck green; lint rerun pending.

### rev-26 · 2026-10-30T10:32:47.519Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-3
commit: c2217bb929755acb533ab5e3d68d72db1a434ed7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14274 source3 clear: M1–M4 resolved. Shared rejected-source diagnostics, owned native Git controls and exact source-specific consumer/QA expectations preserve refusal code/files/cause and no-queue/reservation assertions. C1 runtime remains unverified until same-head configured original-record evidence; no ready claim. No Reviewer workloads.

### rev-26 · 2026-10-30T10:48:40.124Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-evidence-1
commit: c2217bb929755acb533ab5e3d68d72db1a434ed7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final A-14286 independently audits original A-14284:4243ordinary+75scopedload passes, zero nonpass/unmatched;8exact T3 preflight identities once(sum1.090989905s,addedwall2.000s), exact admission-cost/docs/help consumers pass. C1 verified. T0/T1/allfallbackT2/changedT3/Web complete,remainingT3/T4unexecuted. Budgets/lint/ratchet/missingbaseline explicitly report-only. No Reviewer workloads; Coordinator owns integrated/enqueue policy.

Criteria: C1 verified.

### impl-1453 · 2026-10-30T11:42:48.883Z

Coordinator rule 11 instruction 1e3fab26 authorized merge of origin/dev. Merged dev 8b23ee3a0da03e4400e13710574249c048a17db8 into task as 6e8cedd8b11658640153578b1d4ba89ff1cc1382, pushed origin. Only conflict implement SKILL.md: retained local preflight and repository auto-maintenance sections and their test pointers, removed extra blank line; CHANGES records resolution. No task production behavior modified beyond the authorized dev import. Focused Darwin arm64 Node v24.21.0 preflight 8/8, docs 3/3, help compatibility 1/1; typecheck green. Merge-tree against fetched origin/dev clean (8865443fc502851442f0567cb956d3e7db71a0a6). Coordinator owns forthcoming verify all at delta-reviewed head; no implementer verify submitted.

### rev-26 · 2026-10-30T11:44:04.533Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-4
commit: 6e8cedd8b11658640153578b1d4ba89ff1cc1382
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14311 authorized merge delta clear: retained both implement skill sections/pointers and CHANGES, task preflight/admission production+tests unchanged; imported usage/frozen JSON coherent. No Reviewer workloads. C1 runtime remains stale at successor head; prior A-14284/A-14286 first-parent only. Coordinator's planned verify all must precede final evidence review; no Implementer verification requested.

### impl-1453 · 2026-10-30T14:29:50.866Z

Shared T-1485 fix 960191735 included in pushed conflict-free merge 35fa7620e9ef3030d320a0ae678f41ebd47c357b (dev dbb1dae9), under Coordinator instruction 78106bc4. Task preflight production/test sources unchanged vs source4. Focused local preflight 8/8, admission-cost 6/6, docs 3/3, usage compatibility 1/1 and typecheck green on Darwin arm64 Node v24.21.0. Original failed full A-14387 remains old-head evidence only. Artifact A-14422 records merge/checks; Coordinator owns next all run after named delta review.

### rev-26 · 2026-10-30T14:32:02.858Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1453-source-5
commit: 35fa7620e9ef3030d320a0ae678f41ebd47c357b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14430 authorized merge delta clear: task preflight/checker/shards/tests/QA bytes unchanged, combined skill guidance intact, own SUITE_USAGE and imported owning rows coherent. A-14387 remains failed old-head evidence; C1 runtime pending Coordinator all at merged head. Focused local receipts limited accurately; no Reviewer workloads.

### impl-1453 · 2026-10-30T14:32:46.507Z

Coordinator disposition cdd54d46 changes runtime plan: prior full af51ef07/A-14387 at 6e8cedd8b supplies T0–T3 (green; only Web shared phone-asks failed), source5 confirms own source unchanged across conflict-free dev merge. Implementer now submits one mode-free configured verify at current 35fa7620e for C1/Web; Reviewer verifies C1 only on this green current-head result, citing both receipts and Coordinator disposition. No second all requested.
