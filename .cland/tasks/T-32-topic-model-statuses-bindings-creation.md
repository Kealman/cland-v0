---
id: T-32
kind: task
title: "Topic model: statuses, bindings, creation and mentions"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-25
  - T-29
topic: null
branch: null
created: 2026-10-08T11:54:41Z
updated: 2026-10-08T13:17:15.604Z
github:
  repo: Kealman/cland-v0
  number: 32
  url: https://github.com/Kealman/cland-v0/issues/32
---

## Parent

Part of #19. Spec section 4.5; decision https://github.com/Kealman/cland-v0/issues/7. Design: topics panel in `docs/design/main-screen/Watch.dc.html` and the topics kind of the picker in `Pickers.dc.html`; prototype `prototype/workbench`.

## What to build

The full topic model on top of General: a topic has a title, a status (`open`, `waiting for human`, `waiting for agent`, `closed`) set by message direction and by the explicit `resolve` action (ask arrives with the next ticket), and at most one binding to a unit of work (an item id; at most one topic per unit of work). The human creates topics from the UI; an agent creates one through `topic.create` with a title and an optional binding; the system creates only General and Agents. A human message addresses the Coordinator by default; `@role` reaches the current holder of the role and `@session-name` a session; replies of a mentioned party land in the same topic. When no session holds the addressed role, the message is queued (store-and-forward) and the topic shows `waiting for agent` with the "no coordinator" warning. Closing is explicit by the human; a new message reopens a closed topic. Unread counts per topic for the human. The topics panel groups needs you / open / closed with unread badges and pins the topics waiting for the human; the topics kind of the picker lists the same, needs-you first; `<Space>T` docks the panel above the right panel.

## Acceptance criteria

- [ ] Status follows direction: a human message sets `waiting for agent`, an agent reply sets `open`; `resolve` clears a wait
- [ ] `@reviewer` in a message reaches the session holding Reviewer and its reply appears in the same topic; `@name` reaches that session
- [ ] A message to a vacant Coordinator is queued and delivered when a Coordinator is assigned; the topic shows the warning meanwhile
- [ ] An agent-created topic requires a title; a second topic for the same unit of work is refused
- [ ] The topics panel and picker show statuses, unread counts and pinning as in the design; headless tests assert the screen
