---
id: T-1344
kind: task
title: "The Telegram mirror in: the human's text, decision and question kinds, replies to topics, and the delivery reactions"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: null
branch: null
created: 2026-10-26T19:09:06.927Z
updated: 2026-10-26T19:09:14.980Z
---

## Summary

The human's Telegram text reaches General as their message to the Coordinator with `via = "telegram"`. `/decision` and `/question` send the other kinds, a reply goes to its message's topic, formatting is dropped, and 👌 then 👀 confirm delivery.

## What to build

Inbound mapping through the gateway as the human (T-1321) with `via` (T-1322). Mentions resolve as in the workbench, and `@aide` is no mention. A reply to a mirrored message routes through T-1323's chat-message map to its topic. React 👌 once General has the message and 👀 once the addressee's session has it. Spec §3.4.

## Acceptance criteria

- [ ] C1. Free text, `/decision`, `/question` and a message with bold text reach General as the human's messages of the right kind with `via = "telegram"` and the formatting dropped (test).
- [ ] C2. A reply to an agent's mirrored message lands in that message's topic, and the fake sees 👌 then 👀 in that order (test).
