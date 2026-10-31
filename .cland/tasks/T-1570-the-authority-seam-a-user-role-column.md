---
id: T-1570
kind: task
title: "The authority seam: a user-role column"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
topic: null
branch: null
created: 2026-10-31T23:47:52.978Z
updated: 2026-10-31T23:47:58.072Z
---

## Summary

The web authority table gains a user-role column, and every web request in users mode is checked against the acting user's role, read from the users table at check time through one function. Rows keep their current shape, with plain rows open to `admin` by default, so frames the Host lane adds need no change. A test-only role with one request removed is refused that request, and the refusal names the role. No second role ships.

Hot files: `hub/src/hub/web-authority.ts` [Host: every lane adds rows here], `hub/src/hub/dispatch.ts` [Host] (one call site), `hub/src/hub/users.ts`.

## Acceptance criteria

- [ ] C1. Each request type's web rule and its per-role permission are read from one table, and plain rows written as today are open to `admin` with no edit.
- [ ] C2. In users mode every web request passes the role check, which reads the user's role from the users table at the time of the request.
- [ ] C3. A test-only role whose column omits one request is refused that request with a result naming the role and the request.
- [ ] C4. The `roles` table and the authority table ship with `admin` as their only role.
- [ ] C5. In single mode the web authority checks and their refusals are unchanged.
