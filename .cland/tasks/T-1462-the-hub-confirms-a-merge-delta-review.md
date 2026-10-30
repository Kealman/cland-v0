---
id: T-1462
kind: task
title: The hub confirms a merge-delta review when the dev merge is conflict-free and disjoint
state: open
status: in progress
size: M
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1456
topic: topic-1242
branch: t/T-1462-the-hub-confirms-a-merge-delta-review
created: 2026-10-30T05:44:58.381Z
updated: 2026-10-30T13:58:47.787Z
---

## Summary

v0.3.0 had 64 merge-delta re-reviews on 41 tasks, caused only by dev moving under the branch (retro A-14149). When merge-tree is conflict-free and the branch's files are disjoint from the dev movement, the hub records the delta as confirmed; a Reviewer reviews only overlapping files. Retro v0.3.0 change 2.

## Acceptance criteria

- [ ] C1. A conflict-free dev merge produces a durable hub-recorded delta assessment (disjoint or overlapping, with rename endpoints, deletions and the dependency rule it applied), shown on the item; in this rollout the assessment is report-only and the Reviewer's merge-delta verdict is still required (rule 27).
  - failed: rev-34 [reviewer] · 2026-10-30T13:58:47.787Z · note Shared scanner still has the known regex-tokenization false-negative gap; final owner correction is pending.

## Comments

### impl-1462 · 2026-10-30T12:39:29.153Z

Rule 20 audit: affected boundary is report-only delta assessment; existing verdict current booleans, gate refusals, ItemView/IndexedVerdict/store wire shapes and CLI/MCP/web/nvim consumers stay unchanged. Consumers searched: tracker Freshness/taskPatch and gate-verdicts; TaskMerges and merge queue/controller; tracker index/readiness/workflow and persisted verdict readers; protocol schemas/shared wire clients; tests freshness, merge-policy, merge.test, merge-recovery, merge-queue/unit/batches, scenarios/ticket-flow and stage-close (T3), T4 read-path guards; CLI help frozen fixtures; implement/merge skills, hub README, docs/agents/tests and QA briefs. New log event is additive and includes immutable identities/path facts/rule/mode; existing clients must not reinterpret it as Reviewer provenance. Counter-case: branch test/importer reaches a dev-changed module despite path disjointness. Coordinator approved report-only and conservative coupling rule, and requested shared T-1454 graph facts. Native existing merge-policy public-frame seam authorized by Coordinator.

### impl-1462 · 2026-10-30T12:51:09.907Z

Source f9533a5d8 pushed; C1 done and review requested. A-14383 holds trust model, red/green evidence, consumer migration and merge-tree checks. Success storage finalized as ordinary durable item comments (no success log/wire field), with no verdict provenance. Shared graph/tokenizer from T-1454 use one exported module; original suite-selection tokenizer API reexports it. macOS targeted: merge-policy18/18, freshness8/8, suite-selection101/101, CLI compatibility1/1/help5/5; typecheck and test lint passed (report-only124 findings/60files/0refusals). Configured verification pending source verdict, no full local suite or browser run. Fresh dev168b9e4d7 fetch/merge and merge-tree exit0; parallel T-1454 d0767dc92 merge-tree exit0.

### rev-34 · 2026-10-30T13:41:41.447Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261030-1462-source1
commit: f9533a5d8e5d347ec75d4512dc14387eb00eabb2
scope: full
findings: [{"severity":"medium","text":"M1: advisory graph/comment await precedes freshness publication and occupies its foreground lane; held work delays gate/readiness. Diagnostic logger failure can also escape the advisory catch into freshness failure. Publish original answers independently and own/drain separate advisory work; cover held and throwing-sink paths.","file":"hub/src/tracker/freshness.ts","line":363},{"severity":"medium","text":"M2: shared tokenizer silently omits computed/CommonJS/escaped runtime imports, so graph may record known with no importers despite a branch importer reaching a dev-changed module. Resolve soundly or report unknown through the single T-1454 graph owner, preserving compatibility and adding controls.","file":"hub/src/suite-import-graph.ts","line":41}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14395 consolidated two-axis audit. Immutable merge/path trust, ordinary comment/no-verdict storage, patch-id eligibility label and owning help migration otherwise align. Preserve existing native assertions and claimant local evidence attribution; no Reviewer workloads or configured run. Coordinator-assigned shared graph correction plus independent advisory ownership require fresh exact-head source review before verification.

Criteria: C1 failed (Report-only advisory work can delay/change freshness settlement, and known dependency facts omit unsupported runtime edges.).

### impl-1462 · 2026-10-30T13:47:55.760Z

M1/M2 source corrections pushed8e101eb74; A-14401 retains red/green receipts, exact shared scanner commit and ownership. M1 foreground freshness isolated, native10/10; M2 unsupported graph evidence unknown, native merge-policy23/23 including transitive known importer. Typecheck/lint green (report-only123 findings/0refusals). C1 done restored. Replacement source request held briefly for T-1454 owner's known M5 scanner follow-up (ordinary template false positives), no independent scanner edits and no verify before fresh review. No dev merge after source1.

### impl-1462 · 2026-10-30T13:52:04.788Z

Replacement source2 requested directly from rev-34 at f0293e419. A-14404 final evidence, A-14401 M1/M2 details. Both exact Coordinator-posted shared scanner fixes taken alone:0b3d85971 and e218a52f7; no dev merge. M1 freshness10/10, final native merge-policy23/23, selection101/101, typecheck/lint passed(report-only123/0refusals). Native ordinary-template red expected known/actual unknown corrected with shared follow-up. Cross-item merge-tree vs T-1454a91c8e332 exit0. Configured verification awaits source verdict.

### rev-34 · 2026-10-30T13:53:49.393Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261030-1462-source2
commit: f0293e419c2e1b384c9e7c7a7afdcd715d7c4c30
scope: full
findings: [{"severity":"medium","text":"M3: whole-template tokenization hides runtime import/require inside substitutions, allowing known empty dependency facts despite a branch importer reaching a dev-changed module. Preserve harmless template support, but scan executable substitutions or report incomplete through the shared T-1454 owner; retain native/shared red-green controls.","file":"hub/src/suite-imports.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14406: M1 resolved in source by separate owned advisory lane, original freshness publication and diagnostic shielding; original M2 computed/CommonJS/escaped cases addressed. Sole residual M3 matches known owner T-1454 M6; claimant has independently reproduced hidden import/require native reds. Local source attribution retained; no configured runtime proof or Reviewer execution. Take only Coordinator-posted shared fix, restore done and request fresh exact-head source review before verification.

Criteria: C1 failed (Recorded dependency evidence can still claim known with no importer after runtime loading hidden inside template substitutions.).

### rev-34 · 2026-10-30T13:58:47.787Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261030-1462-source3
commit: 8914143c00040477a7c59ee0819cd3ef7056b69a
scope: full
findings: [{"severity":"medium","text":"M3 remains pending shared owner final correction: quote-containing regex literals can hide later real imports from the token stream and yield known-empty dependency facts. Conservative unknown/widening is approved; false known-negative is not. Take Coordinator-posted scanner after rev-32 owner clearance, then exact-head delta review.","file":"hub/src/suite-imports.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14411 assessment-side consolidation per Coordinator fcb7a819. No additional Standards/assessment findings; M1 isolated lane unchanged/resolved. New native hidden-template controls and approved conservative scalar-template unknown/docs align. Sole M3 is known shared scanner blocker; no whole-head clearance or verification authorization. Local27/27 and prior-head freshness/selection/help checks remain separately attributed.

Criteria: C1 failed (Shared scanner still has the known regex-tokenization false-negative gap; final owner correction is pending.).
