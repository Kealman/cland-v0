---
id: T-480
kind: task
title: Sub-agent launches record their model
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-468
blocked_by: []
topic: topic-328
branch: t/T-480-sub-agent-launches-record-their-model
created: 2026-10-15T09:13:20.365Z
updated: 2026-10-15T22:26:18.898Z
closed: 2026-10-15T22:26:18.898Z
---

## Summary

Retrospective A-2783, START 2: all 13 sub-agent launches have the model `unknown`. The SubagentStart hook record carries the model that the harness reports, or the requested one when the harness reports none.

## Acceptance criteria

- [x] C1. A fake-harness sub-agent start with a model records it in the journal's subagent record, and `task view` usage lists it.
  - done: impl-480 · 2026-10-15T21:04:37.666Z
  - verified: rev-31 [reviewer] · run rev-20261015-480-final · 2026-10-15T21:42:15.674Z · commit 4662f7cc819c30c2f19d4a0d0530a640f39a5e03
- [x] C2. Without a model from the harness, the record says `unreported` rather than `unknown`.
  - done: impl-480 · 2026-10-15T21:04:40.343Z
  - verified: rev-31 [reviewer] · run rev-20261015-480-source · 2026-10-15T21:06:02.705Z · commit 4662f7cc819c30c2f19d4a0d0530a640f39a5e03

## Comments

### impl-480 · 2026-10-15T20:57:30.179Z

Read E-468 and v0.1.3 / v0.1.2 instrumentation decisions. Existing session-model tests cover reported child models at the journal seam. Extending coverage to task-view usage and unreported fallback, keeping changes within T-480.

### impl-480 · 2026-10-15T21:02:16.575Z

Red acceptance run failed as expected on requested-model fallback and the old unknown sentinel. Implemented payload.model > payload.tool_input.model > unreported (Coordinator decision: payload-only), plus journal-backed task.view usage list in JSON and human output. Typecheck passed. Origin/dev was fetched/merged before first review; only tracker/doc updates arrived. Green targeted run waits for the Coordinator's exclusive T-427 Mac timing window to end.

### rev-31 · 2026-10-15T21:06:02.705Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-480-source
commit: 4662f7cc819c30c2f19d4a0d0530a640f39a5e03
scope: full

Source review clear at 4662f7cc819c30c2f19d4a0d0530a640f39a5e03, run rev-20261015-480-source, scope full. Fixed point 4662f7cc^; one implementation commit, nine files. No high, medium or low findings.

## Standards
No documented-standard or actionable baseline-smell findings against AGENTS.md, docs/agents/tests.md and existing module conventions. Test hubs now use projectHub for the two expanded cases, retaining native fake-harness commands and socket/CLI boundaries. Usage is composed in the hub dispatcher, with a type-only Tracker view extension and no tracker persistence. Journal projection uses asynchronous streaming, a captured byte boundary and cleanup in finally; parsing/projection resumes inside the request guard. Diff check passes. Both review axes were completed here because this role disables sub-agents.

## Spec
C2 verified at hub/src/adapters/sessions.ts:1323: every harness's absent child model becomes unreported in the shared recorder; no parent model/state is substituted. Claude interpretation at hub/src/adapters/claude-code.ts:134-143 selects nonempty reported payload.model first, otherwise the same payload's tool_input.model, otherwise no model. This follows Coordinator af345fc3-d332-4335-b64f-2b90c432f408: payload-only requested-model fallback, no new requested-model storage or discovery across records.

C1 source path reviewed: the dispatcher enriches successful task.view responses with Journal.subagents(value.item.id); the projection flushes accepted records, reads existing journal history at a captured size, filters exact item and subagent-launched event, retains parent/child identities and models, skips malformed records and releases its stream. JSON exposes item.usage.subagents; human output lists models and parent launch identity. Journal attribution continues using the parent's launch item and sessionId. Docs describe these boundaries accurately.

A-3359 supporting evidence checked: expected red failures for fallback/old sentinel; targeted session-model.test.ts 11/11 green, 29.26 s whole-file wall, typecheck green reported. Changed cases exercise payload precedence, absent models across Claude/Codex/OpenCode, real hook commands to journal then JSON/human CLI views, unrelated-item exclusion and unchanged parent model/state. C1 remains unverified pending exact-head gate evidence; source clear permits the lead's verify at this SHA. No per-item QA criteria. No Reviewer edits/tests.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3362: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3362-t-480-source-clear-at-4662f7cc.md

Criteria: C2 verified.

### impl-480 · 2026-10-15T21:42:00.282Z

Same-head gate evidence is green: run 8a8ecb38-761d-42f5-a45e-5d313a5df918 at 4662f7cc819c30c2f19d4a0d0530a640f39a5e03, auto-selected full due shared adapter contract. Droplet linux x64: 2227 tests, 2221 pass, 0 fail, 6 skip; hub + Neovim phases complete. Log A-3389. Reviewer received the result directly; final C1 verification/verdict pending. Head unchanged.

### rev-31 · 2026-10-15T21:42:15.674Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-480-final
commit: 4662f7cc819c30c2f19d4a0d0530a640f39a5e03
scope: evidence

Final evidence review clear at unchanged 4662f7cc819c30c2f19d4a0d0530a640f39a5e03, run rev-20261015-480-final, scope evidence.

No high, medium or low findings. C1 verified; C2 remains current from rev-20261015-480-source.

A-3389 / 8a8ecb38-761d-42f5-a45e-5d313a5df918 independently checked: exact source-reviewed SHA, Linux droplet c-8 lon1, four-worker hub/Neovim machine phases, full selection because the adapter contract changed. 2227 tests / 2221 pass / 0 fail / 6 skip / 0 cancelled; final exit 0. All changed session-model cases pass, including hook precedence/parent-state isolation (4.3496 s), real Claude hook → journal → JSON/human task-view usage and unrelated-item filtering (7.2224 s), Codex models (4.2973 s) and OpenCode models (4.5567 s), log lines 2549-2552. Full Neovim completes with 390 pass, 0 fail, 3 skip; the other three skips are in hub. Known-duration notices do not fail this run.

A-3359 already checked: targeted session-model 11/11 and typecheck green; source review establishes payload.model > same-payload tool_input.model > unreported, with no parent inference or cross-record discovery. C1's journal and CLI task usage behavior is now supported by the exact-head full gate.

Branch remains unchanged. All criteria verified, no per-item QA required. No Reviewer edits or test execution.
Review artifact A-3390: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3390-t-480-final-clear-at-4662f7cc-green-full-linux-suite.md

Criteria: C1 verified.

### coord · 2026-10-15T22:26:18.898Z

Merged b9e5e0c1a68fb61cf5eef0146682e5bc5e97d85f onto dev.
