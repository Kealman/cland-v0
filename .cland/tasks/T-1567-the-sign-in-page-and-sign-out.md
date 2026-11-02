---
id: T-1567
kind: task
title: The sign-in page and sign-out
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1566
topic: null
branch: null
created: 2026-10-31T23:47:52.250Z
updated: 2026-11-02T05:28:35.351Z
---

## Summary

In users mode a browser without a valid cookie gets the sign-in page instead of the disconnected strip, and signs in with name and password. Signing out from Profile revokes that browser's session and closes its sockets. Single mode keeps today's page and link flow.

Hot files: `hub/src/hub/web-signin.ts`, `hub/src/hub/web-edge.ts` [E-1538], `web/src/SignIn.tsx`, `web/src/accounts/Profile.tsx`, `web/src/connection.ts`.

## Acceptance criteria

- [ ] C1. In users mode a page load without a valid cookie shows the sign-in page, and a correct name and password sign the browser in as that user.
- [ ] C2. A wrong password or an unknown or invited-only name is refused with one message that does not say which was wrong.
- [ ] C3. Sign out in Profile revokes that browser's web session, closes its sockets and returns to the sign-in page, and other browsers stay signed in.
- [ ] C4. In single mode a page without a cookie behaves as today, with the existing connection and phone-disconnected tests unchanged.
- [ ] C5. The pages pass the web typecheck's colour and contrast checks and add no key listener outside `keymap.ts`.
