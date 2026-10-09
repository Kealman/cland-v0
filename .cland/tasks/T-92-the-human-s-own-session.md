---
id: T-92
kind: question
title: The human's own session
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:45.337Z
updated: 2026-10-09T19:37:21.264Z
---

## Question

What is the human's own session: a session the human spawns in one key to think and plan with an agent, loosely bound to the hub, able to act on the project without becoming part of the crew?

## Context

The human has no session of their own: they act as "human" through the UI or CLI, type into attached TUIs, and in v0 worked through a stand-in Claude session outside cland, answering asks by CLI. Launching a session today (`␣l`) asks for a role and launches a crew session that the hub addresses like any other. The human wants: quick to spawn; no broadcast spam; able to send to the hub and get replies; able to create and change items, artifacts and files; a place to plan, think and prepare prompts during the working day.

## To decide

- Its place in the model: a non-exclusive role (an aide) that role broadcasts never address, or a session whose principal is the human; the domain-modeling test is that it never becomes a second Coordinator.
- What it receives: replies to its own messages only; whether asks ever reach it; what it sees of topics and history on request.
- How its messages appear to others: from the session, on the human's behalf, or as the human.
- Its tools and permissions (task, artifact, send, history, no launch or merge); its launch key, default harness and model; whether it shows in the sessions panel and the top bar; whether it may hold items.
- GLOSSARY entry and the role clause it gets.

Record the resolution as a comment, the spec section and the GLOSSARY entry.

## Comments

### human · 2026-10-09T19:37:17.344Z

Resolution (2026-10-09, the human accepted every point, with one amendment on the Aide's voice).

- A non-exclusive role, Aide: a session that works for the human alone; several allowed; never reached by role broadcasts or `all`, addressed by name only; never a Coordinator (no launch, stop, resume, merge, handover, resolve or ask).
- Tools: the tracker in full, artifacts, `send` to any session by name and to topics, `topic.create`, `history`, `who`, `status`. A claim is allowed when the human tells it to take an item; it then works like an Implementer in the item's worktree.
- Its voice is the human's, decisions included: the human puts an Aide into context deliberately so that it can decide on their behalf (the human's amendment to the proposal, which had limited this to routine requests). Approvals in a harness TUI and asks in the inbox stay with the human.
- It receives only deliveries addressed to it by name and its role clause; no broadcasts, Agents notices or asks; it reads topics on request.
- Launched by one palette action and a key (the panels prototype picks it) with the defaults of `[roles.aide]` in roles.toml, cwd the project root, an optional brief; shown in a "yours" group at the top of the sessions panel; no cap.
- GLOSSARY: Aide. No ADR.

Recorded in docs/spec/v0.1.md §3.3 and GLOSSARY.md.

### human · 2026-10-09T19:37:21.264Z

Resolved: see the resolution comment; spec v0.1 §3.3
