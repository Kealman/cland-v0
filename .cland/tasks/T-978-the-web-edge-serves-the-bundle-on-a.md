---
id: T-978
kind: task
title: The web edge serves the bundle on a stable port
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by: []
topic: null
branch: null
created: 2026-10-20T16:49:53.985Z
updated: 2026-10-20T16:50:14.672Z
---

## Summary

The hub opens a second listener of its own, the web edge, on a stable loopback port that `hub.json` records. It serves the built web bundle with the static headers. The spokes' edge stays exactly as it is.

## What to build

When the hub starts, it also listens on its web port. The port is `[web] port` when that is set. Otherwise the hub picks a free port at its first start and keeps it in a volatile file under `.cland/`, so the same port comes back after every restart. `hub.json` records the port at every start. When the port is taken, the hub never drifts to another port, because the origin carries the browser's cookie, storage and notification permission. It starts without its web edge instead, so the crew keeps working: the log names the port, `hub.status` reports the web edge as unavailable with the reason, and `cland doctor` warns about it (Coordinator decision, 2026-10-20). `/` serves `web/dist/index.html`, or the bundle named by the development setting `[web] dist`, which is how the prototype's shell is served first for dogfooding:
- `index.html`, the manifest, the service worker and the icons are `no-cache` with an ETag; `/assets/*` is `immutable`.
- Every response carries a strict CSP with `frame-ancestors 'none'`, `nosniff` and `no-referrer`.
- Paths are confined to the bundle, and a path without an extension falls back to `index.html`.
- When `web/dist/index.html` is missing, a plain page names `npm run build --workspace web`.

The Host header must be `127.0.0.1`, `localhost` or `[::1]` with the web port. Links only ever print `127.0.0.1`.

## Acceptance criteria

- [ ] C1. A frame-seam test starts a scratch project's hub twice and reads the same web port in `hub.json` both times, and `[web] port` overrides the kept port.
- [ ] C2. With the web port held by another listener, the hub still starts and serves its spokes, never listens on a different web port, logs the taken port, and `hub.status` and `cland doctor` report the web edge unavailable with that reason (test).
- [ ] C3. `/` serves the bundle with a CSP holding `frame-ancestors 'none'`, plus `nosniff` and `no-referrer`; `index.html` is `no-cache` with an ETag and answers 304 to a matching `If-None-Match`; `/assets/*` is `immutable` (test).
- [ ] C4. A path that escapes the bundle, plain or percent-encoded, is refused; a path without an extension returns `index.html`; a missing `web/dist/index.html` returns the plain page naming `npm run build --workspace web` (test).
- [ ] C5. A request on the web port with a Host other than 127.0.0.1, localhost or [::1] is refused (test).
- [ ] C6. The spokes' WebSocket edge, its port and its refusal of client hellos are unchanged, and the existing edge tests pass without edits.
- [ ] C7. `hub/README.md` documents the web edge, its port, `[web] port`, `[web] dist` and the new `hub.json` field.
