---
id: T-1584
kind: task
title: Users-mode withdrawal checks message ownership by user id
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1561
  - T-1570
topic: null
branch: null
created: 2026-11-01T19:56:29.775Z
updated: 2026-11-01T19:56:29.775Z
---

## Summary

In users mode, a person may withdraw only the ordinary messages they wrote themselves. The check compares the message's persisted user id with the trusted caller's user id, never the display author name. Single mode keeps today's `from = human` fence.

## What to build

Withdrawal of an ordinary human message in users mode checks ownership through the attribution T-1561 persists. Core's withdrawal-reason check and the web message block's withdraw affordance both use the persisted user id against the signed-in caller. Another user's message offers no withdraw action and a crafted withdrawal is refused with a reason naming ownership. Messages written before attribution (no user id) stay withdrawable only by the admin, as in single mode.

Found by impl-1561 while building T-1561 (topic-1306, 2026-11-01 19:56Z); T-1561 keeps the existing fence and grants no cross-user authority.

## Acceptance criteria

- [ ] C1. In users mode, the author of an ordinary human message can withdraw it; the hub checks the persisted user id against the trusted caller's user id.
- [ ] C2. In users mode, another user's withdrawal of that message is refused by the hub with a reason naming ownership, and the message stays unchanged.
- [ ] C3. The web message block offers the withdraw action only on the viewer's own messages in users mode; single mode is unchanged.
- [ ] C4. A message without a persisted user id (written before attribution) is withdrawable only by the admin in users mode.
- [ ] C5. No ownership decision reads the display author name; a test where two users share a display name proves it.
