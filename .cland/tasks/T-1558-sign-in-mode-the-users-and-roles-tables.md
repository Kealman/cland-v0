---
id: T-1558
kind: task
title: Sign-in mode, the users and roles tables, the switch and the reset
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by: []
topic: null
branch: null
created: 2026-10-31T23:47:49.735Z
updated: 2026-10-31T23:48:16.061Z
---

## Summary

A project gains `[auth] mode = "single" | "users"` (default `single`, written by `cland init` and added by `cland update`) and the `users` and `roles` tables in `hub.db`. `cland auth mode users` switches the project and creates the first user, an admin named from git's `user.name`, and `cland auth reset` is the only way back to single. Single mode behaves exactly as today.

Hot files: `hub/src/init/config.ts` [Host], `hub/src/init/config-set.ts` [Host], `hub/src/hub/store.ts` [Host] (or a new `hub/src/hub/users.ts` on Store's handle), `hub/src/protocol.ts` [Host], `hub/src/hub/dispatch.ts` [Host], `hub/src/hub/web-authority.ts` [Host], `hub/bin/cland.ts` [Host]; new `hub/src/cli/auth.ts`, `hub/src/cli/user.ts`, `hub/src/cli/usage/*`.

## Acceptance criteria

- [ ] C1. `cland init` writes `[auth] mode = "single"`, `cland update` adds the table to an older managed config with its other values kept, and a mode other than `single` or `users` is refused at parse.
- [ ] C2. `hub.db` holds a `users` table (id, name, display name, role, state, created) and a `roles` table whose only row is `admin`.
- [ ] C3. `cland auth mode users` sets users mode and creates one admin user whose display name is git's `user.name` and whose name is its lowercase slug.
- [ ] C4. Repeating the switch, or restarting or reloading the hub in users mode, never creates a second first user.
- [ ] C5. `cland config set auth.mode` with any value is refused with a message naming `cland auth`.
- [ ] C6. `cland auth reset` returns the project to single mode, keeps the users rows for attribution, and revokes every web session and open invite.
- [ ] C7. `cland user list` prints each user's name, display name, role and state, and in single mode `cland user` commands are refused with a message naming `cland auth mode users`.
- [ ] C8. The new frames are CLI-only in the web authority table and absent from the gateway's, and the existing web, CLI and remote tests pass unchanged in single mode.
