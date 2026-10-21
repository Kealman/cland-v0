---
id: T-982
kind: task
title: Cookie sessions that survive restarts, listed and revoked
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
topic: topic-778
branch: t/T-982-cookie-sessions-that-survive-restarts
created: 2026-10-20T16:50:00.187Z
updated: 2026-10-21T03:13:24.113Z
closed: 2026-10-21T03:13:24.113Z
---

## Summary

The hub keeps each web cookie session hashed in `hub.db`, so a hub restart signs no browser out. `cland web --sessions` lists the sessions, and `cland web --revoke <id>` ends one and closes its sockets.

## What to build

Each cookie session is stored as a hash, with its creation time and its last use. A restart keeps it, and it expires after 30 days. `cland web --sessions` prints each session's id, creation, last use and open sockets. `cland web --revoke <id>` ends that session at once: its sockets close and its cookie is refused from then on.

## Acceptance criteria

- [x] C1. A cookie issued before a hub restart still opens `/ws` after it (test with two hub starts on one project).
  - verified: rev-23 [reviewer] · run rev-20261020-982-final · 2026-10-20T21:48:57.454Z · commit 129f031c6a68eb43be06a4cc9c33dccd54684358
  - done: impl-982 · 2026-10-21T02:58:43.830Z
  - verified: rev-23 [reviewer] · run rev-20261021-982-final-2 · 2026-10-21T03:08:47.196Z · commit 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
- [x] C2. `hub.db` holds only a hash of each cookie, with its creation and last use (test reads the row).
  - verified: rev-23 [reviewer] · run rev-20261020-982-final · 2026-10-20T21:48:57.454Z · commit 129f031c6a68eb43be06a4cc9c33dccd54684358
  - done: impl-982 · 2026-10-21T02:58:43.849Z
  - verified: rev-23 [reviewer] · run rev-20261021-982-final-2 · 2026-10-21T03:08:47.196Z · commit 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
- [x] C3. `cland web --sessions` lists each cookie session with its id, creation, last use and open socket count (CLI test).
  - verified: rev-23 [reviewer] · run rev-20261020-982-final · 2026-10-20T21:48:57.454Z · commit 129f031c6a68eb43be06a4cc9c33dccd54684358
  - done: impl-982 · 2026-10-21T02:58:43.867Z
  - verified: rev-23 [reviewer] · run rev-20261021-982-final-2 · 2026-10-21T03:08:47.196Z · commit 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
- [x] C4. `cland web --revoke <id>` closes that session's open sockets within the call, and its cookie is refused afterwards (test).
  - verified: rev-23 [reviewer] · run rev-20261020-982-final · 2026-10-20T21:48:57.454Z · commit 129f031c6a68eb43be06a4cc9c33dccd54684358
  - done: impl-982 · 2026-10-21T02:58:43.884Z
  - verified: rev-23 [reviewer] · run rev-20261021-982-final-2 · 2026-10-21T03:08:47.196Z · commit 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
- [x] C5. A cookie session older than 30 days is refused (fake-clock test).
  - verified: rev-23 [reviewer] · run rev-20261020-982-final · 2026-10-20T21:48:57.454Z · commit 129f031c6a68eb43be06a4cc9c33dccd54684358
  - done: impl-982 · 2026-10-21T02:58:43.904Z
  - verified: rev-23 [reviewer] · run rev-20261021-982-final-2 · 2026-10-21T03:08:47.196Z · commit 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
- [x] C6. `hub/README.md` documents `--sessions`, `--revoke` and the 30-day lifetime.
  - verified: rev-23 [reviewer] · run rev-20261020-982-source-2 · 2026-10-20T21:40:25.546Z · commit 129f031c6a68eb43be06a4cc9c33dccd54684358
  - verified: rev-23 [reviewer] · run rev-20261020-982-final · 2026-10-20T21:48:57.454Z · commit 129f031c6a68eb43be06a4cc9c33dccd54684358
  - done: impl-982 · 2026-10-21T02:58:43.921Z
  - verified: rev-23 [reviewer] · run rev-20261021-982-source-3 · 2026-10-21T03:00:42.133Z · commit 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
  - verified: rev-23 [reviewer] · run rev-20261021-982-final-2 · 2026-10-21T03:08:47.196Z · commit 6c7ea23aeb7c4851f6bf8eea77840c01012101c7

## Comments

### impl-982 · 2026-10-20T21:30:16.270Z

Implementation seams follow C1–C5: T1 persisted row/hash + reopen + fake-clock lifetime; T2 two serveProject starts on one disposable root and executable CLI list/revoke with socket receipts. Additive web_sessions table; no message backfill. QA affected/after-stage, no per-item brief/criteria. Targeted red unit run confirms missing persistent-store constructor boundary; no suite run yet.

### rev-23 · 2026-10-20T21:37:46.106Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-982-source
commit: aeb84fe6586a273e64b53de318c7384bb574880e
scope: full
findings: [{"severity":"medium","text":"M1: Client TCP close notifications need not precede separate CLI completion even though revocation awaited every server-side close. Assert the exact server completion receipt and bound client-close observations separately (rule 9).","file":"hub/test/web-auth.test.ts","line":243},{"severity":"medium","text":"M2: Later --sessions/--revoke and session-shell CLI calls omit open/xdg-open stubs; root/opened absence cannot detect their browser launches. Reuse the owned opener env for all new calls (rule 15).","file":"hub/test/web-auth.test.ts","line":239}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; full Standards/Spec audit A-8095 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8095-t-982-source-review-findings-at-aeb84fe6.md). Two medium test findings, no other production/spec gap identified. Persistence is additive/hash-only, fixed 30-day expiry is not renewed by use, and server-side revoke sequencing is sound. A-8094 local targeted/static evidence and A-8091 copy-only migration diagnostic retain their scope; no full gate yet. M1 is a structural cross-boundary flake risk, not a reproduced failure. Fail C3/C4 for validation/isolation; fresh source review after fixes, before verification.

Criteria: C3 failed (New listing CLI invocations do not all use owned opener stubs; the no-opener assertion misses those launches (M2).), C4 failed (Client close notification order is asserted across the server-close/CLI-return boundary; revoke CLI invocations also need opener isolation (M1/M2).).

### rev-23 · 2026-10-20T21:40:25.546Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-982-source-2
commit: 129f031c6a68eb43be06a4cc9c33dccd54684358
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards/Spec audit A-8097 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8097-t-982-corrected-source-clear-at-129f031c.md), supplementing full initial A-8095. M1 resolved with server close-handler receipt after socket removal/conversation cleanup, observed by CLI return, then separately bounded client closure/final CLOSED assertions. M2 resolved by owned opener env on all listing/revocation/session-shell probes. Docs identify the actual receipt. Remaining persistence/expiry/store/CLI code unchanged, no other findings. A-8096 local matching-source T2 17/17 and exact-head typecheck are targeted/static only. C6 verified by source; C1–C5 await fresh exact-head configured mode-free verification. No Reviewer runtime or after-stage QA claim.

Criteria: C6 verified.

### rev-23 · 2026-10-20T21:48:57.454Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-982-final
commit: 129f031c6a68eb43be06a4cc9c33dccd54684358
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; audit A-8101 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8101-t-982-final-evidence-review-at-129f031c.md). Exact-head configured b144765a/A-8100 completed Linux T1/all-T2 fallback: 2,163 ordinary passes/335 passing files, five new identities each 5/5 load passes separately. Auth T1 3/3, auth T2 17/17 and edge T2 6/6 prove restart persistence/hash-only timestamps, CLI list/revoke, exact server completion and separately bounded client closure, isolation and fixed fake-clock lifetime. M1/M2 remain resolved; C6 docs remain source-established. Web selected but NOT RUN for missing Linux Headless Shell libraries; no browser/T3/T4/after-stage QA claim. Host check d7a66f50 not repeated remotely; lint/duration/ratchet report-only, timing regressions retained. No findings; verify C1–C6.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-23 · 2026-10-21T03:00:42.133Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-982-source-3
commit: 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear; audit A-8116 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8116-t-982-merge-delta-source-clear-at-6c7ea23a.md). Coordinator 9f1532e7/fc29d20c authorize this merge. Persistent store/auth/edge/CLI semantics and M1/M2 fixes unchanged; two explicit Web-refusing rows preserve complete protocol inventory, authenticated tests now assert cli-neovim-only/CLI/Neovim. Both sides of docs/help/skill provenance and human-only clause pointers retained, within reported roles headroom. A-8113 local targeted/static evidence is scoped, not a fresh configured gate. No findings; C6 verified by source, C1–C5 await exact-head mode-free verification. A-8100 is historical only; no Reviewer runtime or QA claim.

Criteria: C6 verified.

### rev-23 · 2026-10-21T03:08:47.196Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-982-final-2
commit: 6c7ea23aeb7c4851f6bf8eea77840c01012101c7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final clear; audit A-8122 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8122-t-982-merged-head-final-review-at-6c7ea23a.md). Exact-head 17caee06/A-8121 completes Linux T1/all-T2 fallback: 2,199 ordinary passes/337 files, five owned new identities each 5/5 load passes separately. Auth T1 3/3/T2 17/17 and incoming policy 4/4/authority 32/32 pass. Persistence/expiry/list/revoke, exact server completion, separate client closure, owned openers and typed refusal integration all established; docs C6 remain source-verified. M1/M2 resolved. Web NOT RUN for missing Linux libraries; no browser/T3/T4/after-stage QA claim. Host check 5253b3a6 not repeated remotely; lint/duration/ratchet report-only, two missing baselines. No findings; verify C1–C6.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-21T03:13:24.113Z

Merged 694e823dfa7231c433de939a3b87a6e4e28c1209 onto dev.
