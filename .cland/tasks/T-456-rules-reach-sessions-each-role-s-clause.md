---
id: T-456
kind: task
title: "Rules reach sessions: each role's clause and launch brief carry its active rules, rule.add/edit/retire/list tools write them with a human-message origin, and a changed rule arrives as a rule event at the next turn"
state: open
status: planned
size: L
labels:
  - v0.1.3
  - hub
  - nvim
assignee: null
parent: E-423
blocked_by:
  - T-454
  - T-455
topic: null
branch: null
created: 2026-10-15T07:15:15.550Z
updated: 2026-10-15T13:19:33.320Z
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

- [ ] C1. A role's clause ends with "Project rules for your role" listing its in-scope active rules as `rule <n>: <text> (reason: <reason>)` in id order, or the no-rules line, and the launch brief ends with the same list; retired rules appear in neither.
- [ ] C2. A rule scoped to `implementer`, added from the shell, reaches a running fake Implementer at its next turn as a `rule` event with its full text, and does not reach the fake Coordinator; an edit and a retirement reach the Implementer the same way.
- [ ] C3. After a reconnect, the Implementer's re-sent clause carries the current rules, including one added while it was disconnected.
- [ ] C4. A Coordinator's `rule.add` naming the human's message records that origin, while one naming an agent's message or no message, and an Implementer's `rule.add`, are refused with `forbidden` and a reason.
- [ ] C5. An Aide's `rule.add` records `session:<name>` as origin, and every role's `rule.list` returns the active rules, filtered by `role` when given.
- [ ] C6. A `rule` event never changes the inbox count or shows as a needs-you, never steers a running turn, and shows as a row in the events view, reachable from the palette's kind filter while keys `1`–`9` keep their kinds.
- [ ] C7. The Coordinator's and the Aide's clauses, in `default-roles.ts` and the live `.cland/roles.toml`, say to record a stated rule with `rule.add` and never only in a memory, and that a memory repeating a rule names its number.
- [ ] C8. `hub/README.md` describes rules in clauses and briefs, the `rule.*` tools and the origin rule, and the `rule` event, and `nvim/README.md` lists the `rule` kind in the events view's palette filter.
