---
id: T-998
kind: task
title: A malformed tool argument is answered as a permission refusal (forbidden)
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-939
branch: t/T-998-a-malformed-tool-argument-is-answered-as
created: 2026-10-20T16:52:35.140Z
updated: 2026-10-24T08:08:49.007Z
---

## Summary

A hub tool call with a malformed argument is answered with code `forbidden`, the code of a permission refusal. Under rule 5 a session must not retry a refusal, so a typo in a field name stalls it until the Coordinator says the call may be corrected.

## What to build

A call whose arguments fail validation (an unknown field, a missing required field, a value outside the enum) answers with its own code, for example `invalid_argument`, and names the field and the accepted values. Only a role or permission check answers `forbidden`. The Agents topic shows refusals only for `forbidden`.

Seen 2026-10-20 16:47Z: impl-975 called `task.criterion` with `action: "done"`, then `operation: "done"`; the field is `op`. Both answers were `code: forbidden`, reason "criterion operation must be done, verify, fail, add, edit or remove".

## Acceptance criteria

- [x] C1. `task.criterion` with an unknown field or a missing `op` answers a non-`forbidden` validation code that names the field and the accepted values (test).
  - done: impl-998 · 2026-10-24T08:04:53.216Z
- [ ] C2. Every spoke tool's argument validation failure uses the validation code, and a role refusal still answers `forbidden` (test over the tool table).
  - failed: rev-23 [reviewer] · 2026-10-24T08:08:49.007Z · note Conditional required plan arguments can still reach forbidden/Agents refusal; mutation table uses invalid baselines and can pass on unrelated validation errors.
- [x] C3. A validation failure is not posted to the Agents topic as a refusal (test).
  - done: impl-998 · 2026-10-24T08:04:53.496Z
- [x] C4. The MCP server instructions and `hub/README.md` say a validation error may be corrected and retried, unlike `forbidden`.
  - done: impl-998 · 2026-10-24T08:04:53.588Z

## Comments

### impl-998 · 2026-10-24T07:53:40.807Z

TDD slice 1: added in-memory public-dispatch criterion regression. Saw forbidden for action:done before the change; targeted tool-arguments.test.ts now passes on this working tree, local macOS, T1 only (no suite gate run). Continuing table/MCP coverage.

### impl-998 · 2026-10-24T08:04:53.809Z

Implemented and pushed 203c05ad4579cce1f52c1934fff9f4874a2e10f4 on t/T-998-a-malformed-tool-argument-is-answered-as; merged fetched origin/dev 4727549e before first source review. Shared schema validation precedes permission checks; typed validation replies preserve ok/error/reason and do not post Agents refusals. New T1 table covers unknown/missing/type/enum and cross-field failures; T2 pins SDK envelope -32603 and typed hub forwarding. Existing permission controls now supply valid args; omitted handover note gets invalid_argument while supplied incomplete text/empty sections retain note-incomplete. Local macOS targeted passes: tool-arguments 4, spoke 1, permissions 14, in-process-spoke 4, handover 3, lead-handover 3, inbox-requests-component 10. Final npm run check at pushed head is running; no verification suite yet. QA policy is none.

### rev-23 · 2026-10-24T08:08:49.007Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-998-source
commit: 203c05ad4579cce1f52c1934fff9f4874a2e10f4
scope: full
findings: [{"severity":"medium","text":"M1: enforce declared conditional required arguments before role checks; task.plan {op:'set'} currently passes validation without id/yaml and reaches forbidden for an Implementer.","file":"hub/src/tool-arguments.ts","line":40},{"severity":"medium","text":"M2: derive mutations from valid structural baselines and assert the affected diagnostic field; ask/subscription bases are already invalid, masking missing-field/type regressions.","file":"hub/test/tool-arguments.test.ts","line":43}]
finding_counts: {"high":0,"medium":2,"low":0}

T-998 full source review — not clear

Head 203c05ad4579cce1f52c1934fff9f4874a2e10f4; tree aa273dc77e46faf74c0447c0daf7c4b3f63cd780. Fixed incorporated dev base 4727549e; comparison git diff 4727549e...203c05ad. Three task/merge commits, 22 changed files, 499 additions / 223 removals. Run rev-20261024-998-source. Both axes reviewed in-session; crew reviewer subagents are disabled.

## Standards

M2 (medium), hub/test/tool-arguments.test.ts:43–53. The every-tool mutation test does not establish a valid baseline before changing one field: required fields without an enum become the string 'fixture', including ask.options, subscribe.subject and subscribe.events. An omitted ask.question or a mutated subscription field can therefore still return invalid_argument because another untouched field was already invalid. The test only checks the code and a nonempty reason, so it cannot establish the claimed missing/type coverage for those fields. Supply valid structural baselines, prove baseline validity through the pure validator without dispatching tool side effects, and require the diagnostic to identify the intentionally changed/missing field. Keep dispatcher and no-Agents-refusal assertions.

Other standards reviewed: new T1 uses real dispatcher handlers with in-memory store/roles and FakeClock; new T2 uses in-process MCP and a loopback stub socket because the MCP/HubClient boundary is the subject. Its close hooks await spoke/server closure, bounded receipt helpers retain final assertions, and no subprocess/browser is introduced. Tier entries and indexed exact-path notes are supplied. Permission controls now use valid argument shapes rather than weakening their authorization assertions. Handover migrations retain note-incomplete diagnostics for supplied incomplete notes while structural absence receives validation code. The shared table extraction avoids independent schemas. No unrelated size-policy expansion. Diff whitespace check passes.

## Spec

M1 (medium), hub/src/tool-arguments.ts:40–60 / hub/src/spoke/task-tools.ts task.plan schema. Conditional required inputs remain outside the shared validator. For example task.plan {op:'set'} passes because the schema requires only op; an Implementer then receives forbidden from plan-set authorization and an Agents refusal, although id and yaml are missing. The tool explicitly describes yaml as required for set, and non-migrate operations require an item. This retains the original stall pattern for a malformed call and violates C2's every-spoke-tool argument validation contract. Move the structural conditional requirement before permissions (schema or shared validator), cover it at public dispatcher with a role lacking plan-set authority, and retain a well-formed forbidden control. Audit the other declared conditional required arguments without converting state-dependent business/authorization failures into validation errors.

C1's reported criterion action/operation/missing-op/bad-enum shapes are handled and name op plus its accepted values. InvalidArgument returns additive ok:false/error/code/reason, and bypasses #refuse/Agents notices. Local MCP validation and HubClient Refused.reason forwarding preserve typed details; malformed arguments envelopes remain the SDK error and never reach the hub. Protocol and shared wire add the code while keeping prior fields. Wire normalization covers task item/request identity, labels, nested verdicts, send replyTo, subscription names, verify suite.start, summary-only list fields, nullable creates and legacy rule origins. The new stricter validation is intentionally before authorization, but M1 leaves that contract incomplete. No other source finding.

C4 documentation is established at this source: MCP instructions and hub README explicitly allow correction/retry for invalid_argument and keep forbidden escalation; matching session-permission and implement/handover guidance is updated. No role-clause lines are added per launch constraint.

## Evidence and limits

A-10469 summarizes implementation-tree local macOS targeted passes: tool-arguments 4, spoke 1, permissions 14, in-process-spoke 4, handover 3, lead-handover 3, inbox-requests-component 10 (39 total). These are attributed to red/green working trees leading to this head, not exact-head runtime receipts. The request updates final npm run check at this exact head to passed, with report-only lint 132 findings/zero refusals; artifact's pending-check note is historical. Original raw commands/stdout/native exits/timings and source/platform attribution have been requested for durable preservation from retained tool records, without transcription reruns. No configured suite yet. Reviewer performed static source/Git/artifact inspection only, no tests/probes, edits, GUI, merge or delegation.

C2 failed for M1/M2. C1/C3 runtime pending; C4 source established. Complete finding set M1–M2. Correct, commit/push, request fresh review before mode-free verification. QA policy none/after-stage. Standards: one medium finding. Spec: one medium finding.
Durable review A-10478.

Criteria: C2 failed (Conditional required plan arguments can still reach forbidden/Agents refusal; mutation table uses invalid baselines and can pass on unrelated validation errors.).
