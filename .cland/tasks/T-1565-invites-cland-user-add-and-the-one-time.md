---
id: T-1565
kind: task
title: "Invites: `cland user add` and the one-time invite link"
state: open
status: backlog
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1558
topic: null
branch: null
created: 2026-10-31T23:47:51.739Z
updated: 2026-10-31T23:52:16.282Z
---

## Summary

`cland user add <name> [--display <name>]` creates an admin user in state `invited` and prints a one-time invite link valid for 24 hours. `cland user invite <name>` mints a fresh link for an existing user (assumed, A16), and the switch to users mode prints one for the first user. Invites are stored as digests only, and a used or expired invite is refused when it is checked.

Hot files: new `hub/src/hub/invites.ts` (or within `users.ts`), `hub/src/hub/dispatch.ts` [Host], `hub/src/protocol.ts` [Host], `hub/src/hub/web-authority.ts` [Host], `hub/src/cli/user.ts`.

## Acceptance criteria

- [ ] C1. `cland user add <name>` creates a user with role `admin` and state `invited` and prints an invite URL on the web edge's address.
- [ ] C2. Names are lowercase slugs, unique, and never `human`, `hub`, `all`, a role name or a current session name, and each refusal names the rule.
- [ ] C3. The invite token is stored only as a SHA-256 digest with its expiry, and appears in no log line, frame other than the minting result, or journal record.
- [ ] C4. The invite check accepts an invite once within 24 hours (by the hub clock), and refuses a used, an expired or an unknown token with distinct reasons.
- [ ] C5. `cland user invite <name>` replaces any open invite of that user, and the switch to users mode prints the first user's invite.
- [ ] C6. `cland auth reset` revokes every open invite through T-1558's reset step, proven by a test that resets with an open invite and then refuses its token.
