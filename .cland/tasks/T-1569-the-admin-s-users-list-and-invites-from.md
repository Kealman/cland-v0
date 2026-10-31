---
id: T-1569
kind: task
title: The admin's users list and invites from the web
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
  - T-1565
topic: null
branch: null
created: 2026-10-31T23:47:52.767Z
updated: 2026-10-31T23:47:57.862Z
---

## Summary

In users mode the web's accounts area lists the users (name, display name, role, state) with a count. An admin creates a user there and gets the one-time invite link to copy. Single mode shows no users list.

Hot files: `hub/src/hub/web-authority.ts` [Host] (`user.add`, `user.list` open on the web in users mode), new `web/src/accounts/Users.tsx` and `Users.module.css`, `web/src/accounts/AccountsArea.tsx`.

## Acceptance criteria

- [ ] C1. In users mode the accounts area lists every user with name, display name, role and state, and its fold shows the count.
- [ ] C2. Creating a user from the web adds an invited admin row and shows its invite link once, with the same name rules and refusals as the CLI.
- [ ] C3. In single mode the users list is absent and `user.add` and `user.list` from the web are refused with a message naming users mode.
- [ ] C4. The view passes the web typecheck's colour and contrast checks and adds no key listener outside `keymap.ts`.
