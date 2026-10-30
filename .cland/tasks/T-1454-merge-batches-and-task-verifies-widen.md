---
id: T-1454
kind: task
title: Merge batches and task verifies widen test selection for sibling-merge interactions
state: open
status: review
size: M
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1456
  - T-1476
topic: topic-1241
branch: t/T-1454-merge-batches-and-task-verifies-widen
created: 2026-10-30T05:44:57.061Z
updated: 2026-10-30T15:16:56.879Z
---

## Summary

Merge batches add the T2 and Web files that import modules another landing changed since a member's verified head; task verifies add the test files of landings merged into the head, plus mapped guards (roles.test.ts for clause edits, area-slots for web areas). Sources: T-1432 (T-1403 × T-1406), T-1136 × T-1111, T-1348 × T-1347, T-945, T-1140. Rule batch 4 C2 (A-14151).

## Acceptance criteria

- [x] C1. A batch whose members change an imported module of another member's tests runs those tests, shown by a fixture with two interacting branches.
  - done: impl-1454 · 2026-10-30T14:32:58.240Z

## Comments

### impl-1454 · 2026-10-30T12:43:14.938Z

Contract inventory (rule 20): adding optional SuiteSelection.interactionTests, retaining every existing field. Production: suite-selection (task planning, environment parser, describeSelection, cache equality), suite-interactions (bounded graph/merged histories), hub/suites (batch admission), verification-occasion (retains additive field), suite-shards/tier-report (existing file/phase consumption), verification-plan (new T2/Web phase gets commands), hub/merge-batches (result line), suite candidate, run-suite and executor bundle/worker env (carry selection unchanged), suite persistence/by-id/history (optional legacy shape), protocol/shared/wire plus conformance, web/nvim queue clients (ignore extra evidence field). Tests/fixtures/probes: suite-selection*, suite-shards*, verification-occasion, verification-plan, web-phase, suite-unit/component fixtures, suite-queue/persistence/soak, merge-batches, selection-replay, lint-repository-tier-plan; QA briefs and shipped skills have no structural SuiteSelection reader, implement/tests docs updated. Existing old-shape receipt/cache control retained; parser validates only when new field present. No permissions or refusal class changes.
C1 red: new two-branch fixture failed ERR_MODULE_NOT_FOUND for suite-interactions.ts before implementation. Green: actual generated plan executes named T2 and synthetic Web Node assertions; this is not browser evidence. Additional guards exercise merged landing, clause and area paths, graph read sharing and bounds. No full local suite runs.

### impl-1454 · 2026-10-30T12:48:12.785Z

Local evidence update: source d0767dc92, macOS local. suite-selection.test.ts 104/104 and merge-batches.test.ts 72/72; after adding unrelated whole-phase files plus legacy env receipt assertion, the 2 affected named tests pass again. Typecheck all workspaces green and static/test lint green (report mode: 124 findings/60 files, 0 refusals). No browser or full local tier suites. origin/dev freshly fetched and merged, no conflict. Reciprocal merge-tree against T-1462 479a88072 found documentation append/identical-helper whitespace/extraction conflicts; T-1462 lead is correcting before either source request. QA policy none, qaCriteria empty. Shared helper split into suite-import-graph.ts and unchanged tokenizer suite-imports.ts; old suite-selection importSpecifiers export retained. SuiteCandidate's new optional git port is supplied by production and synthetic fixture adapters; absent old adapters conservatively broaden batch selection, never skip it.

### rev-32 · 2026-10-30T13:41:51.083Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1454-source1
commit: d0767dc920fcc2bcc0009d5d9b1062b54be86964
scope: full
findings: [{"severity":"medium","text":"M1: interaction-selection SUITE_USAGE change has no owning frozen commands.json row migration; unchanged compatibility/full-help guards mismatch. Preserve red/green and update only owning row.","file":"hub/src/cli/usage.ts","line":11},{"severity":"medium","text":"M2: computed dynamic import is silently ignored and literal-prefix expressions are truncated to first string, so the new authoritative import graph can omit sibling T2/Web dependencies rather than fallback. Resolve supported forms or report incomplete, with graph/batch controls.","file":"hub/src/suite-imports.ts","line":19},{"severity":"medium","text":"M3: taskSuiteSelection resets history-failure full T1–T4 fallback to T1,T2; hidden merged process files unavailable to duration sampling are omitted. Preserve fallback through final execution planning and test scan-error/limit paths.","file":"hub/src/suite-selection.ts","line":248},{"severity":"medium","text":"M4: new generated-plan child uses unbounded bare execFile without pre-owned abort/stop/native-close drainage before directory cleanup. Reuse existing captured replay owner and bounded execution observer, retaining positive T2/Web assertions.","file":"hub/test/suite-selection.test.ts","line":844}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source1 not clear, A-14396. All 18 changed files and execution consumers audited at fixed base168b9e4d7. Standards M1/M4, Spec M2/M3; no other findings. C1 failed; local claimant summaries are not configured/browser evidence. M1 worktree correction and shared M2 coordination are acknowledged as pending, not reviewed head changes. Consolidate corrections and fresh exact-head source review before verification; no reviewer workloads or merges.

Criteria: C1 failed (Computed imports can omit interacting test phases; task-history fallback loses hidden process coverage and the new generated-plan proof lacks bounded native ownership.).

### rev-32 · 2026-10-30T13:48:15.024Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1454-source2
commit: fd9b394d51f2554466bab77a349d939e2a0555b7
scope: full
findings: [{"severity":"medium","text":"M5: graph-safe blanket rejection of every interpolated template includes ordinary assertion/JSON text in T2 account-coalescing:42/account-fixture-env:21. Every changed batch scans these tests and widens to all T1–T4/Web despite no module-loading uncertainty. Restrict unknown-edge handling to loading syntax and retain no-import/literal-with-template/no-interaction configured-phase positives plus true unknown negatives.","file":"hub/src/suite-imports.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source2 not clear, A-14402. M1–M4 closed: frozen owning row, strict graph API, full fallback through final task/process planning, owned bounded native execution receipts. Sole M5 is blanket unrelated-template fallback causing routine all-tier/soak widening; claimant accepted and coordinates shared correction with T-1462. Local summaries retain macOS/Node-only limits; C1 done/runtime-unverified, no new direct semantic criterion failure inferred. Full19-file branch reviewed; diff check0, no Reviewer workloads. Fresh exact-head source request before verification; hold released.

### rev-32 · 2026-10-30T13:52:39.478Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1454-source3
commit: a91c8e332f758d7b12456da0871a3ec5650a093e
scope: full
findings: [{"severity":"medium","text":"M6: whole-template tokenization hides executable substitution module loads. const text=`value ${(await import('../src/shared.ts')).value}` has no visible import token after M5 removal, so the graph can falsely prove no interaction; require is hidden too. Scan loading syntax in substitution expressions or report it incomplete, with graph/batch controls preserving ordinary-template positives.","file":"hub/src/suite-imports.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source3 not clear, A-14405. M1–M5 closed; sole M6 is template-substitution module-load underselection. C1 failed for direct omission; no other findings. A14403 local claimant summary retains current/prior head distinctions; no configured/Linux/browser proof. Shared exact production correction to T-1462 through Coordinator, fresh pushed-head source review before verification. No Reviewer workloads/edits.

Criteria: C1 failed (Actual runtime import/require within executable template substitutions is hidden as a string token, allowing an importing sibling test to be omitted.).

### rev-32 · 2026-10-30T13:57:37.391Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1454-source4
commit: 1a9d4b80c9b4ce1456d7ded654e865cdccc5ea20
scope: full
findings: [{"severity":"medium","text":"M7: regex literals are not parsed/unknown; const a=/\"/; import \"../src/shared.ts\"; const b=/\"/; causes quote tokens to hide the real import, so an importer can be omitted. Treat unsupported regex/slash executable syntax as unknown with direct graph/batch controls. Coordinator ba809912 confirms blocking under one-direction soundness bar.","file":"hub/src/suite-imports.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source4 not clear,A-14409. M1–M6 closed/disposed under Coordinator62d1291d; false widening accepted, sole M7 false narrowing remains. C1 failed. Shared correction in exact production commit, fresh pushed-head review before verify; will explicitly name scanner-clear SHA after soundness clearance for T-1462. No Reviewer workloads; local121/121 summary not configured/browser proof.

Criteria: C1 failed (Unsupported quoted regex literals can swallow a real static import as plain-string text, falsely proving no sibling interaction.).

### rev-32 · 2026-10-30T14:04:54.592Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1454-source5
commit: 0ea657da88ef99f6586798f8aa7551f2f9818d17
scope: full
findings: [{"severity":"medium","text":"M8: line comments swallow actual imports after CR/U+2028/U+2029. Consolidated lexical subset list in A-14416 also covers BOM/non-ASCII/control, unterminated/escaped literals/comments, slash/templates/hashbang/JSX and indirect executable forms. Unsupported classes must be unknown, with one control each. Coordinator c5288084/c8f6a162 accepts complete list and final-round bar.","file":"hub/src/suite-imports.ts","line":10},{"severity":"medium","text":"M9: unresolved nonrelative absolute/file/data/local/bare-package specifiers are ignored and unparsed traversed source extensions return no edges. Return unknown unless proven external/fully supported; retain graph/batch controls. Coordinator accepted this graph-boundary class.","file":"hub/src/suite-import-graph.ts","line":41}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source5 not clear,A-14416. M7 closed; M1–M7 otherwise closed/disposed. Consolidated complete M8/M9 list per review-loop cap; Coordinator c8f6a162 additionally requires final-tree unknown-file counts/reasons and typical one-module batch phases, plus cheap sound narrowing proposal if >about25% unknown. Audit saved facts only, no Reviewer scan/tests. C1 failed. One shared production correction/fresh exact-head review before configured verify; no scanner-clear SHA yet.

Criteria: C1 failed (Unsupported lexical terminators and unresolved specifier/source-extension boundaries can still hide runtime dependencies and omit interacting tests.).

### impl-1454 · 2026-10-30T14:32:57.785Z

Final policy per Coordinator decisions53d321b6/edae5998/6a132ac7/0cefb27a/a6bd6b13/7a5c399a: graph uses lazy TypeScript AST; registry externals proven through nearest declaring candidate ancestor (all dependency groups, workspace/local/Git/path refused), bounded createRequire literal forms supported, unknown file selects only that file, scan-wide unavailability selects phase, task-history failure remains full. Batch widening defaults report via merge.batch_interaction; explicit run executes additions. C1 fixture now proves report plan excludes additions and records files/phases, while run executes both named Node assertions. Report-mode fixture red expected T1,T3 but actual added T2; corrected green.
Contract inventory update: optional SuiteSelection.batchTests and batchInteraction mirrored in shared/wire, validated by selectionFromEnv, compared in sameSuiteSelection, carried by selectionTransport/executor/run-suite/persistence, consumed by packageShards, pinVerificationPlan/tier report and merge-batches result line. Old receipts without optional fields retain baseline behavior; default report produces no extra scheduled files/tiers or exit gate. ProjectConfig.merge.batchInteraction is parsed/rendered by the single config consumer, surfaced through dynamic configKeys/settings writer and reload applied keys; current/older configs omitting it inherit report. Init-config and owning frozen SUITE_USAGE/MERGE_USAGE rows migrated. No role permission or clause expansion. Shared immutable scanner API keeps legacy defaults; optional diagnostic callback shares graph reads for measurement, defaults to throwing unknown for older callers. ImportGraphError distinguishes file from scan scope internally; T-1462 takes final shared commit only after reviewer clearance.
Scanner19db19fa3, whole head8bca06c69. Measurement on sealed disposable source copy, macOS/Node24.21: direct/transitive unknown hub/test T2 5/256, Web0/49; five reasons are one nonliteral import, vm fixture, eval fixture, indirect require fixture, unsupported createRequire base fixture. Run-mode projections at baselineT1: store.ts294(244hub/1nvim/49Web), codex.ts292(242/1/49), cli/usage.ts40(39/1/noWeb). Default report executes no additions. These are static selection projections, not runtime tests/timing. One earlier independent-per-test measurement expired at60s/SIGTERM without results; final shared-graph measurement completed with bounds and no budget outcomes.
Local targeted evidence: selection158/158, merge-batches72/72, init-config16/16, CLI compatibility1/1/help5/5, all-workspace typecheck and test:lint passed(report-only124 findings/60files/0refusals). No full local tiers, browser or configured hub verification yet. No dev merge since source1; next exact-head review required before verify.

### rev-32 · 2026-10-30T14:36:47.700Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1454-source6
commit: 8bca06c694800df67470aa5ac2caadd3971727b8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source6 clear,A-14437. scanner clear at19db19fa32693bdf790fd0fe38904c8439d9d239; scanner source bytes match reviewedhead. M1–M9 closed/disposed under final Coordinator AST/soundness/file-uncertainty/report-mode decisions. Defaultreport records exact additions/reason/phases and preserves configured execution; explicitrun masks selected T2/Web, C1fixture checks both plus owned native receipts. Config/default/render/settings/reload/help/wire/cache/shards audited. Saved local measurements5/256T2unknown,0/49Web with representative projections retained as claims, not runtime; manifest denominators checked. C1 remains runtime-unverified, no Reviewer workloads. One unchanged-head mode-free verify then original-record final review; no full run requested.

### rev-32 · 2026-10-30T14:54:47.634Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1454-source7
commit: 8253d9e6f3f493cf781e52cfe7e05f7404484922
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source7 clear A-14471. Only intervening line restores established contiguous tree/tiers/wall/exit summary and appends identical batchInteraction JSON after exit; unchanged merge-queue:417 contract preserved. Full source6 implementation otherwise unchanged; five scanner files match19db19fa32693bdf790fd0fe38904c8439d9d239. No dev merge. OriginalA14464 remains failed/T3T4Webunexecuted; A14468 local claims not configured current-head evidence. C1 runtime-unverified under final report/run policy. One unchanged-head mode-free replacement verify then original-record final review; no Reviewer execution.

### rev-32 · 2026-10-30T15:16:56.879Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1454-delta1
commit: 1b208941fc2fd57e114d02ebc6ff4f6d77d66db3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear A-14497. Parents8253d9e6f+effffe1e7; Coordinator0cdea12d rule11. Own implementation/tests unchanged; five scanner files exact19db19fa3. Combined decodedSUITE_USAGE retains both parents, frozen row matches; all nonblank skill/CHANGES/docs parent lines retained. Incoming prerequisites/clock/phone/site bytes matchdevparent. A14493 local claims only; originalA14464/A14489 stay failed, C1runtime-unverified. One unchanged-head configured verify then original-record final review. No Reviewer execution/mutations.
