---
id: T-980
kind: task
title: The one-time link, the cookie and the human's socket
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-978
topic: topic-763
branch: t/T-980-the-one-time-link-the-cookie-and-the
created: 2026-10-20T16:49:59.904Z
updated: 2026-10-20T18:36:27.640Z
---

## Summary

`cland web` prints a one-time link that the browser trades at `/auth` for a cookie named per project, and `/ws` admits a client hello as the human behind the cookie, the Host check and the Origin check. The hub's secret never leaves the machine's own processes.

## What to build

`cland web` asks the running hub for a link over its Unix socket with a new client frame, `web.link`. It prints `http://127.0.0.1:<port>/auth?token=…` and opens it with `open` on macOS or `xdg-open` on Linux; `--no-open` only prints it. The token is 32 random bytes. The hub keeps only its SHA-256, accepts it for five minutes and spends it on first use. `/auth` trades the token for the cookie `cland_<key>`, where `<key>` is the first 12 hex digits of the SHA-256 of the project's canonical root (HttpOnly, SameSite=Strict, 30 days) and redirects to `/`. Cookies are not isolated by port, so the name is per project (Coordinator decision, 2026-10-20). A spent, expired or unknown token gets 401. A `/ws` upgrade needs the cookie, an allowed Host and an exact Origin; a `null` or foreign Origin is refused. On the socket only a client hello is accepted. It carries no secret, and the connection is the human's. A spoke hello is refused. A session's shell asking for `web.link` is refused, as the human's other frames are. For now the cookie sessions are held in memory; T-982 persists them.

## Acceptance criteria

- [ ] C1. `cland web --no-open` prints a link whose token is spent on first use and expires after five minutes, and the hub holds only the token's SHA-256 (test).
- [ ] C2. `/auth` with a valid token sets `cland_<key>` with HttpOnly, SameSite=Strict and a 30-day lifetime and redirects to `/`; a used, expired or unknown token answers 401 (test).
- [ ] C3. A `/ws` upgrade is refused before any frame without the cookie, with a foreign Host, with a foreign Origin, and with Origin `null` (test, one case each).
- [ ] C4. Over `/ws` with the cookie, a client hello without a secret is welcomed as the human and `hub.status` answers, while a spoke hello is refused and its socket closed (test).
- [ ] C5. `web.link` sent from a session's shell is refused (test).
- [ ] C6. A test scans the web edge's responses (the bundle files, `/auth` and every frame of a `/ws` conversation) and finds no trace of the hub's secret.
- [ ] C7. `hub/README.md` documents `cland web`, `web.link`, `/auth`, `/ws` and the checks.
