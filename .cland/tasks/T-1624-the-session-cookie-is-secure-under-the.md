---
id: T-1624
kind: task
title: The session cookie is Secure under the configured origin
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1566
topic: null
branch: null
created: 2026-11-02T03:34:18.412Z
updated: 2026-11-02T03:34:18.412Z
---

## Summary

The single cookie helper marks every session cookie `Secure` whenever `[web] origin` is set (always `https`) and the request's Host equals the origin's host, also on a top-level GET that carries no `Origin` header. The Host and exact-Origin admission checks stay as ADR 0003 describes, and forwarded headers are never trusted. ADR 0003 records the wider condition.

Hot files: the T-1566 cookie helper (`hub/src/hub/web-edge.ts` or `web-signin.ts`) [E-1536], `hub/test/web-auth.test.ts` (one assertion), new `hub/test/web-cookie-secure.test.ts`, `docs/adr/0003-*.md` [E-1532, E-1536 also amend]

## Acceptance criteria

- [ ] C1. With `[web] origin` set and the request's Host equal to the origin's host, `/auth` sets the session cookie with `Secure` on a GET without an `Origin` header (test).
- [ ] C2. With no `[web] origin`, or with a loopback, LAN or other Host, no cookie the edge sets carries `Secure` (test).
- [ ] C3. `X-Forwarded-Host`, `X-Forwarded-Proto` and `Forwarded` never make a cookie `Secure` (test).
- [ ] C4. The rule lives only in the single cookie helper, so the invite cookie (and the sign-in cookie, once T-1567 lands) follow it (test).
- [ ] C5. Admission checks for WebSocket upgrades, `/upload` and the invite endpoints are unchanged, and in `web-auth.test.ts` only the Host-only no-Secure assertion changes (test).
- [ ] C6. ADR 0003 gains a dated amendment replacing the 2026-10-21 sentence that a top-level GET without Origin does not meet the Secure condition.

## Notes

Shared files: see Hot files
