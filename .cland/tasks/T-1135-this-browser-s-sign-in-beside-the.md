---
id: T-1135
kind: task
title: This browser's sign-in beside the profile
state: closed
status: done
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
updated: 2026-10-23T00:59:13.158Z
closed: 2026-10-23T00:59:13.158Z
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
  - verified: rev-32 [reviewer] · run rev-20261023-1135-final · 2026-10-23T00:39:51.739Z · commit e93a3602bf3e9622a0ef061b60387ed1e4aa0a94
  - verified: rev-32 [reviewer] · run rev-20261023-1135-final-2 · 2026-10-23T00:54:34.049Z · commit c66116cacc7baf53c9526c0992fec04650ab7e63
- [x] C2. A second browser context's sign-in does not appear in the first context's profile block (Web test).
  - done: impl-1135 · 2026-10-23T00:19:23.868Z
  - verified: rev-32 [reviewer] · run rev-20261023-1135-final · 2026-10-23T00:39:51.739Z · commit e93a3602bf3e9622a0ef061b60387ed1e4aa0a94
  - verified: rev-32 [reviewer] · run rev-20261023-1135-final-2 · 2026-10-23T00:54:34.049Z · commit c66116cacc7baf53c9526c0992fec04650ab7e63
- [x] C3. `web/README.md` describes the profile block (docs).
  - done: impl-1135 · 2026-10-23T00:19:23.952Z
  - verified: rev-31 [reviewer] · run rev-20261023-1135-source · 2026-10-23T00:23:38.673Z · commit 9117dbbc39902c2a772bfc17d9cc392f16380656
  - verified: rev-32 [reviewer] · run rev-20261023-1135-delta · 2026-10-23T00:29:30.702Z · commit e93a3602bf3e9622a0ef061b60387ed1e4aa0a94
  - verified: rev-32 [reviewer] · run rev-20261023-1135-final · 2026-10-23T00:39:51.739Z · commit e93a3602bf3e9622a0ef061b60387ed1e4aa0a94
  - verified: rev-32 [reviewer] · run rev-20261023-1135-delta-2 · 2026-10-23T00:45:21.070Z · commit c66116cacc7baf53c9526c0992fec04650ab7e63
  - verified: rev-32 [reviewer] · run rev-20261023-1135-final-2 · 2026-10-23T00:54:34.049Z · commit c66116cacc7baf53c9526c0992fec04650ab7e63

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

### rev-32 · 2026-10-23T00:29:30.702Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1135-delta
commit: e93a3602bf3e9622a0ef061b60387ed1e4aa0a94
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-9674, carrying rev-31 full source audit A-9658. Only non-tracker delta is existing session-actions capability expectation none→reliable, identical to posted shared fix29c9a46c and shipped Codex capability. All other assertion rows/missing-adapter behavior retained; Profile/Accounts/README/tests/allowance unchanged. No Standards/Spec findings. C3 verified at new head; C1–C2 await fresh mode-free exact-head receipt. A-9669 original local macOS arm64 build+targeted9/9 exit0 supplemental. Old-head A-9667 cancelled exit143, T1 complete/T2 partial/Web unrun, no full-pass evidence. Fresh verify permitted at e93a3602; no reviewer execution.

Criteria: C3 verified.

### impl-1135 · 2026-10-23T00:39:37.421Z

Mode-free verification c81b634f passed at exact reviewed head e93a3602: 2588/2588, T1/T2/Web complete on Linux x64 c-8 lon1 droplet; budgets report-only, T3 deferred to periodic/integrated occasions. Original receipt A-9686; typecheck reused host gate rather than repeated. Fetched current origin/dev 88948246 and conflict-only git merge-tree returned clean (exit 0), with no branch merge and clean working tree. Stage QA remains separate. Awaiting final same-head Reviewer verdict.

### rev-32 · 2026-10-23T00:39:51.739Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1135-final
commit: e93a3602bf3e9622a0ef061b60387ed1e4aa0a94
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-9689, carrying source A-9658/delta A-9674. Fresh A-9686/runc81b634f at unchanged e93a3602: Linux x64 c-8 lon1 droplet, T1/all-T2 hub+Neovim/Web exit0, aggregate2588 pass/zero fail/cancel/skip/todo. Accounts6/6 including new C1 profile timestamps/fixed30day expiry/reload last-use and C2 two-context own-cookie isolation pass; area-slots/shared-fix session-actions files pass. C3 docs retained/rechecked. New samples2.475/1.538s; existing dated6.8s allowance retains original4.512101s provenance. Host check/typecheck gate reused, not remotely repeated. Generic lint/duration/ratchet report-only; measured Web wall61.238s>40s report budget, no timing-budget pass claim. Prior cancelled receipt not counted. No configured T3/T4/per-item QA (affected/after-stage). No remaining Standards/Spec findings; C1–C3 verified.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-32 · 2026-10-23T00:45:21.070Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1135-delta-2
commit: c66116cacc7baf53c9526c0992fec04650ab7e63
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-9700 after Coordinator-authorized merge. All5 own-only and20 incoming-only paths preserve exact parent blobs. Sole shared README retains complete Profile and artifact page/file-opening sections plus both targeted commands. Own six-file Profile implementation/tests/allowance unchanged from accepted source; no Standards/Spec findings. C3 docs verified; C1–C2 await fresh exact-head configured mode-free result. A-9699 reported local macOS rebuild/24 targeted passes supplemental; parent A-9686 historical only. Carry original full audit A-9658/delta A-9674; no reviewer execution. Fresh verify permitted at c66116ca.

Criteria: C3 verified.

### impl-1135 · 2026-10-23T00:54:24.356Z

Post-README-merge mode-free fbe46936 passed at reviewed c66116ca: Linux c-8 lon1, T1/all-T2/Web 2593/2593. A-9712 original receipt; budgets report-only, typecheck host-gated/not repeated, T3 deferred. Conflict-only check against freshly fetched origin/dev 48ffceb6 returned exit 0; tree clean and branch unchanged. Awaiting final same-head Reviewer verdict; after-stage QA separate.

### rev-32 · 2026-10-23T00:54:34.049Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261023-1135-final-2
commit: c66116cacc7baf53c9526c0992fec04650ab7e63
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Post-merge final clear A-9714 carrying source delta A-9700. Fresh A-9712/runfbe46936 at unchanged c66116ca: Linux x64 c-8 lon1 droplet T1/all-T2 hub+Neovim/Web exit0; aggregate2593 pass/zero fail/cancel/skip/todo. Accounts6/6 including C1 timestamps/fixed30day expiry/reload and C2 two-context own-sign-in isolation pass (new samples2.095/1.413s); area-slots/artifacts/key-contexts/palette files pass. C3 docs carried; all C1–C3 verified. Existing dated6.8s allowance retains original sample provenance. Host check/typecheck reused, not remotely repeated. Generic lint/duration/ratchet report-only; measured Web wall59.726s>40s report budget, no timing-budget pass claim. No configured T3/T4/per-item QA. No Standards/Spec findings. Previous-head receipts not relabelled.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-23T00:59:13.158Z

Merged 15d97e15d64e95ba8b56e733c8baa3a440d07066 onto dev.
