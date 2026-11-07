---
id: T-1754
kind: task
title: Waiting launches in the Neovim and web inboxes
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1744
topic: null
branch: null
created: 2026-11-07T16:02:00.048Z
updated: 2026-11-07T16:02:07.767Z
---

## Summary

Both inboxes render each waiting launch from the inbox frame as one status line: the session with its role, the pool, the reason and the time it began. A reason change updates the line in place, and a placement or cancel removes it. The lines are not asks and do not count toward needs-you.

## What to build

Rendering only; the frame shape is T-1744's. In the web, colours come from `tokens.css` tokens, with secondary text at 4.5:1, and no key binding is added. The Hosts row and session rows that name their host belong to E-1537 (Workbenches, doctor, setup and docs for hosts).

## Acceptance criteria

- [ ] C1. Neovim's inbox shows each waiting launch as one line with session, role, pool, reason and since, and a reason change replaces the line in place (test).
- [ ] C2. The web inbox shows the same line and updates it in place, and the typecheck's colour and contrast checks pass (test).
- [ ] C3. Neither inbox counts a waiting launch toward needs-you, and both drop the line when the launch is placed or cancelled (test).

## Blocked by

- T-1744

## Notes

- Hot files: `nvim/lua/cland/inbox.lua`, `web/src/InboxArea.tsx`, `web/src/InboxArea.module.css`.
- Tests: `nvim/test/inbox*.test.ts` (Neovim T2, edit); `web/src` inbox tests (web, edit).
- Serves epic C3.
