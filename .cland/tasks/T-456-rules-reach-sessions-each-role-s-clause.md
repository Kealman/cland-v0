---
id: T-456
kind: task
title: "Rules reach sessions: each role's clause and launch brief carry its active rules, rule.add/edit/retire/list tools write them with a human-message origin, and a changed rule arrives as a rule event at the next turn"
state: open
status: ready
size: L
criterion_seq: 8
labels:
  - v0.1.3
  - hub
  - nvim
assignee: null
parent: E-423
blocked_by:
  - T-454
  - T-455
topic: topic-295
branch: t/T-456-rules-reach-sessions-each-role-s-clause
created: 2026-10-15T07:15:15.550Z
updated: 2026-10-15T15:12:04.095Z
---

## Summary

The rulebook from ticket T-455 becomes what every session reads. The hub puts a role's active rules into its clause and at the end of the launch brief, and gives sessions the `rule.*` tools. Writes are bounded by the origin rule: a Coordinator records a rule only from a human's message. Each new, edited or retired rule is delivered to every running session in its scope as an event of the new kind `rule`.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 4 of 7; spec `docs/spec/v0.1.3.md` §3.2 ("How it reaches sessions"); the epic's choices "Who records a rule", "What the clause carries", "How a change arrives" and "Memories as caches"; ADRs 0001 and 0007.

## What to build

**The clause and the brief (`hub/src/roles/clause.ts`, the launch path in `hub/src/hub/core.ts`).**

- After the clause text the hub appends a section "Project rules for your role". It lists each active rule in the role's scope as `rule <n>: <text> (reason: <reason>)`, in id order.
- A role with no rules in scope gets the line "No project rules apply to your role."
- The brief at launch ends with the same list, so the session reads the rules before its first action.
- Retired rules appear in neither.
- The clause the hub re-sends at a reconnect is built from the current rulebook.

**The tools.**

- `rule.add`, `rule.edit` and `rule.retire` take the fields of `cland rule` (text, scope, reason; the number for edit and retire) plus an `origin`.
- `rule.list` takes `all` and `role`, and every role may call it.
- Permissions live in `hub/src/roles/permissions.ts` and the default `roles.toml`, and the live `.cland/roles.toml` is updated with them.
- The Coordinator and the Aide hold the write tools.
- A Coordinator's write names as origin a message `{ topic, msg_id }`. The hub refuses one whose message does not exist or was not written by the human (`from_kind = human`), with code `forbidden` and a reason.
- An Aide's write records `session:<aide-name>` as origin.
- Any other role's write is refused, and the reason says to propose the rule to the Coordinator in the item topic.
- Expose the tools through the spoke's tool list (`hub/src/spoke/instructions.ts` and the tool registry) like `task.*`.

**The `rule` event.**

- `EVENT_KINDS` and `nvim/lua/cland/event_kinds.lua` gain `rule` as the tenth kind, after `heartbeat` (ticket T-454).
- `EventSubject` gains the kind `rule`, with the rule number as id.
- A new, edited or retired rule is delivered to every running session whose role is in its scope. Aides in scope are included: the hub addresses the delivery to each session, so it is not a broadcast.
- No subscription is needed. The delivery uses `digest: turn`, arrives at the session's next turn and never steers a running turn.
- It carries the rule's full new text with its scope and reason, or its retirement with the reason.
- A scope edit that removes a role delivers the retirement form to that role's sessions.
- It is never a needs-you.
- The events view shows a row per change. Key filters stay single-digit, so `rule` is filtered from the palette, which lists every kind: cap the numeric loop in `nvim/lua/cland/actions.lua` at `9`.

**Memories as caches.** The Coordinator's and the Aide's clauses, in `default-roles.ts` and the live `.cland/roles.toml`, say three things:

- record a rule the human states with `rule.add`, never only in a harness memory;
- a memory that repeats a rule names its number;
- the other roles propose a rule to the Coordinator in their item topic.

**Tests.** Use a fake Claude Code Coordinator and a fake Codex Implementer (`hub/test/fakes/`) against a real hub. The rule changes come from both the shell (`cland rule`) and the tools.

## Acceptance criteria

- [x] C1. A role's clause ends with "Project rules for your role" listing its in-scope active rules as `rule <n>: <text> (reason: <reason>)` in id order, or the no-rules line, and the launch brief ends with the same list; retired rules appear in neither.
  - done: impl-456 · 2026-10-15T13:36:00.289Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-3 · 2026-10-15T14:15:41.958Z · commit a4a899c64dcb8629e08ce6717fde30270ad8509a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-4 · 2026-10-15T14:34:13.441Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.522Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.790Z · commit b9836a1d88f766c3bca67c547af5164e2463d954
- [x] C2. A rule scoped to `implementer`, added from the shell, reaches a running fake Implementer at its next turn as a `rule` event with its full text, and does not reach the fake Coordinator; an edit and a retirement reach the Implementer the same way.
  - done: impl-456 · 2026-10-15T13:40:28.405Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.522Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.790Z · commit b9836a1d88f766c3bca67c547af5164e2463d954
- [x] C3. After a reconnect, the Implementer's re-sent clause carries the current rules, including one added while it was disconnected.
  - done: impl-456 · 2026-10-15T13:36:01.653Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.522Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.790Z · commit b9836a1d88f766c3bca67c547af5164e2463d954
- [x] C4. A Coordinator's `rule.add` naming the human's message records that origin, while one naming an agent's message or no message, and an Implementer's `rule.add`, are refused with `forbidden` and a reason.
  - done: impl-456 · 2026-10-15T13:36:02.217Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-3 · 2026-10-15T14:15:41.958Z · commit a4a899c64dcb8629e08ce6717fde30270ad8509a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-4 · 2026-10-15T14:34:13.442Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.522Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.790Z · commit b9836a1d88f766c3bca67c547af5164e2463d954
- [x] C5. An Aide's `rule.add` records `session:<name>` as origin, and every role's `rule.list` returns the active rules, filtered by `role` when given.
  - done: impl-456 · 2026-10-15T13:36:02.773Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-3 · 2026-10-15T14:15:41.958Z · commit a4a899c64dcb8629e08ce6717fde30270ad8509a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-4 · 2026-10-15T14:34:13.442Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.522Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.790Z · commit b9836a1d88f766c3bca67c547af5164e2463d954
- [x] C6. A `rule` event never changes the inbox count or shows as a needs-you, never steers a running turn, and shows as a row in the events view, reachable from the palette's kind filter while keys `1`–`9` keep their kinds.
  - done: impl-456 · 2026-10-15T13:36:03.339Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.522Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.791Z · commit b9836a1d88f766c3bca67c547af5164e2463d954
- [x] C7. The Coordinator's and the Aide's clauses, in `default-roles.ts` and the live `.cland/roles.toml`, say to record a stated rule with `rule.add` and never only in a memory, and that a memory repeating a rule names its number.
  - done: impl-456 · 2026-10-15T13:36:03.904Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-3 · 2026-10-15T14:15:41.958Z · commit a4a899c64dcb8629e08ce6717fde30270ad8509a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-4 · 2026-10-15T14:34:13.442Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.522Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.791Z · commit b9836a1d88f766c3bca67c547af5164e2463d954
- [x] C8. `hub/README.md` describes rules in clauses and briefs, the `rule.*` tools and the origin rule, and the `rule` event, and `nvim/README.md` lists the `rule` kind in the events view's palette filter.
  - done: impl-456 · 2026-10-15T13:36:04.689Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-3 · 2026-10-15T14:15:41.958Z · commit a4a899c64dcb8629e08ce6717fde30270ad8509a
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-4 · 2026-10-15T14:34:13.442Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-final · 2026-10-15T15:01:37.523Z · commit ab1037c0ec32355cd82e7236eeda458c2a916dab
  - verified: rev-31 [reviewer] · run rev-20261015-456-merge-delta · 2026-10-15T15:12:01.791Z · commit b9836a1d88f766c3bca67c547af5164e2463d954

## Comments

### impl-456 · 2026-10-15T13:30:03.307Z

Implemented current scoped rules in clauses/briefs, origin-authorized rule tools, RulebookFile observer and per-change turn-digested delivery (scope removal, Aides, hand edits), rule event/filter vocabulary and cache clauses. New rule-sessions integration file: 5/5 pass, each test <3.4s. Completing Neovim targeted checks and adjacent regressions before review.

### rev-31 · 2026-10-15T13:38:44.866Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-456-source-1
commit: 1a45624503ae358854894ef688df31e88186c114
scope: full

Source review not clear at 1a45624503ae358854894ef688df31e88186c114.

## Standards
No independent documented-standard violations or actionable smell findings. The diff follows the existing rulebook, permissions, delivery and events seams.

## Spec
Medium — hub/src/hub/core.ts:204-205: #rulesChanged adds every retained #heartbeatProcesses row, including stopped/exited processes, and also retains terminal process-backed connections from #live. seedProcess/publishProcess keep terminal rows until pruneProcess, and #recordNotice persists their addressed deliveries without a running-status filter. Thus a rule added while a session is stopped is queued for it and can replay after relaunch, outside the required fan-out to running sessions. Filter terminal process-backed connections/rows while retaining live standalone spokes and running-but-disconnected processes; cover stop/add and terminal connection cases. Implementer confirmed the missing filter in 2c372f83 and is preparing a replacement head.

Other inspected requirements: clause and launch brief share an ordered active scoped list; reconnect rebuilds from current rules; Coordinator tool writes revalidate current identity/permissions and a stored human-message origin; Aide tool writes force session:<name>; default/live grants and rule.list are present for all roles. Scope-removal retirement form, direct Aide delivery, background visibility, rule subject/event row identity and 1–9/palette filtering are wired. Cache clauses and both READMEs cover the requested behavior.

C2 failed for terminal-session fan-out. Other criteria are left unverified in this not-clear source pass; runtime evidence is pending a fixed source review and same-head verify. No Reviewer tests or edits.
Standards: 0 findings. Spec: 1 medium finding.

Criteria: C2 failed (Rule-change fan-out also queues deliveries for stopped/exited process rows; restrict recipients to running sessions.).

### rev-31 · 2026-10-15T13:41:07.371Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-456-source-2
commit: a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
scope: full

Source review clear at a269ce0c80d7c6fc851e6ec4a421e4625117ee2a. No high, medium or low findings remain.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, hub/README.md guidance or the baseline smells. The replacement changes only recipient filtering and its regression; earlier inspected source remains unchanged.

## Spec
The rev-20261015-456-source-1 medium finding is resolved at hub/src/hub/core.ts:204-209: both live process-backed connections and retained process rows require running status. Live standalone spokes and running/disconnected processes remain eligible. The added public stop/reassign-role/add regression proves only the live spoke is addressed; A-3035 records red on the previous head and complete fixed rule-sessions 6/6 green.

C1 verified by source: projectRulesText filters active scoped rules and sorts numbers; startup clause/brief use the same suffix, including the empty list line.
C4 verified by source: Coordinator writes validate current connection, current grants and the stored human message's topic/id, repeating authorization before the queued write commits; absent/agent/wrong-topic origin yields forbidden. Other roles are denied with the proposal instruction.
C5 verified by source: Aide tool writes force session:<name>; rule.list filters active/all and role; all default/live roles receive read grants.
C7 verified: default-roles.ts and live roles.toml carry rule.add/memory-number instructions for Coordinator/Aide and proposal instructions for other roles.
C8 verified: both READMEs describe clauses/briefs, tool origins, turn-digested events and rule palette filtering.

C2, C3 and C6 remain unverified until same-head post-source runtime evidence: shell add/edit/retire routing to fake sessions, reconnect refresh, no steering/needs-you, and Neovim rendering/filter interaction. Source paths and targeted coverage for these were inspected: direct Aide notices, removed-role retirement, turn-only binding, background visibility, one-row-per-change identity and numeric keys 1–9 with a palette-only tenth kind. A-3029/A-3035 report targeted rule-sessions, rule CLI, permissions, briefs and Neovim events green; they do not replace the exact-head gate.

Review covers the full original diff plus the replacement correction. No Reviewer tests or edits.
Standards: 0 findings. Spec: 0 unresolved findings; C1,C4,C5,C7,C8 verified.

Criteria: C1 verified, C4 verified, C5 verified, C7 verified, C8 verified.

### rev-31 · 2026-10-15T14:07:43.628Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-456-linux-1
commit: a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
scope: evidence

Evidence review not clear at unchanged a269ce0c80d7c6fc851e6ec4a421e4625117ee2a.

## Standards
Medium — hub/test/harness.ts:29 and hub/test/aide.test.ts:10: the documented tool inventory and exact Aide grants omit the four new rule tools; five deterministic assertions fail across aide, resilience, spoke-identity and surface tests (A-3050:3945-3996,4010-4090,4122-4248).
Medium — hub/test/tracker-container-source.test.ts:221: the expected valid Lua declaration still has nine EventKinds; the protocol-aware guard rejects that fixture now that rule is tenth (A-3050:4250-4273).
Medium — hub/test/rule-sessions.test.ts:79,135: new cases take 8.109 s and 5.042 s under Linux load and lack reasoned durations.json allowances required by docs/agents/tests.md; both are explicit duration budget failures (A-3050:5937-5938).

## Spec/integration
Medium — hub/src/roles/default-roles.ts:58 and .cland/roles.toml:46: added clause text takes the empty-rulebook Coordinator reply to 7926 bytes, exceeding the established MAX_TEXT_BYTES - 512 headroom guard (7680 bytes), so both roles snapshots fail at roles.test.ts:80 (A-3050:4092-4120). Restore headroom while keeping the requested rules/memory instructions and the size guard.

Unrelated failure, reported Bugs/S to lead for classification: hub/test/orphan-servers.test.ts:346 OpenCode unverifiable-server case hits 'database is locked' (A-3050:3998-4007). T-430's init case is a different signature; no exact known-ticket classification found.

Gate 9d3032d2-5af5-4902-b92c-43c6007fec57 / A-3050 is exit 1 at reviewed/current head: Linux c-8, 1744 pass / 9 fail / 3 platform skips, plus the two duration-budget failures. All six rule-sessions functional cases pass (A-3050:2369-2377). Host/remote typecheck pass, but Neovim phase is not reached. This is not eligible for a known-flake exception because deterministic changed-surface contracts and own-file duration budgets fail.

Source-established C1,C4,C5,C7,C8 marks remain; no new failed behavioral criterion is inferred solely from stale test expectations. C2,C3,C6 remain unverified pending a corrected source review and accepted same-head runtime evidence. Restore the integration contracts, request source re-review at the replacement head, then verify after the Coordinator lifts the restart hold. No Reviewer tests or edits.
Standards/integration: 3 medium groups. Spec/integration: 1 medium group. Separate SQLite failure awaits classification.

### rev-31 · 2026-10-15T14:15:41.958Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-456-source-3
commit: a4a899c64dcb8629e08ce6717fde30270ad8509a
scope: full

Source review clear at a4a899c64dcb8629e08ce6717fde30270ad8509a. No high/medium/low findings remain in the revised source.

## Standards
Prior A-3052 integration findings are addressed: DOCUMENTED_TOOLS includes rule.add/edit/list/retire and preserves dev's verify tool; aide.test.ts expected grants match the new rules tools; tracker-container-source.test.ts's valid fixture has all ten kinds and keeps its negative guard cases. durations.json adds the two measured Linux allowances (8.109 s and 5.042 s) with concrete lifecycle reasons and A-3050 provenance; pre-existing baseline values are preserved semantically.

## Spec
Coordinator decision 8ea909f0-7a82-41a9-9770-c4615dbc59cd was read directly in topic history. It authorizes the guard/design adjustment: full project rules stay in clauses and briefs; base instructions alone retain the 512-byte reserve; cache guidance belongs at the start of the rules section.
roleClauseSections and projectRulesText implement that separation. roleDefinition retains staffing before the rules section, clauseText retains skills, and #recordClause retains handover notes before appending the complete current rules section. The launch clause and brief use the same scoped current suffix and guidance. Default/live prior instructions, including newly merged T-395 instructions, remain present relative to current dev d6e222be; the four rules tools/grants coexist with that integration.
roles.test.ts now measures the base only while asserting the rules section and Coordinator/Aide cache guidance exist. New rule-sessions regression constructs a >8192-byte rule-bearing role event, checks its full ending and compares the reconnect event byte-for-byte; it does not truncate content or widen the send cap. A-3063 reports roles 8/8 and rule-sessions 7/7 plus all previously failed tool/grant/guard files green.
The stopped-session recipient correction remains in place.

C1,C4,C5,C7,C8 source verification is refreshed at this head: ordered active scoped clause/brief lists; human-origin and role authorization; Aide origin and list filters/grants; cache clauses; updated hub/Neovim documentation. C2,C3,C6 remain unverified until the replacement head's accepted runtime receipt, including Linux Neovim rendering/filter interaction.

Review carries the prior full source review forward, checks both corrective commits and their merge against current dev, and judges the revised section design under the explicit Coordinator decision. A-3050 remains a failed earlier-head receipt; A-3063 targeted evidence does not replace fresh verification. Separate orphan-server SQLite failure is tracked as T-499. No Reviewer tests or edits.
Standards: 0 unresolved findings. Spec: 0 unresolved findings.

Criteria: C1 verified, C4 verified, C5 verified, C7 verified, C8 verified.

### rev-31 · 2026-10-15T14:32:33.467Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-456-local-1
commit: a4a899c64dcb8629e08ce6717fde30270ad8509a
scope: evidence

Evidence review not clear at unchanged a4a899c64dcb8629e08ce6717fde30270ad8509a.

## Standards
Medium — hub/test/handover.test.ts:103: the test still requires /You are the Coordinator of this project/, while merged T-395 defaults say 'You are the Coordinator: lead the root of the item tree.' A-3066:3968-3975 shows this deterministic text mismatch, not loss of the role event or handover note. This stale contract blocks the suite; update the assertion to the intended current contract and retain the behavioral handover checks.

## Spec/evidence
The automatic-fallback run 8c88479a-6f0d-494e-8693-0288715c2bc7 / A-3066 is local darwin arm64, exit 1: 1770 pass / 1 fail / 0 skips / 0 cancellations. It stops in the hub phase, so there is no Neovim result. All seven rule-sessions cases pass, including stopped-session filtering and complete over-cap assignment/reconnect. Previously reported integration tests/budgets are green in this run; no new budget failure.
Source review rev-20261015-456-source-3 stands for its five source-established marks; C2,C3,C6 remain unverified until an accepted complete exact-head receipt. This red local receipt supplies neither a green gate nor Linux Neovim evidence.

Aside to lead: Bugs / XS, regression of T-395 — deterministic stale handover Coordinator-intro assertion after default-clause rewrite. Resolve/classify through the lead and obtain source review at any replacement head before verification. No behavioral criterion failure inferred from this stale phrase alone. No Reviewer tests or edits.
Standards: 1 medium integration finding. Spec: no new product finding; accepted runtime evidence outstanding.

### rev-31 · 2026-10-15T14:34:13.442Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-456-source-4
commit: ab1037c0ec32355cd82e7236eeda458c2a916dab
scope: delta

Delta source review clear at ab1037c0ec32355cd82e7236eeda458c2a916dab. No high/medium/low findings.

## Standards
Only non-tracker delta from source-reviewed a4a899c6 is hub/test/handover.test.ts:103's regex update to the current accepted Coordinator intro. The note, role identity, revocation, claim/state and other behavioral assertions are retained. Stable patch-id 1f90563b28b95bcd2016a837277a50369c871eb6 matches shared dev b8ae050b exactly; diff check passes. Coordinator reports handover 4/4. No production or other test changes.

## Spec
Prior full source review rev-20261015-456-source-3 carries forward unchanged. Refresh C1,C4,C5,C7,C8 at this exact head: active scoped clause/brief rules and guidance; human-message Coordinator authorization; Aide origins/list filtering and grants; cache clauses; docs.
C2,C3,C6 stay unverified until the next accepted complete same-head runtime receipt. A-3066 remains red at the older head, though all seven rule-session cases and the other 1770 hub cases passed. Neovim still needs to execute.
Coordinator decision a1143a4f was read in topic history: adopt the shared fix, delta review, then one verify; a green next verify is the gate. Await the complete default-executor run under that decision.

Standards: 0 findings. Spec: 0 source findings. No Reviewer tests or edits.

Criteria: C1 verified, C4 verified, C5 verified, C7 verified, C8 verified.

### rev-31 · 2026-10-15T14:57:04.783Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-456-linux-2
commit: ab1037c0ec32355cd82e7236eeda458c2a916dab
scope: evidence

Evidence review not clear at unchanged ab1037c0ec32355cd82e7236eeda458c2a916dab.

## Standards
No new T-456 source finding; source review rev-20261015-456-source-4 remains valid.

## Spec/evidence
Medium gate blocker — hub/test/suite-close-recovery.test.ts:54: lost-machine fixture expects 'shard-1: remote machine lost' but receives a successful two-shard exit-0 report (A-3082:3992-4018). This is outside T-456's diff and originates from merged T-395. The fixture removes the fake provider machine, then releases both package barriers; a polling/order race is possible but not established by this receipt. No exact known-ticket match found. Reported Bugs/S, regression of T-395, for lead classification rather than assuming a known-flake retry.

Linux gate ae7c7a40-0d49-4fd3-886b-3d63a2512ef1 / A-3082: exit 1, 1767 pass / 1 fail / 3 platform skips / 0 cancellations; full selection stops in hub, so no Neovim evidence. All seven rule-sessions cases pass, including scoped shell changes, no-steer behavior, reconnect rules, stop filtering and over-cap events. No new duration budget failure. Current branch tip matches the reviewed head.

Five source criterion marks retained; C2,C3,C6 remain unverified pending accepted complete runtime evidence. Coordinator a1143a4f named a green next verify as the gate; this receipt is red. No failed implementation criterion inferred from the unrelated fixture alone. No Reviewer tests or edits.
Standards: 0 findings. Spec/evidence: 1 medium gate blocker outside task scope.

### rev-31 · 2026-10-15T15:01:37.523Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-456-final
commit: ab1037c0ec32355cd82e7236eeda458c2a916dab
scope: evidence

Final review clear at unchanged ab1037c0ec32355cd82e7236eeda458c2a916dab under the Coordinator's explicitly accepted paired-receipt gate. No unresolved source findings in T-456.

## Standards
Current source review rev-20261015-456-source-4 stands. Earlier terminal-recipient, tool/grant/guard-fixture and duration-allowance findings are corrected. Shared handover regex patch matches b8ae050b exactly; no head change after its delta review.

## Spec
C1: common ordered active scoped rules/guidance suffix in clause and brief, empty-scope line and retired exclusion checked in source and rule-sessions.
C2: shell add/edit/retire reaches the fake Codex Implementer at subsequent turns and stays outside the fake Claude Coordinator's scope; tests pass on both platforms.
C3: current rules appear on reconnect, including disconnected edits; over-8192-byte assignment/reconnect remains complete; both cases pass.
C4/C5: human-message Coordinator authorization, refusals, Aide session origin and role-filtered reads pass alongside source authorization/grant review.
C6: hub no-steer/no-needs-you and per-change rows pass; local Neovim confirms rule palette filter, persistent rule subject, and unchanged numeric kinds 1–9.
C7/C8: current default/live cache clauses and hub/Neovim docs checked in source.
All C1–C8 verified across source and the accepted evidence.

Accepted evidence:
- A-3066 / 8c88479a-6f0d-494e-8693-0288715c2bc7: local darwin arm64 at a4a899c6, 1770 pass / 1 fail. Sole red handover.test.ts:103 is the shared dev defect corrected by b8ae050b; only that non-tracker patch separates this head from final ab1037c0. All seven rule-session cases pass.
- A-3082 / ae7c7a40-0d49-4fd3-886b-3d63a2512ef1: Linux c-8 at exact reviewed/current ab1037c0, 1767 pass / 1 fail / 3 macOS-only skips. Sole red suite-close-recovery lost-shard assertion is classified T-502; all T-456 cases and the seven rule-session cases pass. Neither hub receipt reached Neovim.
- A-3084: authorized npm run test:nvim -- nvim/test/*.test.ts at unchanged ab1037c0, exit 0, 389 pass / 0 fail / 0 cancelled / 0 skipped; 75.24 s, peak load 6.56. The rule palette/numeric filter case passes (line 110); existing duration notices are non-failing.

Coordinator decisions 1af2b08a-a204-46c7-9672-fbd93503fad4 and correction f90d7f15-6bc0-442a-874c-4020deba330f were read directly: they accept this Mac/Linux pair despite the reds, plus this local Neovim run. Both suite receipts remain historically red; final clear uses that explicit exception, not a claim of a green full run. Linux Neovim coverage is deferred to integrated close coverage under the standing mixed-diff rule.

Standards: 0 unresolved findings. Spec: 0 unresolved findings in task scope. No Reviewer tests or edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### rev-31 · 2026-10-15T15:12:01.791Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-456-merge-delta
commit: b9836a1d88f766c3bca67c547af5164e2463d954
scope: delta

Delta review clear at b9836a1d88f766c3bca67c547af5164e2463d954. No high, medium or low findings.

## Standards
Resolved merge 9e67c086 preserves the existing module boundaries; no new standards/smell findings. Diff check passes. The last refresh changes only tracker files and the shared T-467 Codex test fix; rule writer file is byte-identical to the prior reviewed/shared writer.

## Spec
hub/src/hub/core.ts:191,361-362,443-445 retains both subscriptions and both unsubscribe calls: rule changes still produce scoped next-turn session events and also publish T-458's rules.changed UI frame.
hub/src/hub/dispatch.ts:1496-1506 preserves workbench origins for add/edit/retire, rejects non-string/non-memory shell origins, preserves existing shell edit origins, and retains separate Coordinator/Aide tool authorization with human-message/session origins.
hub/test/rule-sessions.test.ts:106 adds a rules.changed UI assertion to the existing scoped next-turn delivery case, proving both merge paths execute for the same change. Clause rendering, complete over-cap rules, scope-removal retirement, stopped-session filtering, inbox behavior and event palette keys remain unchanged.
The common RulebookFile writer is unchanged, avoiding divergent write/origin semantics between the two tasks.

A-3097 checked: the recorded identifier/text search found 16 matching executable test files; all ran plus hub rulebook/rule-sessions and Neovim events (19 files total). Each log shows zero failures/skips/cancellations; totals are 218/218. Includes rules CLI 7/7, rule-sessions 7/7, rulebook 2/2, Neovim rulebook 4/4, Neovim events 4/4, plus all other matching files. Targeted checks ran after conflict resolution; final refresh adds only the shared test fix and tracker updates. Typecheck/diff-check evidence reported in the artifact; no Reviewer tests or edits.

All C1–C8 refreshed at this head using the prior full source/final review plus this delta and targeted evidence: scoped clause/brief/reconnect rules; scoped add/edit/retire turn delivery; origin/refusal/read permissions; no-needs-you/no-steer/event view filters; cache clauses; docs.

Gate decision 164d64f8-bebe-40b0-a34d-515dd656af0b was read directly in topic history: resolve T-458, run all identifier/text-matching tests plus rulebook/rule-session/Neovim-rulebook files, then delta review; no new full verify, with stage-2 close coverage after T-459. This verdict applies that explicit decision. Prior accepted A-3066/A-3082 pair, A-3084 Neovim and rev-20261015-456-final remain provenance, not a fresh green full run at this head.
Standards: 0 findings. Spec: 0 findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
