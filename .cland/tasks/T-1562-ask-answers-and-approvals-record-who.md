---
id: T-1562
kind: task
title: Ask answers and approvals record who answered
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
topic: topic-1307
branch: t/T-1562-ask-answers-and-approvals-record-who
created: 2026-10-31T23:47:50.788Z
updated: 2026-11-01T19:54:17.131Z
---

## Summary

In users mode an ask's and an approval's outcome records the answering user's id, with `by` set to that user's name. The first answer still wins, and the journal's `ask-answered` and `inbox-departure` records carry the user id. Both workbenches show the name wherever they show `by` today.

Hot files: `hub/src/hub/asks.ts`, `hub/src/hub/inbox.ts` [Host] (approval outcome), `hub/src/hub/dispatch.ts` [Host] (`topic.answer`, `approval.answer`), `hub/src/protocol.ts` [Host] (`AskOutcome`, `ApprovalOutcome` gain `userId`), `web/src/ApprovalCard.tsx`, `nvim/lua/cland/inbox.lua`.

## Acceptance criteria

- [ ] C1. An ask answered by a user in users mode has an outcome whose `by` is that user's name and whose `userId` is that user's id.
- [ ] C2. An approval answered by a user has an outcome whose `by` and `userId` name that user.
- [ ] C3. When two users answer one ask, the first answer wins and the second is refused with a message naming the first answerer.
- [ ] C4. The journal's `ask-answered` and `inbox-departure` records carry the answering user's id.
- [ ] C5. The web approval card and Neovim's inbox show the answering user's name in users mode, and "the human" in single mode as today.
- [ ] C6. Single-mode outcomes, including stand-in attribution, are unchanged.
