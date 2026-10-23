---
id: T-1135
kind: task
title: This browser's sign-in beside the profile
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1134
  - T-1131
topic: topic-881
branch: t/T-1135-this-browser-s-sign-in-beside-the
created: 2026-10-22T15:16:15.619Z
updated: 2026-10-23T00:23:38.673Z
---

## Summary

The Accounts area opens with the human's profile block: this browser's sign-in, when it was made and when its cookie expires.

## Parent

E-418 (§3.6 beside the profile; v0.2 §3.7; tracer step 5).

## What to build

The profile is the human's own block at the top of the Accounts area, set apart from the accounts; it is not an account. It shows this browser's sign-in from the hub slice's request: when it was made, when it was last used and when the cookie expires. It names no other browser and offers no revoke; those stay with `cland web` in the CLI. The notification switches join this block in the switches slice, after E-417.

## Acceptance criteria

- [x] C1. The profile block shows this browser's sign-in with its creation and its expiry 30 days later, matching the hub's record of the cookie (Web test).
  - done: impl-1135 · 2026-10-23T00:19:23.774Z
- [x] C2. A second browser context's sign-in does not appear in the first context's profile block (Web test).
  - done: impl-1135 · 2026-10-23T00:19:23.868Z
- [x] C3. `web/README.md` describes the profile block (docs).
  - done: impl-1135 · 2026-10-23T00:19:23.952Z
  - verified: rev-31 [reviewer] · run rev-20261023-1135-source · 2026-10-23T00:23:38.673Z · commit 9117dbbc39902c2a772bfc17d9cc392f16380656

## Comments

### impl-1135 · 2026-10-23T00:18:42.219Z

Implemented Profile as a separate browser sign-in component above the Accounts registry, using only socket-bound web.session. Red C1: missing Profile time locator timed out (3000 ms); green C1 covers public hub timestamp readback and reconnect last-use/fixed expiry. C2 opens two isolated Headless Shell contexts on one scratch hub and proves distinct own-only records, with no browser list/revoke frames. Targeted working-tree macOS arm64 run: web/test/accounts.test.ts 6/6; new identities 1.565 s and 0.602 s. Web typecheck/token/contrast/HTML/hooks checks pass. No suite receipt yet; source review precedes mode-free verification.

### rev-31 · 2026-10-23T00:23:38.673Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261023-1135-source
commit: 9117dbbc39902c2a772bfc17d9cc392f16380656
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-9658. Separate Profile reads authenticated socket-bound web.session, uses local dates/exact tooltips and shared Fold, never account inventory or browser list/revoke. Two-context Web tests and fixed-expiry/reload assertions inspected. A-9655 original local targeted/check receipts audited with precommit attribution; 6.8s dated allowance cites actual4.512101s sample. C3 verified; C1/C2 await exact-head configured mode-free result. Standards0/Spec0; after-stage QA separate.

Criteria: C3 verified.
