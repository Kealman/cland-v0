---
id: T-1566
kind: task
title: The invite page with a password
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
  - T-1565
topic: null
branch: null
created: 2026-10-31T23:47:51.938Z
updated: 2026-10-31T23:47:56.351Z
---

## Summary

In users mode an invite link opens the invite page, where the user sets a password. The edge stores it as a scrypt hash, consumes the invite, marks the user active and sets a cookie bound to that user. Cookie issuance moves into one helper shared with `/auth`, so E-1538's `Secure` rule applies to every cookie. ADR 0003 gains an amendment for the users-mode admission paths.

Hot files: `hub/src/hub/web-edge.ts` [E-1538], `hub/src/hub/web-auth.ts` [E-1538], new `hub/src/hub/web-signin.ts` (HTTP handlers), new `hub/src/hub/passwords.ts`, `web/src/` new sign-in views (`SignIn.tsx`, `SignIn.module.css`, an entry route), `docs/adr/0003-*.md` (amendment).

## Acceptance criteria

- [ ] C1. Opening a valid invite shows the invite page with the user's name, and setting a password there signs the browser in as that user.
- [ ] C2. The password is stored only as a scrypt hash with a per-user salt, and travels only in an HTTP POST body to the edge, never in a WebSocket frame, a log line or the journal.
- [ ] C3. A used, expired or unknown invite shows a refusal page naming which, and sets no cookie.
- [ ] C4. The invite and registration endpoints check Host and exact Origin as `/upload` does, and refuse a foreign Origin with 403.
- [ ] C5. Every cookie the edge sets, from `/auth` and from the invite, comes from one helper with the existing flags.
- [ ] C6. In single mode the invite paths answer 404 and the link flow is unchanged.
- [ ] C7. ADR 0003 has an amendment describing users-mode admission: invites, password and passkey sign-in, cookies bound to users.
