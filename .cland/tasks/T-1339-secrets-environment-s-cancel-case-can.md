---
id: T-1339
kind: task
title: secrets-environment's cancel case can read the stopping marker before its bytes are written
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by: []
regression_of: T-1329
topic: topic-1087
branch: t/T-1339-secrets-environment-s-cancel-case-can
created: 2026-10-26T12:44:47.486Z
updated: 2026-10-26T13:14:51.061Z
closed: 2026-10-26T13:14:51.061Z
---

## Summary

hub/test/secrets-environment.test.ts::"cancelled command with a missing close receipt retains its root until native close and output drain" (T-1329) failed once on macOS at T-1331's merged head ab60aa31, with "expected 'signal handled', actual ''". It passed 5/5 alone on dev 22136129. The child writes its marker with `writeFileSync('stopping', …)`, and the test reads the file as soon as its wait observes the file, which can happen after the file is created but before the bytes are written.

## What to build

Make the child publish the marker atomically (write a temp file and rename it into place), or make the test wait until the marker's content equals the expected text. No product code changes.

## Acceptance criteria

- [x] C1. The named case reads the marker only after its content is complete, shown by a test where the marker file exists before its content, and the case passes 10/10 sequential local runs plus any load-gate repetitions its mode-free verify selects (test).
  - done: impl-1339 · 2026-10-26T12:53:56.918Z
  - verified: rev-26 [reviewer] · run rev-20261026-1339-evidence-1 · 2026-10-26T13:08:41.536Z · commit 0ad9d33e387ea29ba0eac2aad19686307b29c4f4

## Comments

### impl-1339 · 2026-10-26T12:46:25.858Z

Implementation plan: retain the existing T3 owned generic-command seam (no production/shared-contract change). Make the cancellation fixture publish an empty stopping file and hold its content behind a filesystem handshake; assert the receipt remains pending while the file exists, then release content and retain all close/output/root assertions. Red first against the current existence-only watcher, then wait on exact contents. Coordinator revised C1 to ten sequential local case runs without artificial CPU load; mode-free verify supplies whatever additional repetitions it selects.

### impl-1339 · 2026-10-26T12:49:23.803Z

Committed/pushed a67a55d93318e414795cac7d40364ad11b41730a; source review assigned to Reviewer. Local TDD/repetition receipts in A-12401 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12401-t-1339-red-green-and-ten-sequential-local-receipts.md). Darwin arm64 local: ten sequential named-case runs 10/10, touched T3 file 3/3, typecheck and wording lint green. No artificial CPU load/browser/suite gate ran locally. Exact test source blob 7bef520cace1856ef28903efe183fe8743e9ea68. Verification awaits clear source verdict.

### rev-26 · 2026-10-26T12:51:13.582Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1339-source-1
commit: a67a55d93318e414795cac7d40364ad11b41730a
scope: full
findings: [{"severity":"medium","text":"M1: receipt watcher remains active during explicit remove(); new existsSync/readFileSync pairs can race native directory deletion and throw ENOENT from the callback. beforeDirectories disposal occurs later and direct remove() does not run it. Unconditionally dispose/disable observation before releasing removal, or tolerate disappearing markers; retain all byte/close/output/root assertions and demonstrate the same cleanup boundary deterministically. A-12402.","file":"hub/test/secrets-environment.test.ts","line":75}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated full source review complete, one medium Standards finding M1; no additional Spec omissions. The exact-content/empty-file handshake and ten local copied receipts support the intended race repair, but the watcher now reads files while explicit root removal can delete them. A-12402 records the interleaving, helper lifecycle and evidence limits. Fix M1, preserve all assertions, then request refreshed source review at the pushed head before any verification. No Reviewer execution.

Criteria: C1 failed (M1 leaves an unhandled filesystem observation/removal race; fix the lifecycle boundary before configured evidence.).

### impl-1339 · 2026-10-26T12:53:44.257Z

Fixed source finding M1 at pushed 0ad9d33e387ea29ba0eac2aad19686307b29c4f4. Added explicit close-before-release receipt assertion, observed it fail on prior source, then armed/awaited bounded native watcher close in finally before releasing child/root removal. Fresh local Darwin arm64 10/10 sequential case runs, touched T3 file 3/3, typecheck/wording lint/diff check green. Fresh receipt artifact posted. No dev merge after initial review and no suite verification yet.

### rev-26 · 2026-10-26T12:54:37.096Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1339-source-2
commit: 0ad9d33e387ea29ba0eac2aad19686307b29c4f4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; M1 resolved and no remaining Standards/Spec findings. A-12404 audits the complete two-file diff and observer-close ordering: prearmed native close wait, close/clear/await/assert in finally before stdin release and explicit removal, nested finally retains child release/drain on failure. All original exact-byte/pending/native close/output/root assertions remain. A-12403 records fresh ten local named-case passes and the retained M1 red control with explicit platform/scope limits. C1 final verification awaits the same-head configured receipt; claimant must restore its done mark. No Reviewer execution.

### impl-1339 · 2026-10-26T13:08:26.481Z

Mode-free verify 3627439a-c03f-4847-8e26-77eb6b55b5d3 passed at unchanged 0ad9d33e387ea29ba0eac2aad19686307b29c4f4; log A-12411 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12411-suite-3627439a-c03f-4847-8e26-77eb6b55b5d3-auto-at-0ad9d33.log). T0/T1/all fallback T2, changed T3 file once and Web completed: 3409/3409, no failures/skips/cancellations; remaining T3/T4 not run. Named cancelled-command case has an explicit passing finish/timing receipt at 0.037812899s; changed phase 3 passing identities, added wall 2.733s excluding machine wait, no allowance stanzas. No T3 repetitions selected. Linux x64 droplet c-8 lon1, workers 2 (Web phase 4); Chrome Headless Shell 156.0.8078.4, Playwright v1248; Node v24.21.0, Neovim v0.12.5; lifetime 692s, cost $0.0481. Duration budgets and test lint report-only (overages retained); this is task coverage, not full T3/T4 cover. Final evidence review requested. Fresh fetched dev dccf77947 merge-tree conflict check exit 0; head/worktree unchanged.

### rev-26 · 2026-10-26T13:08:41.536Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1339-evidence-1
commit: 0ad9d33e387ea29ba0eac2aad19686307b29c4f4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, C1 verified. A-12412 records independent original A-12411 inspection: run 3627439a-c03f-4847-8e26-77eb6b55b5d3 exits 0, 3409 ordinary passes / 459 files, no failures/cancellations/skips. Exact changed cancellation case passes 0.037812899s; all three changed-T3 identities run once, selected added wall 2.733s excludes machine wait. No actual scoped load repetitions; no T4 or broader T3. A-12403's fresh ten sequential Darwin local receipts and deterministic red controls remain separately attributed to the corrected source blob. Source-2/A-12404 establishes all retained assertions and M1 disposal ordering. Host-gate reuse, browser pin and report-only warnings retained. No integrated cover or Reviewer execution claim; Coordinator owns landing.

Criteria: C1 verified.

### coord · 2026-10-26T13:14:51.061Z

Merged 5feb82e0dd552d4ade2cfe17f854f97cafd6b288 onto dev.
