---
id: T-7
kind: question
title: "Topic model: lifecycle, statuses, ownership and the single agent context"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: T-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:52:04Z
updated: 2026-10-08T13:17:15.590Z
github:
  repo: Kealman/cland-v0
  number: 7
  url: https://github.com/Kealman/cland-v0/issues/7
---

## Question

What is a topic? Decide:

- Its lifecycle and statuses (for example open, waiting for human, waiting for agent, closed).
- Who may create topics (human, agent, system) and when an agent should open one.
- How a topic binds to a unit of work (task, epic, or none) and to roles.
- How topics coexist with a single agent context: topics are for the human's convenience, yet an agent must be able to read a topic's history and reply into it.
- What happens to a topic when the role it talks to moves to another session.

Produce glossary entries and, if the decision is hard to reverse, an ADR.

Context: BCAS used Discord threads per epic plus a `#drivers` console with `@`-addressing; asks with options were posted into the thread. See branch `research/bcas-hub`.

## Comments

### Kealman · 2026-10-07T16:50:57Z

<!-- github-comment: 6042632760 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human. This comment is the topic model; `GLOSSARY.md` (cacf3da) carries the terms.

**Structure**

- One flat list of topics per project; no channels or categories in v0. Sorted by activity; topics waiting for the human pin to the top. Categories, if ever, are filters, not entities.
- A topic has a title (required; agent-created topics must set one; the human may rename), a status, and at most one binding to a unit of work (task or epic). One unit of work has at most one topic, "the task's topic"; everything else goes to unbound topics.
- Two standing topics created by the system at project init, with reserved names: **General** (free conversation with the Coordinator, unbound) and **Agents** (read-only record of agent-to-agent messages and session and role lifecycle events: role changes, session start and stop, task claims; no tool-level noise; filterable by task and by session; replying there addresses the sender of the message replied to).

**Addressing**

- A human message in any topic addresses the Coordinator role by default. `@role` reaches the current holder of that role; `@session-name` reaches that session. Replies of a mentioned party land in the same topic. No `@all` and no groups in v0.
- Topics bind to roles, never to sessions: when a role moves, subsequent messages go to the new holder; what the new holder pulls in is decided in the role ticket #10.
- When no session holds the role, the hub queues the message (store-and-forward); the topic shows `waiting for agent` plus a "no coordinator" warning.

**Statuses**

- `open`, `waiting for human`, `waiting for agent`, `closed`.
- Set by direction automatically: a human message makes the topic `waiting for agent`; an agent reply makes it `open`. Explicit agent actions through the hub: `ask` makes it `waiting for human`; `resolve` clears the wait.
- Closed by the human explicitly, or by the system when the bound unit of work closes (open asks are then cancelled with a system note). A new message in a closed topic reopens it; that never reopens the unit of work.

**Creation**

- Human: any time. Agent: through a hub tool, with a title, when a question has no fitting topic (usually bound to its task). System: only General and Agents. No automatic topic per task: the task's topic appears on the first message about it.

**Asks**

- An Ask is a message kind: an agent's question to the human with options and room for a free answer. The answer is a message carrying `answer_to`. Several asks may be open in one topic; each is tracked. Asks go from agents to the human only; agent-to-agent questions are plain messages. The asking agent may withdraw its ask with `resolve`. No timeouts or escalation in v0; the attention model stays in the fog.

**Agents and the single context**

- An agent has no "current topic". Every delivery carries the topic id, title and binding; the agent replies with `send(topic, text)` and reads history with `history(topic, limit)` on demand; nothing is pushed. A message sent without a topic lands in General. Accepted scenario: the human writes in three topics within a minute, the Coordinator gets three deliveries and must answer each by id; the hub does not enforce it, the UI shows where an answer is missing.
- The human has an unread counter per topic (the weak signal); `waiting for human` is the strong signal. Agents have no unread concept.

**Messages**

- Markdown text; may reference artifacts by id (format decided in #9) and units of work. Rendering details stay in the fog.

**Not decided here:** the attention model and the "needs you" inbox; archiving and search. No ADR: the model is easy to change at this stage and would not surprise a reader.
