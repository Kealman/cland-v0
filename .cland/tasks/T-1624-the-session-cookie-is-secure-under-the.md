---
id: T-1624
kind: task
title: The session cookie is Secure under the configured origin
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1566
topic: topic-1355
branch: t/T-1624-the-session-cookie-is-secure-under-the
created: 2026-11-02T03:34:18.412Z
updated: 2026-11-03T01:20:24.436Z
closed: 2026-11-03T01:20:24.436Z
---

## Summary

The single cookie helper marks every session cookie `Secure` whenever `[web] origin` is set (always `https`) and the request's Host equals the origin's host, also on a top-level GET that carries no `Origin` header. The Host and exact-Origin admission checks stay as ADR 0003 describes, and forwarded headers are never trusted. ADR 0003 records the wider condition.

Hot files: the T-1566 cookie helper (`hub/src/hub/web-edge.ts` or `web-signin.ts`) [E-1536], `hub/test/web-auth.test.ts` (one assertion), new `hub/test/web-cookie-secure.test.ts`, `docs/adr/0003-*.md` [E-1532, E-1536 also amend]

## Acceptance criteria

- [x] C1. With `[web] origin` set and the request's Host equal to the origin's host, `/auth` sets the session cookie with `Secure` on a GET without an `Origin` header (test).
  - done: impl-1624 · 2026-11-03T00:13:23.881Z
  - verified: rev-35 [reviewer] · run rev-35-1624-final-1 · 2026-11-03T00:38:39.215Z · commit a75b03fb9ebdc34bb83dd552bde2d730dd053799
- [x] C2. With no `[web] origin`, or with a loopback, LAN or other Host, no cookie the edge sets carries `Secure` (test).
  - done: impl-1624 · 2026-11-03T00:13:24.029Z
  - verified: rev-35 [reviewer] · run rev-35-1624-final-1 · 2026-11-03T00:38:39.215Z · commit a75b03fb9ebdc34bb83dd552bde2d730dd053799
- [x] C3. `X-Forwarded-Host`, `X-Forwarded-Proto` and `Forwarded` never make a cookie `Secure` (test).
  - done: impl-1624 · 2026-11-03T00:13:24.344Z
  - verified: rev-35 [reviewer] · run rev-35-1624-final-1 · 2026-11-03T00:38:39.215Z · commit a75b03fb9ebdc34bb83dd552bde2d730dd053799
- [x] C4. The rule lives only in the single cookie helper, so the invite cookie (and the sign-in cookie, once T-1567 lands) follow it (test).
  - done: impl-1624 · 2026-11-03T00:13:24.519Z
  - verified: rev-35 [reviewer] · run rev-35-1624-final-1 · 2026-11-03T00:38:39.215Z · commit a75b03fb9ebdc34bb83dd552bde2d730dd053799
- [x] C5. Admission checks for WebSocket upgrades, `/upload` and the invite endpoints are unchanged, and in `web-auth.test.ts` only the Host-only no-Secure assertion changes (test).
  - done: impl-1624 · 2026-11-03T00:13:24.849Z
  - verified: rev-35 [reviewer] · run rev-35-1624-final-1 · 2026-11-03T00:38:39.215Z · commit a75b03fb9ebdc34bb83dd552bde2d730dd053799
- [x] C6. ADR 0003 gains a dated amendment replacing the 2026-10-21 sentence that a top-level GET without Origin does not meet the Secure condition.
  - done: impl-1624 · 2026-11-03T00:13:25.014Z
  - verified: rev-35 [reviewer] · run rev-35-1624-source-1 · 2026-11-03T00:17:15.725Z · commit a75b03fb9ebdc34bb83dd552bde2d730dd053799
  - verified: rev-35 [reviewer] · run rev-35-1624-final-1 · 2026-11-03T00:38:39.215Z · commit a75b03fb9ebdc34bb83dd552bde2d730dd053799

## Notes

Shared files: see Hot files

## Comments

### impl-1624 · 2026-11-03T00:10:23.632Z

Contract inventory (rule 20): searched webSessionCookie, Set-Cookie, Secure, cookie flags and Host/Origin conditions across hub/src (including colocated tests), hub/test (all tiers), web/src/test, shared, nvim, docs, skills and QA. Production cookie writers: web-edge /auth and web-signin invite password, password sign-in, passkey registration/sign-in, all through web-auth.webSessionCookie. Signout revokes sessions without setting cookies. Persisted web_sessions rows and client Cookie readers unchanged. Existing web-auth, web-signin, web-authority, web-network-unit, web-auth-unit, web passkey/connection fixtures remain compatible except Host-only /auth Secure assertion. Docs/hub/web-edge and ADR 0003 updated. Historical QA E-412 stage3 M13 expects the superseded Host-only behavior; will annotate that brief's expectation while preserving its old run records. Other listed cookie QA E-412 stages1/2, E-415 stage2, E-419 stages2/4/epic, E-1536 stage3, T-108 keep unchanged flags or loopback behavior. Startup probes/skills have no Secure predicate. Cookie wire shape and helper signature unchanged; previous ordinary loopback cookie regression retained.

### impl-1624 · 2026-11-03T00:10:57.334Z

Coordinator decision ba646380: C5's one loop assertion changes to expect Secure whenever headers.Host === tunnel.Host; this covers both Host-only and foreign-Origin /auth cases. /auth already returns 302 and sets a cookie for both. Those outcomes and all admission assertions remain unchanged. Red-first C1 HTTP test failed with the expected missing '; Secure' at initial head; changed only the helper's Origin dependency, then C1 passed locally (macOS arm64 Node24.21.0, no browser).

### impl-1624 · 2026-11-03T00:13:41.149Z

Pre-review head a75b03fb9ebdc34bb83dd552bde2d730dd053799 pushed to origin; fetched/merged origin/dev (only upstream E-1538 stage1 QA brief), merge-tree exit0 and clean tree. Preliminary evidence A-16026. npm run typecheck exit0. npm run test:lint now completed exit0: 122 report-only findings/59 files, 0 refusals; known T-1484 install-import notice and build-tier advisory retained. Local changed tests 39/39 total pass (web-auth29, web-auth-unit6, web-cookie-secure4), macOS arm64 Node24.21.0, no browser, no full suite yet. C1–C6 marked done. QA full after-stage per item policy.

### rev-35 · 2026-11-03T00:17:15.725Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1624-source-1
commit: a75b03fb9ebdc34bb83dd552bde2d730dd053799
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards and Spec have no findings. Shared cookie predicate now depends on the configured HTTPS origin and matching Host, including port, independent of request Origin/forwarded claims. All cookie writers retain the shared helper. Admission implementation is unchanged; existing web-auth cookie assertion migration matches Coordinator decision ba646380. ADR, current docs, QA expectation and test guidance agree. C6 source verified; C1–C5 test-dependent evidence remains unverified until same-head queued verification. Reviewer executed no tests/browser. Detail: A-16033 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16033-t-1624-source-review-shared-host-based-secure-cookie-policy.md).

Criteria: C6 verified.

### impl-1624 · 2026-11-03T00:38:18.059Z

Same reviewed head a75b03fb9: mode-free uncached verify80c4d266 exit0,4839pass/0fail/0cancel/0skip/0todo; logA-16048. T0,T1,all T2 fallback,Web complete; T3 remains merge-batch evidence, no changed T3/T4. Linux x64 droplet c-8 sfo2,Node24.21.0,Neovim0.12.5,isolated Headless Shell1248 (Chrome156.0.8078.4),lifetime1150s,cost$0.0799. Streamed named completion facts confirm new HTTP cases and cookie matrix pass; unedited web-authority,web-signin,web-upload and browser signin complete passing alongside web-auth. Budget/ratchet/lint are report-only, not performance passes. Requested final evidence review; tree unchanged/clean.

### rev-35 · 2026-11-03T00:38:39.215Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1624-final-1
commit: a75b03fb9ebdc34bb83dd552bde2d730dd053799
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C6 verified, no findings. Exact-head80c4d266/A-16048 exit0,4839 pass/zero fail/cancel/skip/todo. Independently checked all four new HTTP outcomes, full cookie-policy matrix, web-auth29 and unchanged network4/edge8/authority46/signin3 plus isolated browser signin/passkey preservation. Cookie predicate/callers and Coordinator-approved existing assertion migration remain source-reviewed; admission source unchanged. Uncached Linux x64 c-8 sfo2 Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/Web completed,T3 deferred to batch,T4 unexecuted. Budgets/lint/ratchet/skip-reason checks report-only; missing baselines and incomplete ratchet are not passes. QA full after-stage remains separate. Reviewer executed no tests/browser and made no edits. Named/provenance detail A-16051: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16051-t-1624-final-evidence-secure-cookies-and-unchanged-admission.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-03T01:20:24.436Z

Merged 20c4f9511fc19922efc14c023763d454993a694d onto dev.
