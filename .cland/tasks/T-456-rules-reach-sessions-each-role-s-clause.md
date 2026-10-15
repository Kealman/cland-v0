---
id: T-456
kind: task
title: "Rules reach sessions: each role's clause and launch brief carry its active rules, rule.add/edit/retire/list tools write them with a human-message origin, and a changed rule arrives as a rule event at the next turn"
state: open
status: in progress
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
updated: 2026-10-15T14:07:43.628Z
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
- [x] C2. A rule scoped to `implementer`, added from the shell, reaches a running fake Implementer at its next turn as a `rule` event with its full text, and does not reach the fake Coordinator; an edit and a retirement reach the Implementer the same way.
  - done: impl-456 · 2026-10-15T13:40:28.405Z
- [x] C3. After a reconnect, the Implementer's re-sent clause carries the current rules, including one added while it was disconnected.
  - done: impl-456 · 2026-10-15T13:36:01.653Z
- [x] C4. A Coordinator's `rule.add` naming the human's message records that origin, while one naming an agent's message or no message, and an Implementer's `rule.add`, are refused with `forbidden` and a reason.
  - done: impl-456 · 2026-10-15T13:36:02.217Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
- [x] C5. An Aide's `rule.add` records `session:<name>` as origin, and every role's `rule.list` returns the active rules, filtered by `role` when given.
  - done: impl-456 · 2026-10-15T13:36:02.773Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
- [x] C6. A `rule` event never changes the inbox count or shows as a needs-you, never steers a running turn, and shows as a row in the events view, reachable from the palette's kind filter while keys `1`–`9` keep their kinds.
  - done: impl-456 · 2026-10-15T13:36:03.339Z
- [x] C7. The Coordinator's and the Aide's clauses, in `default-roles.ts` and the live `.cland/roles.toml`, say to record a stated rule with `rule.add` and never only in a memory, and that a memory repeating a rule names its number.
  - done: impl-456 · 2026-10-15T13:36:03.904Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a
- [x] C8. `hub/README.md` describes rules in clauses and briefs, the `rule.*` tools and the origin rule, and the `rule` event, and `nvim/README.md` lists the `rule` kind in the events view's palette filter.
  - done: impl-456 · 2026-10-15T13:36:04.689Z
  - verified: rev-31 [reviewer] · run rev-20261015-456-source-2 · 2026-10-15T13:41:07.371Z · commit a269ce0c80d7c6fc851e6ec4a421e4625117ee2a

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
