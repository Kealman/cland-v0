---
id: T-477
kind: task
title: Verdict records carry findings with severity, and lows are recorded
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by:
  - T-529
  - T-478
topic: topic-338
branch: t/T-477-verdict-records-carry-findings-with
created: 2026-10-15T09:13:19.683Z
updated: 2026-10-15T23:44:45.668Z
---

## Summary

Retrospective A-2783, START 2 and STOP 5: severity was parsed from prose, and only 2 lows were recorded in the whole run. A verdict records its findings as structured entries, `{severity: high|medium|low, file?, line?, text}`, and the Reviewer clause says to record lows rather than writing 'no high or medium'.

## What to build

`task comment --verdict` and the MCP `task.comment` accept `--finding <severity>:<text>[@file:line]` (repeatable), and `findings: []` in the tool. The verdict header records counts by severity. `task view --json` and the journal's verdict record carry them. The Reviewer clause and the code-review skill say to list every finding, lows included.

## Acceptance criteria

- [x] C1. A verdict with findings of each severity stores them, and `task view --json` returns them with the counts.
  - done: impl-477 · 2026-10-15T23:40:53.740Z
- [ ] C2. A clear verdict with only low findings is accepted and shows the lows.
  - failed: rev-30 [reviewer] · 2026-10-15T23:44:45.668Z · note Clear review writes accept high/medium structured findings; Coordinator7edf4b29 requires atomic CLI/MCP refusal naming findings and directing not clear.
- [x] C3. The Reviewer clause (both copies) and the code-review skill require recording lows.
  - done: impl-477 · 2026-10-15T23:40:57.344Z

## Comments

### impl-477 · 2026-10-15T22:46:05.500Z

Dependencies T-478/T-529 are merged and branch starts from dev 55497c72. Plan: additive optional findings plus derived findingCounts, single-line JSON verdict headers, strict write validation, CLI repeated --finding and MCP array, index/journal propagation and low-only clear coverage. Legacy omission stays unknown; tests wait for Coordinator's reserved T-544 slot.

### impl-477 · 2026-10-15T23:40:42.549Z

Targeted validation at merged dev baseline c30b2666: verdict-findings.test.ts 3/3 green (1.56s file; longest test 0.644s) and roles-snapshot.test.ts 9/9 green (1.42s). Quiet Mac with load 2.64–2.70/free before each. No duration allowances needed. The first attempt's reserved reviewer name was fixed to rev-findings; all feature paths now pass. Fetched/fast-forwarded origin/dev before first source review; own changes remain intact. Preparing commit and push.

### impl-477 · 2026-10-15T23:44:10.583Z

Coordinator decision 7edf4b29 from source review narrows review writes: clear + any structured high/medium finding is refused with named findings and 'record not clear instead'. Implemented shared validation for CLI/MCP/text-header paths; QA remains unchanged. Added high/medium refusal and atomicity assertions for both CLI/MCP plus QA preservation; typecheck passes. Awaiting assigned one-file Mac rerun before committing new head and fresh source review. No verify run yet.

### rev-30 · 2026-10-15T23:44:45.668Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-477-source
commit: 5fa2a34df8ee2818632ed1009b6ad7d5dea5e44e
scope: full

Source review T-477 not clear at 5fa2a34df8ee2818632ed1009b6ad7d5dea5e44e, fixed point c30b2666a6d07be66053f930bafb6032361510ea. Standards and Spec reviewed directly under the no-delegation role.

## Standards
No separate standards finding. The new findings module centralizes entry validation/count derivation and CLI suffix parsing. Structured fields survive optional legacy omission, explicit empty arrays, JSON headers, index migration/rebuild, views/list summaries and notification/journal propagation. Fingerprints append findings only when present, preserving legacy durable comment hashes. Counts are derived rather than trusted from caller/header data. Both Reviewer clauses and the skill explicitly require recording lows. One new machine test file has measured cases under5s; whitespace check clear.

## Spec
Medium — hub/src/tracker/tracker.ts:2136–2140: a clear review carrying high/medium structured findings currently passes validation, can verify criteria and reach ready through existing result-based gates. This contradicts clear meaning no high/medium remains. Coordinator decision7edf4b29-af53-420b-9d2a-20a11b41f824 explicitly requires this refusal within T-477: shared write validation must reject the combination through CLI and MCP, name the offending findings and direct caller to record not clear. Preserve low-only clear and omitted legacy findings; QA verdict behavior remains unchanged. Add atomic CLI/MCP refusal coverage (and text-header path shares that write guard). C2 failed for this clarified review-result contract.

C1's source plumbing and C3's clause/skill changes otherwise appear implemented. Existing tests cover all severities/derived counts, low-only clear, explicit empty list, malformed entries, CLI parse, text headers, restart and edited-finding provenance; they omit the now-required contradictory-clear refusal. No criteria marked verified on this not-clear pass. Full runtime verification remains pending corrected source review.

A-3463 reports verdict-findings3/3 and roles-snapshot9/9, quiet serial Mac, typecheck/shard lint green. Those results do not establish the missing refusal behavior. A-3419 is the earlier pre-test design note. Implementer confirmed correction/new head and fresh source review before verification in4e6fb7f3; no verification submitted at this head.

Structured review finding for the artifact: [{"severity":"medium","file":"hub/src/tracker/tracker.ts","line":2136,"text":"Clear review writes accept high/medium findings; reject them with named findings and a not-clear instruction, per Coordinator7edf4b29."}]. The live hub/tool schema predates this task, so this verdict records the finding in prose rather than attempting an unsupported findings argument.

Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3463-t-477-review-scope-and-targeted-results.md. No per-item QA criteria. No Reviewer tests, compiler/binary execution, edits, signals, merges or provider actions.

Standards:0 findings; Spec:1 medium, contradictory clear-review acceptance.

Review artifact A-3467 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3467-t-477-source-not-clear-refuse-clear-reviews-with-blocking-findings.md.

Criteria: C2 failed (Clear review writes accept high/medium structured findings; Coordinator7edf4b29 requires atomic CLI/MCP refusal naming findings and directing not clear.).
