---
id: T-1492
kind: task
title: Batch interaction scanner falls back on every web test through web-readiness's createRequire base
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1454
found_by: droplet
topic: topic-1251
branch: t/T-1492-batch-interaction-scanner-falls-back-on
created: 2026-10-30T19:14:07.614Z
updated: 2026-10-30T19:49:37.827Z
closed: 2026-10-30T19:49:37.827Z
---

## Summary

Since restart #64 put T-1454 live, every merge batch's report-only interaction assessment lists the Web test files as fallbacks. The cause is `incomplete import graph: unsupported createRequire base [hub/src/web-readiness.ts]`. `hub/src/web-readiness.ts:14` builds its require with `createRequire(pathToFileURL(join(root, 'web/package.json')))`, and the scanner rejects that base, so every web test that reaches it falls back to the conservative path. Fallback is fail-closed (a wider selection), so nothing is mis-selected. But the report is mostly noise, and T-1488's later switch to run mode would select all Web tests for every batch.

## Evidence

Batch 5ca50cde / A-14627 (T-1471, 19:13Z) has about 28 web/test files falling back on this one cause; the log prints the list three times, 83 lines. There are also a handful of distinct causes, each listed in the item comments when picked up:
- `vm loader` (plan-approval);
- `non-literal module specifier` (mod-bridge);
- `indirect require` (suite-accounting);
- `eval or indirect module loader` (sqlite-contention);
- `unsupported createRequire base` (task-worktrees);
- `unresolved module specifier yaml` (nvim plan-component).

## What to build

Teach the T-1454 scanner the `createRequire(pathToFileURL(join(<root>, '<dir>/package.json')))` base form (a project-relative package base), so web-readiness's dependency reads resolve within the declared external-package proof. Keep the fail-closed fallback for every other dynamic form. Resolve `yaml` as a declared external package if it is one. Leave the other single-file causes as fallbacks unless the fix is mechanical, and list them in the item.

## Acceptance criteria

- [x] C1. The batch interaction assessment for a candidate that touches `web/`, run on the reference executor, shows no `unsupported createRequire base [hub/src/web-readiness.ts]` fallbacks, and web tests are selected or excluded by their real import graph.
  - done: impl-1492 · 2026-10-30T19:26:03.728Z
  - verified: rev-26 [reviewer] · run rev-20261030-1492-evidence-1 · 2026-10-30T19:43:11.454Z · commit c5aaaed0786de8ee300519aaea54791795784479
- [x] C2. An unknown createRequire base (a non-literal or out-of-project path) still falls back with its current message, proven by a negative control.
  - done: impl-1492 · 2026-10-30T19:26:03.852Z
  - verified: rev-26 [reviewer] · run rev-20261030-1492-evidence-1 · 2026-10-30T19:43:11.454Z · commit c5aaaed0786de8ee300519aaea54791795784479
- [x] C3. The batch result notice summarises the interaction assessment (mode, phases, selected-file count, fallback counts by cause, at most 10 example paths) and points to the log for the full list, instead of inlining every path; the full list stays in the batch log and artifact.
  - done: impl-1492 · 2026-10-30T19:19:47.185Z
  - verified: rev-26 [reviewer] · run rev-20261030-1492-evidence-1 · 2026-10-30T19:43:11.454Z · commit c5aaaed0786de8ee300519aaea54791795784479

## Comments

### impl-1492 · 2026-10-30T19:15:02.823Z

Before edits, A-14627 batch log distinct causes: non-literal module specifier (mod-bridge); vm loader (plan-approval); eval or indirect module loader (sqlite-contention); indirect require (suite-accounting); unsupported createRequire base (task-worktrees and web-readiness, affecting 28 Web files); unresolved module specifier yaml (nvim plan-component). Remaining causes stay fail-closed. Consumer inventory: graphImportSpecifiers -> suite-import-graph -> suite-interactions -> suites task/batch planner; parser also directly tested by suite-selection. Batch notice text -> MergeBatchBoundary.report -> merge-queue report delivery to Coordinator/item lead; merge-batches tests assert text. SuiteSelection.batchInteraction stored/wire/env/cache/shards consumers retain current full shape (suite-selection, shared/wire, verification-occasion, executor, persistence, clients); only human-facing notice projection changes, full log retained. Search covered src, all tier tests, QA, skills, docs by field/function and notice text.

### rev-26 · 2026-10-30T19:21:46.011Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1492-source-1
commit: 8b14814b4c511cb744036b472cda6c5debc0884f
scope: full
findings: [{"severity":"high","text":"M1 (Spec): loop-variable resolution crosses nearer dynamic-loop/catch bindings and can use a shadowed outer literal-array name as external-package proof, accepting unproven runtime names instead of failing closed.","file":"hub/src/suite-import-parser.ts","line":105},{"severity":"medium","text":"M2 (Spec): the helper shadow check omits named function expressions, so a local pathToFileURL/join binding can masquerade as the imported Node helper and make an outside base pass the new project-package proof.","file":"hub/src/suite-import-parser.ts","line":65}]
finding_counts: {"high":1,"medium":1,"low":0}

A-14636: Standards has no independent findings; Spec M1 high/M2 medium require nearest lexical binding proof for loop names and Node helper calls. C1 reference-executor evidence remains pending; C3 notice/log preservation inspected but no runtime criterion verified. Lead's working-tree controls do not clear the pinned head. Fresh pushed-head source review before verification.

Criteria: C2 failed (Named local path/URL helper expressions can make an unknown/outside createRequire base pass; lexical proof must fail closed.).

### rev-26 · 2026-10-30T19:23:55.116Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1492-source-2
commit: 11868436fb1345608691b2c6308a57f02bb5fd23
scope: full
findings: [{"severity":"high","text":"M1 remains: loop-name proof skips switch CaseBlock/CaseClause lexical declarations, so a nearer dynamic const can be mistaken for an outer literal-array variable and unproven resolve names are accepted rather than falling back.","file":"hub/src/suite-import-parser.ts","line":123}]
finding_counts: {"high":1,"medium":0,"low":0}

A-14640: M2 closed, M1 remains at CaseBlock/CaseClause lexical declarations. Exact switch control sent to lead. No independent Standards finding; report/default/notice behavior retained. C1–C3 runtime verification pending; no configured verification before corrected pushed-head source review.

Criteria: C1 failed (Switch-scoped dynamic resolve name still borrows outer literal-loop proof, so real-graph fail-closed selection is not established.).

### rev-26 · 2026-10-30T19:26:39.967Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1492-source-3
commit: c5aaaed0786de8ee300519aaea54791795784479
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14646: M1/M2 closed in source; shared lexical predicates cover switch/destructured/named-class boundaries while literal positives and external proof limits remain. Standards/Spec clear with no findings. C1–C3 runtime remain unverified pending original same-head configured/reference evidence; local summaries do not establish reference coverage.

### rev-26 · 2026-10-30T19:43:11.454Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1492-evidence-1
commit: c5aaaed0786de8ee300519aaea54791795784479
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14656: original A-14655/07b7da56 audited at source3 head. C1 actual-source candidate selection and C2 negative controls pass on reference Linux droplet; C3 compact notice/pointer/full-evidence controls pass, summary case also5/5 load. Independently4514 ordinary+130 load passes, no adverse or unmatched progress records. T0/T1/allT2/changedT3 selection161once/Web completed; remainingT3/T4 unexecuted. Browser actual isolated HeadlessShell1248/156.0.8078.4; report-only timing/lint/missing baselines retained. No fresh workload or older-head relabelling.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-30T19:49:37.827Z

Merged 1448aa0465ac77e33912e76fcea27c8b93a44aff onto dev.
