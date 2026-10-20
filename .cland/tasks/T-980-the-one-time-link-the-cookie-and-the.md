---
id: T-980
kind: task
title: The one-time link, the cookie and the human's socket
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-978
topic: topic-763
branch: t/T-980-the-one-time-link-the-cookie-and-the
created: 2026-10-20T16:49:59.904Z
updated: 2026-10-20T19:11:12.688Z
closed: 2026-10-20T19:11:12.688Z
---

## Summary

`cland web` prints a one-time link that the browser trades at `/auth` for a cookie named per project, and `/ws` admits a client hello as the human behind the cookie, the Host check and the Origin check. The hub's secret never leaves the machine's own processes.

## What to build

`cland web` asks the running hub for a link over its Unix socket with a new client frame, `web.link`. It prints `http://127.0.0.1:<port>/auth?token=…` and opens it with `open` on macOS or `xdg-open` on Linux; `--no-open` only prints it. The token is 32 random bytes. The hub keeps only its SHA-256, accepts it for five minutes and spends it on first use. `/auth` trades the token for the cookie `cland_<key>`, where `<key>` is the first 12 hex digits of the SHA-256 of the project's canonical root (HttpOnly, SameSite=Strict, 30 days) and redirects to `/`. Cookies are not isolated by port, so the name is per project (Coordinator decision, 2026-10-20). A spent, expired or unknown token gets 401. A `/ws` upgrade needs the cookie, an allowed Host and an exact Origin; a `null` or foreign Origin is refused. On the socket only a client hello is accepted. It carries no secret, and the connection is the human's. A spoke hello is refused. A session's shell asking for `web.link` is refused, as the human's other frames are. For now the cookie sessions are held in memory; T-982 persists them.

## Acceptance criteria

- [x] C1. `cland web --no-open` prints a link whose token is spent on first use and expires after five minutes, and the hub holds only the token's SHA-256 (test).
  - done: impl-980 · 2026-10-20T18:44:13.845Z
  - verified: rev-31 [reviewer] · run rev-20261020-980-final · 2026-10-20T18:56:12.289Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c
- [x] C2. `/auth` with a valid token sets `cland_<key>` with HttpOnly, SameSite=Strict and a 30-day lifetime and redirects to `/`; a used, expired or unknown token answers 401 (test).
  - done: impl-980 · 2026-10-20T18:44:15.330Z
  - verified: rev-31 [reviewer] · run rev-20261020-980-final · 2026-10-20T18:56:12.289Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c
- [x] C3. A `/ws` upgrade is refused before any frame without the cookie, with a foreign Host, with a foreign Origin, and with Origin `null` (test, one case each).
  - done: impl-980 · 2026-10-20T18:44:16.108Z
  - verified: rev-31 [reviewer] · run rev-20261020-980-final · 2026-10-20T18:56:12.289Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c
- [x] C4. Over `/ws` with the cookie, a client hello without a secret is welcomed as the human and `hub.status` answers, while a spoke hello is refused and its socket closed (test).
  - done: impl-980 · 2026-10-20T18:44:16.772Z
  - verified: rev-31 [reviewer] · run rev-20261020-980-final · 2026-10-20T18:56:12.290Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c
- [x] C5. `web.link` sent from a session's shell is refused (test).
  - done: impl-980 · 2026-10-20T18:44:17.304Z
  - verified: rev-31 [reviewer] · run rev-20261020-980-final · 2026-10-20T18:56:12.290Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c
- [x] C6. A test scans the web edge's responses (the bundle files, `/auth` and every frame of a `/ws` conversation) and finds no trace of the hub's secret.
  - done: impl-980 · 2026-10-20T18:44:17.927Z
  - verified: rev-31 [reviewer] · run rev-20261020-980-final · 2026-10-20T18:56:12.290Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c
- [x] C7. `hub/README.md` documents `cland web`, `web.link`, `/auth`, `/ws` and the checks.
  - done: impl-980 · 2026-10-20T18:44:18.830Z
  - verified: rev-31 [reviewer] · run rev-20261020-980-source · 2026-10-20T18:47:19.381Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c
  - verified: rev-31 [reviewer] · run rev-20261020-980-final · 2026-10-20T18:56:12.290Z · commit b12b7c9c6ef875dca6a14b52d9ace960bd37331c

## Comments

### impl-980 · 2026-10-20T18:42:24.926Z

Implemented human-only web.link over the Unix socket, cland web/--no-open, hashed single-use five-minute links, per-canonical-project cookie, memory-only hashed cookie sessions and /ws Host/Origin/cookie admission with secret-free client hello as human. Added T1 digest/expiry tests and T2 CLI/HTTP/admission/secret scan tests using disposable project/HOME and stubbed openers; targeted tests currently green locally on macOS arm64. Completing check/docs and merging current origin/dev before the first source review; no suite run yet.

### rev-31 · 2026-10-20T18:47:19.381Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-980-source
commit: b12b7c9c6ef875dca6a14b52d9ace960bd37331c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7952 full source clear. Digest-only one-time links, canonical per-project cookie, pre-frame Host/Origin/cookie checks, human-only client hello and Unix web.link authority traced; existing spoke admission retained. Tests cover required refusals/expiry/secret scan with sealed fixtures and stub openers; docs/help/ADR/skill metadata/clause match. A-7951 original combined receipts audited: merged-source auth2/2+13/13/edge6/6/framing1/1 summaries qualified by missing individual numeric exits; later clause-only correction27/27 and exact-head check exit0 retained. C7 verified by source; C1–C6 await mode-free same-head gate and actual new-identity5/5. No findings, Reviewer execution, real browser or Linux/T3 claim; no merge enqueue.

Criteria: C7 verified.

### rev-31 · 2026-10-20T18:56:12.290Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-980-final
commit: b12b7c9c6ef875dca6a14b52d9ace960bd37331c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7963 final evidence clear at unchanged b12b7c9c. A-7962 exact-head d547b153 has2125 ordinary passes plus75 passing load repetitions; all15 new identities have five distinct pass IDs and explicit5/5. Host check/T1/full fallbackT2 including Neovim exit0. All owned ordinary/repetition/file timings fit tiers; T2 repeat max0.473s, secret scan max0.178s. C1–C7 checked and all claimant done marks present. Report-only lint/ratchet, seven missing baselines and inherited file regressions retain limitations; no owned violations. No real browser/T3/T4/integrated or persistence/subsequent-restriction claim. Original local receipts remain qualified, QA affected/after-stage unchanged. No findings or merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-20T19:11:12.688Z

Merged fe05d55fbed2b9965c621ac91f9e1b1639a78599 onto dev.
