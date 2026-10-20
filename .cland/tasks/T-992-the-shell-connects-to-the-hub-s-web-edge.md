---
id: T-992
kind: task
title: The shell connects to the hub's web edge
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-991
  - T-979
topic: null
branch: null
created: 2026-10-20T16:51:40.575Z
updated: 2026-10-20T16:51:40.575Z
---

## Summary

The shell connects to the hub's web edge: `cland web` opens it, its connection module shows the project and the hub's live dot and reconnects with backoff, and it imports its wire types from E-412's leaf module. This ticket also carries E-412's browser proof of the auth redirect, the cookie's flags and the served bundle. It replaces the development bridge of the 2026-10-14 prototype, which is not built (Coordinator proposal, approved with the plan).

## What to build

- **The connection.** The shell connects to `/ws` on the edge with a client hello. It shows the project's name and the live dot, turns the dot down when the hub goes away, and reconnects with backoff.
- **The wire types.** The shell imports them from E-412's leaf module (`shared/wire/`); there is no stand-in `web/src/wire.ts`.
- **Browser proofs.** A browser test proves the auth redirect, the cookie's HttpOnly and SameSite=Strict flags and the bundle served by the edge, and scans the bundle, the browser's storage and the edge's responses for the hub's secret.
- **Docs.** `web/README.md` names `cland web` as the entry.

## Acceptance criteria

- [ ] C1. A browser test opens the link that `cland web --no-open` prints, follows the redirect to `/`, and the shell connects to `/ws` on the edge and shows the project's name and the live dot.
- [ ] C2. The same test reads the cookie `cland_<key>` with HttpOnly and SameSite=Strict, and the served bundle's CSP header.
- [ ] C3. The live dot turns down when the scratch hub stops and live again after it restarts, through reconnect with backoff (browser test).
- [ ] C4. The shell imports its wire types from E-412's leaf module, no `web/src/wire.ts` exists, and the typecheck is green.
- [ ] C5. A browser test scans the bundle, `localStorage`, the cookies' values and the edge's responses and finds no trace of the hub's secret.
- [ ] C6. `web/README.md` describes `cland web` as the entry.
