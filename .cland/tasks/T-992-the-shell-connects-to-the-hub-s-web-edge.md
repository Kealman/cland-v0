---
id: T-992
kind: task
title: The shell connects to the hub's web edge
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-991
  - T-979
topic: topic-790
branch: t/T-992-the-shell-connects-to-the-hub-s-web-edge
created: 2026-10-20T16:51:40.575Z
updated: 2026-10-21T10:13:38.172Z
closed: 2026-10-21T10:13:38.172Z
---

## Summary

The shell connects to the hub's web edge: `cland web` opens it, its connection module shows the project and the hub's live dot and reconnects with backoff, and it imports its wire types from E-412's leaf module. This ticket also carries E-412's browser proof of the auth redirect, the cookie's flags and the served bundle. It replaces the development bridge of the 2026-10-14 prototype, which is not built (Coordinator proposal, approved with the plan).

## What to build

- **The connection.** The shell connects to `/ws` on the edge with a client hello. It shows the project's name and the live dot, turns the dot down when the hub goes away, and reconnects with backoff.
- **The wire types.** The shell imports them from E-412's leaf module (`shared/wire/`); there is no stand-in `web/src/wire.ts`.
- **Browser proofs.** A browser test proves the auth redirect, the cookie's HttpOnly and SameSite=Strict flags and the bundle served by the edge, and scans the bundle, the browser's storage and the edge's responses for the hub's secret.
- **Docs.** `web/README.md` names `cland web` as the entry.

## Acceptance criteria

- [x] C1. A browser test opens the link that `cland web --no-open` prints, follows the redirect to `/`, and the shell connects to `/ws` on the edge and shows the project's name and the live dot.
  - done: impl-992 · 2026-10-21T09:40:17.700Z
  - verified: rev-26 [reviewer] · run rev-20261021-992-final-1 · 2026-10-21T09:48:49.180Z · commit ac3c67e9ab5005f11dd40948dafa608667766e1f
- [x] C2. The same test reads the cookie `cland_<key>` with HttpOnly and SameSite=Strict, and the served bundle's CSP header.
  - done: impl-992 · 2026-10-21T09:40:17.717Z
  - verified: rev-26 [reviewer] · run rev-20261021-992-final-1 · 2026-10-21T09:48:49.180Z · commit ac3c67e9ab5005f11dd40948dafa608667766e1f
- [x] C3. The live dot turns down when the scratch hub stops and live again after it restarts, through reconnect with backoff (browser test).
  - done: impl-992 · 2026-10-21T09:43:48.179Z
  - verified: rev-26 [reviewer] · run rev-20261021-992-final-1 · 2026-10-21T09:48:49.180Z · commit ac3c67e9ab5005f11dd40948dafa608667766e1f
- [x] C4. The shell imports its wire types from E-412's leaf module, no `web/src/wire.ts` exists, and the typecheck is green.
  - done: impl-992 · 2026-10-21T09:40:17.744Z
  - verified: rev-26 [reviewer] · run rev-20261021-992-final-1 · 2026-10-21T09:48:49.180Z · commit ac3c67e9ab5005f11dd40948dafa608667766e1f
- [x] C5. A browser test scans the bundle, `localStorage`, the cookies' values and the edge's responses and finds no trace of the hub's secret.
  - done: impl-992 · 2026-10-21T09:40:17.759Z
  - verified: rev-26 [reviewer] · run rev-20261021-992-final-1 · 2026-10-21T09:48:49.180Z · commit ac3c67e9ab5005f11dd40948dafa608667766e1f
- [x] C6. `web/README.md` describes `cland web` as the entry.
  - done: impl-992 · 2026-10-21T09:40:17.775Z
  - verified: rev-26 [reviewer] · run rev-20261021-992-source-2 · 2026-10-21T09:44:36.117Z · commit ac3c67e9ab5005f11dd40948dafa608667766e1f
  - verified: rev-26 [reviewer] · run rev-20261021-992-final-1 · 2026-10-21T09:48:49.180Z · commit ac3c67e9ab5005f11dd40948dafa608667766e1f

## Comments

### impl-992 · 2026-10-21T09:39:01.608Z

Implemented the cookie-authenticated /ws connection using shared/wire types. Red→green browser slices proved initial rendered readiness and restart/backoff. Local macOS arm64 Headless Shell targeted connection test passes at the current uncommitted tree, including CLI link, auth redirect, strict cookie/CSP, secret scanning and offline/live after scratch-hub restart. Browser retry time is controlled; fixture cleanup observes the browser PID/group exit and stops the current hub. Repository checks and source review remain.

### rev-26 · 2026-10-21T09:42:09.728Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-992-source-1
commit: 6ab0cba407bfba6d49d1df9f1a6c85f1f264b017
scope: full
findings: [{"severity":"medium","text":"M1: Playwright clock.install() leaves real time running. Hub stop/restart and DOM/socket observations consume retry time before runFor(249/499), so the exact attempt-count assertions race correct 250/500 ms backoff under load. Pause before disconnect and separately observe completion before advancing controlled time.","file":"web/test/connection.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit at fixed dev/base 479178b25c78ccbb54f908ef7cc7c05c18426cd0. Medium M1 at web/test/connection.test.ts:22 (assertions :37–48): clock.install does not pause time; setup and transport/render waits can exhaust the delay before manual clock advancement. No additional production/spec finding. Shared wire import and C6 docs are present; execution-dependent criteria remain unverified. Full Standards/Spec audit and evidence limitations: A-8221, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8221-t-992-source-review-not-clear-at-6ab0cba4-pause-retry-test-clock.md. No Reviewer test/browser execution. Corrected head needs source review before verification.

Criteria: C3 failed (The restart/backoff browser proof has uncontrolled elapsed-time races because its installed clock is never paused (M1).).

### rev-26 · 2026-10-21T09:44:36.117Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-992-source-2
commit: ac3c67e9ab5005f11dd40948dafa608667766e1f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source audit clear. M1 resolved at web/test/connection.test.ts:22–26: fixed-epoch install plus pauseAt before disconnect prevents real edge/DOM work consuming controlled retry delays; bounded socket/DOM observations and all final assertions remain. Only this test correction changed from 6ab0cba4; no dev merge. Shared/wire import, authenticated status readiness, secret scans, fixture isolation/disposal and docs remain sound. C6 verified by source; C1–C5 await post-source same-head execution evidence. A-8225 targeted local macOS 1/1 is supplemental, not a full Web phase. Original check in A-8224 was not wholly green (tier ordering failed after typecheck/build); corrected lint passed. Full audit/provenance: A-8226 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8226-t-992-corrected-source-clear-at-ac3c67e9-paused-restart-clock.md. Coordinator a065d8c5 authorizes serial local verify after targeted rerun.

Criteria: C6 verified.

### rev-26 · 2026-10-21T09:48:49.180Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-992-final-1
commit: ac3c67e9ab5005f11dd40948dafa608667766e1f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C6 verified. Independently audited A-8228/run 96babba6: exact ac3c67e9, actual local Darwin arm64 Node24.21/Neovim0.12.5; check, all T1, all T2 fallback in both packages and Web each exit 0. Structured records: 2234 ordinary test passes/344 file passes, no failure/skip/cancel. Web actually executes connection 1.027759125 s and smoke parent 1.07326275 s (plus three smoke subtests), all passing; actual Web wall 1.511 s, not the 1.267 s projection. Both browser groups empty and scratch hubs stopped. Root check actually typechecks/builds at this head; lint/budgets/ratchet report-only. T3/T4 not run, no Linux claim; after-stage QA separate. No remaining task findings. Original raw receipt, criteria map and qualifications: A-8229 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8229-t-992-final-clear-at-ac3c67e9-actual-local-web-reconnect-proof.md. Unchanged executor-prepare-retry T2 report-only budget diagnostic is reported aside to the lead, outside T-992.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-21T10:13:38.172Z

Merged 158e188a60319dc6bce4c1f8f837121b7cd153f0 onto dev.
