---
id: T-1800
kind: task
title: "web-signin invite-admission case needs a built web bundle: GET /invite returns 503 when web/dist is absent"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1566
found_by: droplet
topic: topic-1459
branch: t/T-1800-web-signin-invite-admission-case-needs-a
created: 2026-11-10T01:59:19.312Z
updated: 2026-11-10T03:11:50.835Z
closed: 2026-11-10T03:11:50.835Z
---

## Summary

`hub/test/web-signin.test.ts` "invite admission refuses foreign origins, wrong methods, short passwords and unknown tokens without cookies" (T2) checks that a short password did not consume the invite by fetching `GET /invite?token=…` and expecting 200. With a valid token, that route falls through to the SPA `index.html` in `hub/src/hub/web-edge.ts`. When `web/dist` is absent, the route replies 503 "The cland web bundle is missing". The case therefore passes only when an earlier step on the same machine has built `web/dist`. That is a hidden dependency on the build and on test order.

## Evidence

- E-1535 stage-1 Linux stage cover e766f413 at dev 2e7a13c0 (A-18219), shard-1. The shard checkout logs `Removing web/dist/` and no web build ran before T2. Failure: `AssertionError: short password did not consume the invite 503 !== 200` at web-signin.test.ts:72. Shard-1 stopped after T2, so its T3, T4 and Web never ran.
- The earlier cover 70a2f91e (A-18172) passed the case on shard-2 with the same `Removing web/dist/` preparation, so the outcome depends on what ran before it. The shard plan moved after the add-only durations refresh 279b92fe9.
- web-edge.ts lines 128 to 135 and 154 to 156: an extensionless path falls back to `dist/index.html`, and it replies 503 when that file is missing.

## Acceptance criteria

- [x] C1. The case proves that the invite was not consumed without depending on a built `web/dist`: through an invite route that doesn't serve the bundle, or through a fixture bundle the test owns (test).
  - done: impl-1800 · 2026-11-10T02:02:00.513Z
  - verified: rev-35 [reviewer] · run rev-35-1800-source-1 · 2026-11-10T02:04:05.688Z · commit 1f24f8bace6692819d8517c5d7d9aadd69d8a392
  - verified: rev-35 [reviewer] · run rev-35-1800-final-1 · 2026-11-10T02:27:45.995Z · commit 1f24f8bace6692819d8517c5d7d9aadd69d8a392
- [x] C2. The case and its file pass alone in a checkout with no `web/dist` (each case alone by name, 5/5), and pass with a built bundle present (test).
  - done: impl-1800 · 2026-11-10T02:02:10.867Z
  - verified: rev-35 [reviewer] · run rev-35-1800-final-1 · 2026-11-10T02:27:45.995Z · commit 1f24f8bace6692819d8517c5d7d9aadd69d8a392
- [x] C3. A sweep of the other hub/test files that fetch extensionless web routes expecting 200 is listed in an item comment. Each one either stops depending on `web/dist`, or has a follow-up named (test).
  - done: impl-1800 · 2026-11-10T02:02:11.042Z
  - verified: rev-35 [reviewer] · run rev-35-1800-source-1 · 2026-11-10T02:04:05.688Z · commit 1f24f8bace6692819d8517c5d7d9aadd69d8a392
  - verified: rev-35 [reviewer] · run rev-35-1800-final-1 · 2026-11-10T02:27:45.995Z · commit 1f24f8bace6692819d8517c5d7d9aadd69d8a392

## Comments

### impl-1800 · 2026-11-10T02:01:22.622Z

C3 code sweep: searched all hub/test/**/*.ts for httpFetch and fetch calls and read page-route callers plus native HTTP helpers. No other hidden web/dist dependency found. web-signin.test.ts was the sole fetch page-route 200 expectation: live /invite GET replaced by same-origin POST /invite/details; /invite unknown/revoked/expired paths fail before static serving and root GET checks a /signin redirect. auth-mode.test.ts, artifact-user.test.ts, gateway-state.test.ts, telegram-liveness.test.ts: /auth navigation expects 302 (or invalid-token 401), no bundle. answer-users.test.ts, user-invites.test.ts, web-upload.test.ts: /auth redemption with redirect manual obtains cookie before static serving; /upload 200 is API, no bundle. web-upload-owner.ts posts uploads only. Remaining fetch hits address fake provider/harness/control APIs or Git fetch (init), not web page routes. Extended native-http check: web-edge.test.ts expects 200 at / and extensionless fallback using fixtureBundle and configured web.dist=bundle, no installed bundle; web-auth.test.ts reads / and built assets, explicitly before(ensureWebBuild), so declared dependency with its own build prerequisite, no follow-up. web-artifacts.test.ts 200 routes serve fixture-owned artifact files/folders; web-authority.test.ts authenticates /auth and sockets, no shell 200. Only this case changed; no other dependent case needing a Bugs follow-up identified.

### rev-35 · 2026-11-10T02:04:05.688Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1800-source-1
commit: 1f24f8bace6692819d8517c5d7d9aadd69d8a392
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18228: Standards0/Spec0. Non-consuming same-origin details API bypasses static serving, checks invited identity and rejects consumed token; original assertions retained. Independently inspected C3 HTTP/page helper sweep and declared/owned bundle users. C1,C3 verified. A-18225 all15 solo receipts and A-18226 actual-build+3/3 inspected; A-18227 candidate/copy/transcript-only/status limits retained. C2 final settlement awaits exact-head configured run. Proceed mode-free verify at unchanged head; no reviewer native work, QA none.

Criteria: C1 verified, C3 verified.

### rev-35 · 2026-11-10T02:27:45.995Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1800-final-1
commit: 1f24f8bace6692819d8517c5d7d9aadd69d8a392
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18230: C1–C3 all verified at unchanged clean head. A-18229 configureda0265c13 passed5769/5769,zero fail/cancel/skip; independently checked three exact case records+file finish and matched head/export tree. A-18225 solo3×5/5 and A-18226 actual-build+file3/3 inspected; absent whole-file/transcript-only, candidate/copy/status linkage limits retained A-18227. Source API boundary and C3 sweep retained. Standards0/Spec0. T0/T1/allT2/Web complete; T3 batch/T4 unrun, report-only diagnostics and QA-none distinguished. No reviewer runtime work.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-10T03:11:50.835Z

Merged 6f6849b610072e4f8ee843b68145508751ed8cae onto dev.
