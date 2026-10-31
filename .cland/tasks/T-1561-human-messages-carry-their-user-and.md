---
id: T-1561
kind: task
title: Human messages carry their user, and deliveries name the author
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
topic: null
branch: null
created: 2026-10-31T23:47:50.605Z
updated: 2026-10-31T23:47:54.539Z
---

## Summary

In users mode a human message stores its user's id, and its `from` is the user's name, with `fromKind` still `human`. A delivery to an agent therefore reads `from="<user>" from_kind="human"` through the existing envelope. Human messages written before the switch read as the first user's, and the journal's `human-send` names the user's id.

Hot files: `hub/src/hub/core.ts` [Host] (human send, delivery projection), `hub/src/hub/store.ts` [Host] (`messages.user_id`), `hub/src/hub/dispatch.ts` [Host], `hub/src/hub/journal.ts`, `hub/src/protocol.ts` [Host]. **Not** `hub/src/adapters/` or `hub/src/spoke/`.

## Acceptance criteria

- [ ] C1. A message a user writes in users mode is stored with that user's id and read back with `from` set to the user's name and `fromKind` `human`.
- [ ] C2. A delivery of that message to an agent session carries the user's name in `from`, through the unchanged envelope and spoke code.
- [ ] C3. Two users writing in General produce messages with two different authors in `topic.history` and in the Coordinator's deliveries.
- [ ] C4. After the switch, human messages written in single mode read as the first user's in `topic.history`.
- [ ] C5. The journal's `human-send` record carries the author's user id in users mode, and never the text.
- [ ] C6. Single-mode messages keep `from` `human` and no user id, with every existing message and delivery test unchanged.
