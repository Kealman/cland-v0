---
id: T-610
kind: task
title: reduceCoverage crashes with ENOENT when two test owner processes reuse one pid on macOS
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - bug
  - hub
  - test
assignee: null
parent: R-577
blocked_by: []
regression_of: T-394
topic: topic-380
branch: t/T-610-reducecoverage-crashes-with-enoent-when
created: 2026-10-16T14:24:16.825Z
updated: 2026-10-16T16:19:17.523Z
closed: 2026-10-16T16:19:17.522Z
---

## Summary

The v0.1.3 macOS release run c7e3ba4e at 098e6f5a (A-3923) passed all 2341 tests, then exited 1 in `reduceCoverage` (hub/src/suite-coverage.ts:126). The error was `ENOENT: rename …/coverage-map.json.raw/coverage-76427-…-0.json -> …/<merge-checkout.test.ts dir>/…`. The reduction lists the raw receipts once and claims them per test file by `coverage-<owner pid>-` prefix. Over a 20-minute run, macOS reused pid 76427 for two test files' owner processes, so the first file had already moved the other's receipt. The coverage map is a by-product used for selection, yet it turned a fully green run red. The human accepted A-3923 as C6's macOS half for v0.1.3 (ask 97b62790) and asked for this fix in v0.1.4.

## Acceptance criteria

- [x] C1. Receipts are assigned to a test file by an identity that survives pid reuse (owner pid together with its start time, or the receipt's timestamp window), and a receipt already claimed is never renamed twice.
  - done: impl-610 · 2026-10-16T15:51:30.911Z
  - verified: rev-30 [reviewer] · run rev-20261016-610-source · 2026-10-16T15:52:59.694Z · commit dd45206ecc0d1cf18ac9f347e64b1408bc684451
  - verified: rev-30 [reviewer] · run rev-20261016-610-final · 2026-10-16T16:18:50.863Z · commit dd45206ecc0d1cf18ac9f347e64b1408bc684451
- [x] C2. A missing or unclaimable receipt is logged with its name and never changes the run's exit, as T-604 did for unparsable JSON.
  - done: impl-610 · 2026-10-16T15:51:31.319Z
  - verified: rev-30 [reviewer] · run rev-20261016-610-source · 2026-10-16T15:52:59.694Z · commit dd45206ecc0d1cf18ac9f347e64b1408bc684451
  - verified: rev-30 [reviewer] · run rev-20261016-610-final · 2026-10-16T16:18:50.863Z · commit dd45206ecc0d1cf18ac9f347e64b1408bc684451
- [x] C3. A test plants two owner.json files with the same pid and different start times beside their receipts, and the reduction assigns each receipt to its own test file.
  - done: impl-610 · 2026-10-16T15:51:31.709Z
  - verified: rev-30 [reviewer] · run rev-20261016-610-final · 2026-10-16T16:18:50.863Z · commit dd45206ecc0d1cf18ac9f347e64b1408bc684451

## Comments

### impl-610 · 2026-10-16T15:50:01.960Z

Reproduced C3 with a direct reduceCoverage fixture: two owner.json files, PID 42, starts 900/1900, receipts at 1000/2000, reversed test order. Before fix: ENOENT renaming coverage-42-1000-0.json; after timestamp routing: pass. Bootstrap now records started milliseconds; reducer visits each raw receipt once and routes it to the latest same-PID start at/before the V8 write timestamp.

### impl-610 · 2026-10-16T15:51:32.151Z

Committed and pushed dd45206ecc0d1cf18ac9f347e64b1408bc684451 after fetching/merging origin/dev af78bc39. At this exact head: npm run typecheck exit 0; node --test hub/test/suite-coverage.test.ts exit 0 (2/2; new PID-reuse regression 15.639 ms, package proof 3.227 s). Package proof now checks missing/unclaimable/rename-refused receipts and successful exit alongside T-604 truncated JSON. Source review requested next; no separate QA required by task policy.

### rev-30 · 2026-10-16T15:52:59.694Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-610-source
commit: dd45206ecc0d1cf18ac9f347e64b1408bc684451
scope: full

# T-610 source review clear

Reviewed pushed `dd45206ecc0d1cf18ac9f347e64b1408bc684451`, branch `t/T-610-reducecoverage-crashes-with-enoent-when`; local/origin refs agree. Fixed point/fetched dev merge base `af78bc399450a6dee2788b23433bc6ddf7f0dbcc`; captured three-dot diff and single implementation commit. Three-file scope63insertions/13deletions; T-604 present. Took hold and read claimant/C1–C3 done/QA scope none. Direct read-only source/spec review, no subagents.

## Standards

Zero high/medium/low findings. Ownership handling stays in existing coverage reducer/bootstrap; no general process registry or runner-wide exception suppression. New per-file diagnostic helper is reused for owner/claim/list/read failures. Existing T-604 malformed-JSON path/byte logging and valid coverage reduction are preserved. Whitespace check passes.

Bootstrap adds a wall-clock millisecond started field at the test's initial import, alongside existing PID and inherited per-test directory assignment. It does not infer identity from reduction time. New reducer reads all owner records before routing, validates pid/started safe integer bounds, then traverses root receipt names once. Candidate selection is independent of caller test order: same PID, start<=V8 filename timestamp, highest start first. A tie at the highest start is logged/skipped, not resolved by arbitrary input order. Single root traversal eliminates the old per-test repeat rename; a failed rename is diagnosed and not retried by another owner.

## Spec / C1 and C2 source verified

C1: latest-start timestamp windows partition reused PIDs for observed owner processes; two same-PID owners cannot steal each other's earlier receipts. Successfully claimed receipts move once to the selected owner directory. Ambiguous or nonconforming/unmatched names retain named unclaimable diagnostics. Existing per-test descendant receipts remain intrinsically attributed by their directory.

C2: missing/malformed owner metadata, absent per-test directories, missing/unreadable receipt files and rename failures now produce named stderr diagnostics and skip instead of failing reduction. Owners with no claimed root receipt get a named coverage-pid wildcard missing-receipt diagnostic. This is scoped to coverage receipt discovery/claim/read; it does not promise masking source-map/offset errors or every possible root-directory I/O failure. Existing caller returns test/budget/load failures before reduction, so these ancillary receipt paths do not convert real failing tests to success.

Raw JSON syntax failure still reports actual byte size as T-604 required. Coverage selection/map semantics and valid-function attribution remain unchanged. Search of owner.json/bootstrap/reducer references finds the producer/consumer updated together; legacy owner metadata lacking start becomes a named skip rather than PID-only attribution.

## C3 test / targeted evidence

New deterministic direct reducer fixture plants two owner.json records with PID42, starts900/1900 and root receipts1000/2000, with first/second function coverage disjoint. It supplies tests in reversed order, asserts exact distinct function→test mapping and confirms each receipt's proper destination. This would expose both old cross-attribution and double-rename behavior, not merely swallow ENOENT.

Existing real-package capture proof keeps successful exec exit/valid CLI-daemon-spoke attribution/import-only negative checks and T-604163840-byte malformed JSON. Added dangling receipt symlink asserts named ENOENT; unclaimable raw name asserts skip; a directory obstructing the target rename asserts named error. The real package must still return success and emit valid map, so diagnostics alone are insufficient to pass.

**A-3933** durable evidence note reports before-fix direct reused-PID regression exact double-rename ENOENT; corrected full coverage file2/2 green3.662s (new15.639ms,package3.227s), exact-head root typecheck0 and diff check clean. This is a summary note, not a separate raw-log bundle. I read every committed assertion and caller status flow; Reviewer executes no tests/compiler/process/provider operations.

Source **clear**, verify **C1/C2** from source, leave **C3/final runtime** pending fresh **no-mode exact-head cland verify** evidence, including new identity repetitions as selected by gate policy. No per-item QA/full local suite requested. Any changed head requires delta review before another verification. Report/fixes/retries remain with lead T-610.

Findings: Standards0; Spec0. Source clear, C1/C2 verified; C3 final pending.

Artifact A-3936 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3936-t-610-source-clear-timestamp-ownership-and-nonfatal-receipt-diagnostics.md

Criteria: C1 verified, C2 verified.

### impl-610 · 2026-10-16T16:17:05.979Z

Same-head verification 3ac0e804-a483-4057-8585-a50a9e90ed9b at dd45206ecc0d1cf18ac9f347e64b1408bc684451 passed (auto/hub-only, Linux c-8 droplet): exit 0; 1961 tests, 1956 pass, 5 skipped, zero failures/cancellations; load-gate repetitions included. Durable suite evidence A-3990: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3990-suite-3ac0e804-a483-4057-8585-a50a9e90ed9b-auto-at-dd45206.log. Reviewer received result directly; waiting for final same-head verdict. Source unchanged.

### rev-30 · 2026-10-16T16:18:50.863Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-610-final
commit: dd45206ecc0d1cf18ac9f347e64b1408bc684451
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-610 final evidence review

Commit dd45206ecc0d1cf18ac9f347e64b1408bc684451, unchanged from rev-20261016-610-source / A-3936. Local and origin task tips agree.

## Standards
No findings. No source delta; one-pass receipt claiming, start-time attribution and named best-effort read/move diagnostics remain covered by source review.

## Spec
C3 execution established by exact-head post-source-review droplet 3ac0e804-a483-4057-8585-a50a9e90ed9b / A-3990. The reused-PID/two-owner regression passes ordinarily (52.341892 ms) and in all five fresh load repetitions. The real package capture regression also passes ordinarily (6.921464206 seconds) and 5/5 repetitions. These retain exact attribution and successful-exit checks beside missing, unclaimable, failed-move and malformed receipts.

Independently checked raw phase summaries: hub free 38/38; hub machine 1906 pass, zero failures and five skips out of 1911; Neovim smoke 12/12. Overall 1961 tests, 1956 pass, zero failure/cancellation, five recorded platform/binary prerequisite skips, Finished exit 0. The skip list names two macOS sandbox cases, the macOS sleep inhibitor, absent real OpenCode P3 and absent real OpenCode orphan sweep; no owned coverage case is skipped. Host and remote typechecks complete. No hard duration or load-gate failure; existing-entry duration notices are diagnostic.

Receipt records Linux x64, c-8 lon1, four workers, suite wall 1310.59 seconds, peak load 12.38. Lifetime/cost are unknown in the delivery and are not inferred.

C1/C2 source verification remains current; C3 and final execution now verified. All claimant done marks were present at final read. Standards 0 findings; Spec 0 findings. Final clear, no further run required.
Artifact: A-3994 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3994-t-610-final-clear-same-head-coverage-ownership-regressions-and-suite-green.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-16T16:19:17.522Z

Merged bd25acf456537f5bc22fdb0bcfbcea7dfdb67460 onto dev.
