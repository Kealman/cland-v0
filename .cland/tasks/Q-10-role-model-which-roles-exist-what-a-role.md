---
id: Q-10
kind: question
title: "Role model: which roles exist, what a role carries, and how a role moves
  between sessions"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: M-1
blocked_by:
  - Q-3
topic: null
branch: null
created: 2026-10-07T14:52:15Z
updated: 2026-10-08T13:17:15.592Z
github:
  repo: Kealman/cland-v0
  number: 10
  url: https://github.com/Kealman/cland-v0/issues/10
---

## Question

Which roles exist in v0 (Coordinator, Reviewer, QA, Implementer, others?), what does a role carry (instructions, skills, permissions, default harness and model), and how does a role move between sessions mid-project?

The central question is continuity: when the Coordinator role moves from one session to another (for example from Claude Code on Fable to a cheaper model in OpenCode for a simple stretch), how are topic history, current tasks and unresolved decisions handed over?

Decide whether roles are exclusive, how the human assigns and revokes them, and what the hub enforces. Produce glossary entries and an ADR if the choice is hard to reverse.

Context: BCAS had driver / qa / reviewer / worker roles in JSON with a clause each, and an exclusive coordinator seat with manual handover (`/role set`). See branch `research/bcas-hub`.

## Comments

### Kealman · 2026-10-07T16:19:46Z

<!-- github-comment: 6042041053 -->

## Facts from research that bear on this decision

From `docs/research/harness-surfaces.md` (branch `research/harness-surfaces`) and `docs/research/bcas-hub.md` (branch `research/bcas-hub`):

- **Delivering a role's instructions differs per harness.** Claude Code reads `CLAUDE.md` (and `AGENTS.md` only when no `CLAUDE.md` exists); Codex reads `AGENTS.md` (and `CLAUDE.md` only via a fallback setting); OpenCode reads `AGENTS.md` only. Pinning Codex instructions with `-c developer_instructions` (the BCAS reviewer pin) drops the TUI into embedded mode with no external surface, so a role clause for Codex needs another path (app-server config at thread start, `AGENTS.md`, or a hub event).
- **Skills reach all three** through the same `SKILL.md` format but different directories (`.claude/skills`, `.agents/skills`, both for OpenCode); the symlink layout in this repo reaches all three.
- **Handover surfaces.** Claude Code: `--resume` and transcripts under `~/.claude/projects`; Codex: `thread/resume` on the app-server, `thread/inject_items` for an empty thread; OpenCode: sessions live on the service and are listed over its API. BCAS handed the coordinator seat over with a manual `/role set` plus a note; it kept role clauses as hub events because MCP instructions are fixed at connect.

### Kealman · 2026-10-07T17:04:14Z

<!-- github-comment: 6042750491 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human. `GLOSSARY.md` (1d821e4) carries the terms; ADR 0001, `docs/adr/0001-roles-are-hub-held-state.md`, records the architectural choice and the rejected options.

**Roles in v0.** Coordinator, Implementer, Reviewer, QA. Sessions without a role are allowed: they are the human's own terminals and do not connect to the hub. Research is not a role; the Coordinator's sub-agents do it. A session has at most one role. Coordinator is exclusive (one holder or vacant); the other roles may have many holders.

**What a role carries.** (a) A role clause (instruction text); (b) a skill list; (c) hub permissions the hub enforces; (d) launch defaults: harness, model, effort. Definitions live in project-level config that cland provisions with defaults and the human edits; the file layout is decided with the state layout and the process layer (#17).

**Launch defaults (initial values, editable at any time).** Coordinator = Claude Code, Fable, effort max. Implementer = OpenCode with a free model (to be picked), so that all three harnesses are exercised from day one. Reviewer = Codex, gpt-6.1-sol, high. QA = Codex, gpt-6-astra, high. A session may switch model mid-role where the harness allows; defaults apply only at launch; the hub shows the current model as reported by the adapter.

**Clause delivery.** Uniformly through the hub, as an event at assignment and on every reconnect. Harness-native instruction files (`CLAUDE.md`, `AGENTS.md`) carry only the generic "you are a cland session" part. No `-c developer_instructions` for Codex: it drops the TUI into embedded mode with no external surface.

**Hub permissions by role.**

- Coordinator: `send` to anyone; `ask` the human; create topics; claim tasks and assign tasks to others; request launching sessions with roles; hand over its own role; `resolve`.
- Implementer: `send` (to the Coordinator and to mentioned parties); create topics bound to its own task; claim its own task. No `ask`, no role operations.
- Reviewer and QA: `send` (verdicts as plain messages to the Coordinator), `history`, `who`. No claims, no `ask`, no topics.
- No role: not connected to the hub.

Everything else, such as closing topics, the human does through the UI. Implementer, Reviewer and QA ask the Coordinator with plain messages (visible in the Agents topic); only the Coordinator asks the human, through Ask.

**Assignment and handover.** The human assigns and revokes roles, in the UI or at launch. The Coordinator may request sessions with roles and may hand its own role to another session with a handover note. No other role assigns roles. The hub enforces Coordinator exclusivity. A dead session's role becomes vacant; no auto-reassignment; a vacant Coordinator shows a "no coordinator" warning. A session that reconnects under the same name gets its role and clause back. A holder whose role is revoked mid-work receives a "role revoked" event and must stop acting in that role.

**Context handover.** Role-bound state lives in the hub, not in the session. The next holder receives: (1) the clause; (2) the handover note, mandatory when the holder hands over and optional when the human reassigns, a Markdown template with four sections: goals now, work in flight, open decisions, waiting on; it is stored in the hub as part of the role's state, delivered as an event and recorded in the Agents topic; (3) on demand from the hub: topics `waiting for agent`, open asks, the role's task claims, topic history. The old session's transcript never moves. The old session lives on without a role, or as an Implementer.

**Identity.** A session has a name (`[a-z0-9-]`, chosen by the human or generated), shown everywhere with its role, for example `reviewer-1 [Reviewer]`. Roles move between names; names do not change.

**Not decided here.** Exact skill lists per role and how skills reach each harness (#17); the adapter and hub mechanics of event delivery (#12, #13); crew presets (fog).

### Kealman · 2026-10-08T08:15:02Z

<!-- github-comment: 6055699849 -->

## Addendum (2026-10-07): item operations and verdicts by role

Confirmed by the human while the v0 spec was being written, resolving a gap between #10, #8 and #14:

- **Verdicts.** Reviewer and QA sessions write their verdicts as structured comments on the item through the hub (`task.comment`, restricted to verdict comments), as #8 and the merge gate in #14 require. Their permission set is therefore `send`, `history`, `who` and verdict comments on items.
- **Item operations.** The Coordinator and the human create items (the Coordinator through `to-tickets`); the Coordinator edits and closes items; an Implementer may comment on and claim its own item; Reviewer and QA write only verdicts.
- **Review and QA in slice 1.** Both roles work for real from slice 1: the Coordinator sends a review or QA request through the hub to a Codex session holding the role, which writes the verdict on the item; `/codex:rescue` stays the fallback. Only the QA lane infrastructure (the Lua QA API, brief format, the `qa` skill, the hub's stdio transport) is slice 2.
