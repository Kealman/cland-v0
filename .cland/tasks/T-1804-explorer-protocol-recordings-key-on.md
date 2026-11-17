---
id: T-1804
kind: task
title: "Explorer protocol recordings key on unrelated archive-loading state: the same task.plan/task.view frame records a new entry once closed archive rows arrive"
state: open
status: ready
size: M
criterion_seq: 3
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: topic-1602
branch: t/T-1804-explorer-protocol-recordings-key-on
created: 2026-11-10T10:27:55.575Z
updated: 2026-11-17T12:49:26.652Z
---

## Summary

During T-1778's recording refresh (`npm run test:nvim-fixtures`, 2026-11-10, at 665554818), `nvim/test/fixtures/protocol-frames.json` and `protocol-frames/explorer-component.json` each gained 4 canonical entries, which represent 2 result frames (`task.plan` record 82ab3ab3…, `task.view` 89dbc2b6…) plus their normalized input nodes. Their frame and output shapes exactly match existing records. The nearest existing inputs differ only at `/items/21–23`: the archived fixture rows R-30, T-31 and T-32. The recording key therefore depends on whether closed archive rows had loaded when the frame was captured. That is scheduling-state nondeterminism, not a wire change. No timing reproducer has been shown.

## Evidence

impl-1778's classification in topic-1461 (2026-11-10 10:27Z). The generated commit was reverted, and the tree was restored to 665554818.

## Acceptance criteria

- [x] C1. Recording keys for explorer frames don't depend on archive-loading progress: two recording runs, with archive rows loaded before and after the frame, produce the same canonical entries (test).
  - done: impl-1804 · 2026-11-17T12:11:00.269Z
  - verified: rev-35 [reviewer] · run rev-35-1804-final-1 · 2026-11-17T12:49:26.421Z · commit b3b886ef134d6aad278d4ae23dc40525b722b2ff
- [x] C2. Ordinary replay covers both archive-loading states, or the explorer awaits a defined archive state before capture (test).
  - done: impl-1804 · 2026-11-17T12:11:00.812Z
  - verified: rev-35 [reviewer] · run rev-35-1804-final-1 · 2026-11-17T12:49:26.421Z · commit b3b886ef134d6aad278d4ae23dc40525b722b2ff
- [x] C3. Two back-to-back `npm run test:nvim-fixtures` runs produce no archive-context duplicate keys, and the explorer-component slice after the second run is byte-identical to the deterministic migration; the remaining incidental task.view capture variance belongs to T-1944 (test).
  - done: impl-1804 · 2026-11-17T12:11:01.354Z
  - verified: rev-35 [reviewer] · run rev-35-1804-source-1 · 2026-11-17T12:22:04.858Z · commit b3b886ef134d6aad278d4ae23dc40525b722b2ff
  - verified: rev-35 [reviewer] · run rev-35-1804-final-1 · 2026-11-17T12:49:26.421Z · commit b3b886ef134d6aad278d4ae23dc40525b722b2ff

## Comments

### impl-1804 · 2026-11-17T11:46:27.381Z

Consumer search: frame-fixtures canonical/replay consumed by stub-hub; client selects slice paths; frame-refresh and record-nvim-frames hash captured normalized inputs; nvim-fixture-check checks producer outputs and slice membership; boundary/refresh T1 tests cover format. All Neovim T2/T3/T4 consumers reach the shared stub/reader; no production protocol caller changes. QA E-1535-stage-1 reads outputs via parseRecordings (unchanged); docs/evidence/T-709 frame audit describes historical binding (still valid). Frozen protocol-frames catalog and all slices migrated with output-byte preservation; live-protocol-frames unaffected. Producers: stub task.plan builds id/plan/stages/approval/history, Visibility.frame only projects named record fields and never reads items for this shape; task.view value.item layer uses Visibility.currentItems open release and parent reachability. Normalize only these result contexts; keep every open row and its closed ancestors for view.

### rev-35 · 2026-11-17T12:22:04.858Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1804-source-1
commit: b3b886ef134d6aad278d4ae23dc40525b722b2ff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20871 full source/evidence clear, tree1f07e536587dc14c1229e05d651f6c63311dbaaf,base1f0c614bc. Standards0/Spec0. Dependency-limited normalization beforebinding preservesplanfacts,openview rows/closedancestors/currentrelease; otherframes retaincontext. Sharedrecord/replay boundary+slotreindex/idempotence/changedwire/ancestor negatives tested. Migration collisionoutputs/framebytes assertions; independently11changedfixturefiles preserve distinctoutputs/frame-outputpairs, main6153→6094/59duplicates,3273distinctoutputs. C3amendedCoordinator9e96330f established: independentlycommittedexplorersha057f3e95...7d57e7c matchesA-20869 before/run2/migration manifests200/227/254. Wholecatalog instability36drops/3adds staysT1944. IndependentlyeachA-20865/66 sums51TAPgroups494pass/0other; retainednative0/localDarwinNode24.21Neovim.12.5,precommitc512changes notexactb3. Relevantproducer/canonical/Visibility/ladder blobsunchanged1f198→b3. Exactmergedunit11+6/type0; A20870fulllint0/0refusals/128report62files. Rawrefreshlogs retained, perinvocationtree/signalsunknown, standalone run2slice absent(manifestreceipt). Earliernative27/27 qualified, red10/11slot→11green retained; refusedbaselineclonecleanup left perCoordinator/no bypass. C3verified,C1/C2pendingfinalsameheadconfigured. No protocolproductionchange/native schedulingreproducer/Reviewer runtime/probe/edit.

Criteria: C3 verified.

### rev-35 · 2026-11-17T12:49:26.421Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1804-final-1
commit: b3b886ef134d6aad278d4ae23dc40525b722b2ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20880 final same-head evidence clear; source A-20871 unchanged. Configured run 66a4d186/A-20877 passed at b3b886ef; normalized delivered tree f4a4ba79e6fb1a5bbee428e20d7e6bc661ba1a7d. Independent audit: 6,673 ordinary passes, one documented macOS caffeinate skip, no failures/cancellations; all 224 T1, 430 T2, 55 Web and two mapped T3 file envelopes pass. Separate 225 load executions pass. Boundary 11/11 and refresh-unit 6/6; all three new recorder identities have ordinary passes and five passing loads with exact proofs 4886/5023/5079. Both plan/view archive states replay from the same canonical entry with relevant-fact negative controls retained. Explicit Neovim phase has 44 passing files and 385/385 tests, including explorer 27/27; this is recorded-hub replay, not a new refresh. Mapped T3: 19 passing identities plus the documented platform skip, one base/no repetitions; 17.338 seconds is selected phases excluding wait, not suite wall. Remaining 267 T3 and 17 T4 files unexecuted. Linux x64 Node24.21.0/Neovim0.12.5; actual isolated Headless Shell1248/CfT156 browser. No added warning identities versus A-20876, none in task/Neovim consumers; inherited refusal controls separately classified by Coordinator. T-1935 exact fixture pair 28739–28740; typed outcomes/Finished0 independent; lint128/62 and budgets report-only. C3 retains Coordinator-amended scope and qualified A-20865/20866 earlier 494/494 refresh receipts, A-20869 run-two/migration explorer hash equality; no immutable refresh invocation-tree or exact-head refresh claim. Prior independent migration output/frame-pair preservation stands. Whole-catalog variance remains T-1944. No Reviewer runtime, probes or edits.

Criteria: C1 verified, C2 verified, C3 verified.
