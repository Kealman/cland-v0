---
id: T-978
kind: task
title: The web edge serves the bundle on a stable port
state: open
status: review
size: S
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by: []
topic: topic-750
branch: t/T-978-the-web-edge-serves-the-bundle-on-a
created: 2026-10-20T16:49:53.985Z
updated: 2026-10-20T17:03:34.079Z
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

- [x] C1. A frame-seam test starts a scratch project's hub twice and reads the same web port in `hub.json` both times, and `[web] port` overrides the kept port.
  - done: impl-978 · 2026-10-20T17:01:32.963Z
- [x] C2. With the web port held by another listener, the hub still starts and serves its spokes, never listens on a different web port, logs the taken port, and `hub.status` and `cland doctor` report the web edge unavailable with that reason (test).
  - done: impl-978 · 2026-10-20T17:01:33.751Z
- [x] C3. `/` serves the bundle with a CSP holding `frame-ancestors 'none'`, plus `nosniff` and `no-referrer`; `index.html` is `no-cache` with an ETag and answers 304 to a matching `If-None-Match`; `/assets/*` is `immutable` (test).
  - done: impl-978 · 2026-10-20T17:01:34.597Z
- [x] C4. A path that escapes the bundle, plain or percent-encoded, is refused; a path without an extension returns `index.html`; a missing `web/dist/index.html` returns the plain page naming `npm run build --workspace web` (test).
  - done: impl-978 · 2026-10-20T17:01:35.302Z
- [x] C5. A request on the web port with a Host other than 127.0.0.1, localhost or [::1] is refused (test).
  - done: impl-978 · 2026-10-20T17:01:36.138Z
- [x] C6. The spokes' WebSocket edge, its port and its refusal of client hellos are unchanged, and the existing edge tests pass without edits.
  - done: impl-978 · 2026-10-20T17:01:37.002Z
- [x] C7. `hub/README.md` documents the web edge, its port, `[web] port`, `[web] dist` and the new `hub.json` field.
  - done: impl-978 · 2026-10-20T17:01:37.704Z
  - verified: rev-23 [reviewer] · run rev-20261020-978-source · 2026-10-20T17:03:34.079Z · commit 80de93faf829a16d17f3913bd7bf8555a41b95b7

## Comments

### impl-978 · 2026-10-20T17:00:31.030Z

Implemented independent static HTTP edge with stable .cland/web-port, discovery webPort and hub.status.web; occupied-port startup keeps spoke/Unix edges alive and doctor warns. Fixture HTTP/frame tests cover C1–C5; existing edges.test.ts (4 tests), edges-component.test.ts and targeted daemon/permissions client-hello cases pass unchanged locally on macOS arm64 (targeted evidence, not a suite receipt). Docs/help updated. Merged origin/dev before first review; final head checks in progress.

### rev-23 · 2026-10-20T17:03:34.079Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-978-source
commit: 80de93faf829a16d17f3913bd7bf8555a41b95b7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Independent loopback listener persists selected port, degrades occupied-port startup without drift or spoke loss, and reports discovery/status/doctor. Handler checks exact Host/port, decoded/canonical bundle confinement, strict headers/cache/ETag and fallback/missing behavior. Config/help/README/testing/ADR align; C7 verified. Six T2 HTTP/frame tests and T1 config targets reviewed; A-7732 local macOS summary receipts are supplemental, not suite/Linux or duration-gate passes. C1–C6 await mode-free exact-head gate; existing edge/native targeted proof remains separate. QA affected/after-stage, no per-item criteria; Reviewer ran no tests.

Criteria: C7 verified.
