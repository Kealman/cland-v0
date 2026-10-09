---
id: T-90
kind: question
title: Crew configuration and session reuse
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: T-81
blocked_by:
  - T-89
  - T-83
topic: null
branch: null
created: 2026-10-09T19:09:43.529Z
updated: 2026-10-09T20:19:02.215Z
---

## Question

What is the crew configuration: how a project declares which sessions exist per role, whether they are per item or a shared pool, how long they keep context, how many a machine can carry, and who edits it?

## Context

Roles are hard-coded (coordinator, implementer, reviewer, qa) with launch defaults in `.cland/roles.toml`; sessions are launched ad hoc; practice in v0 was per-item Implementers in worktrees and shared long-lived Reviewers and QA. The human wants defaults such as one QA per machine (tests and browsers load it), two reviewers that keep context, implementers per item; or implementers that take a group of items together; or a session that manages its own in-harness sub-agents over several items (the research "What the harnesses offer for teams and sub-agents" says what is feasible). The configuration must be visible in the UI but is edited mostly by agents: the human discusses it with the Coordinator, the agent edits the file. The session hierarchy decision names the levels this configuration populates.

## To decide

- The shape and home: `roles.toml` extended or a crew file; per role the policy (per item, pool of N, singleton per machine), context retention, harness, model, effort, caps.
- Who edits it: a hub tool for the Coordinator, the human by file or from the UI; how a change applies to running sessions.
- How the Coordinator applies it (launch, reuse, grouping) and how a group of items is expressed (handed to the epic plan ticket).
- The boundary between hub hierarchy and in-harness delegation.
- GLOSSARY: Crew, Pool, Group.

Record the resolution as a comment, the spec section and the GLOSSARY entries; a stub crew file on the canvas or in the comment if it reads better than prose.

## Comments

### human · 2026-10-09T20:18:51.013Z

Resolution (2026-10-09, the human accepted every point).

- Home: a committed `.cland/crew.toml` holding the staffing policy only; `roles.toml` keeps what a role is and its launch defaults.
- Shape: `leads = [...]` for the levels with dedicated Leads (empty = flat); per role `policy` per-item | per-group | pool | singleton, `size`, `keep_context`, `stop_after` (merge | never), `subagents` (in-harness delegation allowed, enforced by the clause, cost counted to the session). Harness and model stay in roles.toml.
- Enforcement by the hub at launch: refuses beyond size or a second singleton; a pool role with keep_context hands out an idle member instead of a new session; per-item sessions stop as stop_after says; within those bounds the Coordinator or a Lead decides.
- Editing: the Coordinator, Leads and Aides edit the file directly; the hub reloads on change and refuses a broken file with a notice (last good version stays); CLI `cland crew show | set`; the sessions panel header shows a one-line summary; no editing UI.
- Defaults from cland init: flat; implementer per-item stopping after merge; reviewer pool of 1 with context kept; qa singleton; aide unlimited; subagents for the Coordinator and Leads only.
- GLOSSARY: Crew, Pool. No ADR.

Recorded in docs/spec/v0.1.md §3.8 and GLOSSARY.md.

### human · 2026-10-09T20:19:02.215Z

Resolved: see the resolution comment; spec v0.1 §3.8
