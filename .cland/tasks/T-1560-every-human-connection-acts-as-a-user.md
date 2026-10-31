---
id: T-1560
kind: task
title: Every human connection acts as a user
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1558
topic: null
branch: null
created: 2026-10-31T23:47:50.232Z
updated: 2026-10-31T23:48:16.217Z
---

## Summary

In users mode each human conversation carries a user. A web socket takes the user its cookie maps to. The CLI and Neovim, local trust through the hub socket, act as the first user. `cland web` mints a one-time link bound to the acting user (assumed, A4). The audit record of every human request names that user's id. Single mode keeps `human` and today's link flow.

Hot files: `hub/src/hub/dispatch.ts` [Host], `hub/src/hub/web-auth.ts` [E-1538], `hub/src/hub/web-edge.ts` [E-1538], `hub/src/hub/store.ts` [Host] (`web_sessions.user_id` in `ADDED_COLUMNS`), `hub/src/hub/audit.ts`, `hub/src/protocol.ts` [Host], `hub/src/cli/web.ts`, `web/src/accounts/Profile.tsx`. **Not** `hub/src/hub/socket.ts`.

## Acceptance criteria

- [ ] C1. A web session row records the user its sign-in was for, and a web conversation opened with that cookie acts as that user.
- [ ] C2. In users mode `cland web` mints a one-time link bound to the CLI's acting user, and redeeming it yields a cookie for that user; in single mode the link flow and cookie are unchanged.
- [ ] C3. CLI and Neovim conversations in users mode act as the first user.
- [ ] C4. `web.session` returns the signed-in user's name, display name and role in users mode and no user in single mode, and the web Profile shows the user's display name.
- [ ] C5. Every audit record of a human request carries the acting user's id in users mode and none in single mode.
- [ ] C6. A web request carrying `as` is still refused, and the user of a web conversation never comes from the frame.
- [ ] C7. The change touches nothing under `hub/src/adapters/`, `hub/src/spoke/` or `hub/src/hub/socket.ts`.
