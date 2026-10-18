---
id: T-800
kind: task
title: The delivered suite result is cut at about 8 KiB by per-file test-lint tier lines, so the per-tier and tier-share lines never reach the reader
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
regression_of: T-684
topic: topic-506
branch: t/T-800-the-delivered-suite-result-is-cut-at
created: 2026-10-18T12:11:23.483Z
updated: 2026-10-18T12:23:27.749Z
---

## Summary

Found by qa-676 in E-676's demo (run qa-2026-10-18-1, criterion C2). Task run 01a2956c's log A-5256 has every report line. The suite result message delivered to the requester stops at about 8 KiB, in the middle of `test lint tie…`. It carries zero `tier T1…T4` lines and zero `tier share` lines, because a few hundred per-file `test lint tier: <file>: Tn; qualifies Tm` lines and the per-finding lint lines come first. Every suite result delivered today is cut the same way.

## Acceptance criteria

- [x] C1. A delivered suite result puts the run summary, the per-tier lines, the tier-share line, the test-lint summary and the budget would-fail lines before any per-file or per-finding detail, and stays within the delivery limit. A T2 report test with a repository-sized manifest and findings proves it, and fails before the fix.
  - done: impl-800 · 2026-10-18T12:22:06.908Z
- [x] C2. Per-file `test lint tier` lines and individual lint findings appear only in the log artifact, with one summary line in the message (counts plus the artifact id). Findings that refuse a run are still named in full.
  - done: impl-800 · 2026-10-18T12:22:07.443Z
- [x] C3. A dry-run and an integrated run at the fixed head show the same ordering.
  - done: impl-800 · 2026-10-18T12:17:18.565Z

## Comments

### impl-800 · 2026-10-18T12:12:44.692Z

Regression seam: T2 suite-protocol.test.ts observes a recovered, seeded integrated suite receipt through projectHub + the real socket message, using repository-sized tier entries and lint findings. Will assert complete priority summary below 8192 bytes, one detail count/log-id pointer, and original detail in the artifact. No new process or wall-clock waits.

### impl-800 · 2026-10-18T12:16:52.983Z

Implementation pushed at c226fc2676b77936a8da2c00bcdaeb368e40ae04 after merging origin/dev 1d67e5a6. A-5261 records serial targeted passes and T2 delivered report proof (377 manifest files; 27079 log bytes -> 1059 message bytes). Final test:lint and typecheck passed. Dry-run ordering proved at this source by real CLI fixture; integrated receipt ordering proved by T2 socket fixture. C3's live integrated dev evidence remains for Coordinator's batch/demo path; no unauthorized full run submitted. Requesting source review before one mode-free droplet task verify.

### rev-31 · 2026-10-18T12:18:25.089Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-800-source-1
commit: c226fc2676b77936a8da2c00bcdaeb368e40ae04
scope: full
findings: [{"severity":"medium","text":"Normal-cap overflow still selects a cached fallback without any summary; uncached fallback restores metadata before summary, so large missing-baseline diagnostics can drop required priority information.","file":"hub/src/hub/dispatch.ts","line":707}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-800 source review

Commit: c226fc2676b77936a8da2c00bcdaeb368e40ae04
Fixed base: origin/dev 1d67e5a6
Run: rev-20261018-800-source-1
Scope: full
Result: not clear

Reviewed task C1–C3, six-file task diff, suiteSummary, result publication and byte-cap fallbacks, durationBudgetSummary, testLintReport, dry-run composition, new/changed T2 controls and existing tiny-cap coverage. No Reviewer test execution or edits.

## Standards
No findings. The new public socket regression uses projectHub, FakeClock and a seeded completed receipt; it adds no child process or wall-clock wait. The tests preserve named admission refusals and artifact detail. A-5259 records the original missing-tier red; A-5261 reports final-source targeted passes and host checks.

## Spec
Medium M1 — hub/src/hub/dispatch.ts:707 (C1/C2): the overflow fallback still drops the required result summary. After the normal report cannot fit even with deciding-file paths removed, the cached branch emits no summary at all; the uncached branch puts optional execution/selection metadata before it again and relies on prefix truncation. This remains reachable after the lint-detail fix because durationBudgetSummary retains every missing-baseline diagnostic and other summary diagnostics remain unbounded. A repository-sized missing-baseline report can therefore lose tiers/share/lint counts and the new detail-count/artifact pointer. The new regression has one budget diagnostic and fits the normal branch, so it does not test this path.

The Implementer confirms there is no tested guarantee (b22d5ef5-fedd-4470-9d28-0adc2fce7332) and will add cached and uncached oversized-result controls, preserve priority summary and log id ahead of optional metadata, and retain the original detail in the artifact. Preserve the existing explicitly tiny-cap behaviour where all summaries cannot physically fit; the missing requirement here is the normal delivery cap with realistic large diagnostics. Obtain fresh source review at the corrected head before verification.

The ordinary-path composition is otherwise aligned: counts then tiers/share, lint census and budget summaries; per-file lint tiers/findings removed from delivered results and retained in the artifact; dry-run puts summaries ahead of detail. Existing refusal code is unchanged.

Independently read Coordinator decision 7cb99af1-1d14-4459-8467-47eb9c8cfabd: C3 ticket evidence is fixed-source real dry-run plus the T2 integrated-receipt ordering proof, not an unauthorized live full run. Live integrated/restarted-hub and E-676 C2 proof remains Coordinator-owned after merge. This disposition does not waive the overflow gap.

C1/C2 fail the remaining overflow publication boundary. C3 remains unverified pending corrected-source tests and exact-head task evidence. No task verification authorized at this superseded head.

Standards: zero findings. Spec: one medium finding.

Artifact A-5266.

Criteria: C1 failed (Oversized cached-result fallback omits all priority summaries; normal-cap overflow is not covered by the new test.), C2 failed (Overflow fallback can discard lint counts and the detail-count/log artifact pointer despite retaining raw artifact detail.).

### impl-800 · 2026-10-18T12:22:08.144Z

M1 fixed at be1d7cd6fe7d704ed45444ca1a45c3052ff828c1, pushed without another dev merge. A-5270 captures overflow red; A-5272 documents correction and serial validation. Cached/fresh fallback tests retain ordered summary + log id (1220/1167 bytes from 39862-byte log with 400 missing-baseline lines). Tiny-cap controls, real dry-run ordering, budget summary T1 tests, typecheck and lint pass; suite-check 3/3 3.097s and suite-tier-report 4/4 .377s also pass at corrected head. Requesting renewed source review; no verify yet.

### rev-31 · 2026-10-18T12:23:05.064Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-800-source-2
commit: be1d7cd6fe7d704ed45444ca1a45c3052ff828c1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-800 corrected source review

Commit: be1d7cd6fe7d704ed45444ca1a45c3052ff828c1
Fixed base: dev 1d67e5a6
Run: rev-20261018-800-source-2
Scope: full
Result: clear

Inspected the corrected diff against c226fc26 and complete task diff against the fixed dev parent. Origin matches the requested commit; its parent is c226fc26, with no dev merge after source-1. No Reviewer tests or edits.

## Standards
No findings. New overflow controls remain T2 with one projectHub fixture, real socket messages, FakeClock, planted completed receipts and filesystem artifacts; no new process or wall-clock wait. The new missing-baseline summary control is T1. Existing refusal and tiny-cap tests retain their meaning. No allowances or tier changes.

A-5270 records the pre-correction overflow failure (optional metadata preceded priority summary). A-5272 reports fresh/cached corrected output at 1167/1220 bytes from a 39862-byte log containing 400 missing diagnostics, with a >9000-byte branch forcing compact publication. Repository-sized lint regression remains green. Targeted files passed serially: protocol 10/10 2.534 s; duration-budget 7/7 .376 s; dry-run 4/4 4.001 s; selection-report 4/4 18.351 s including 384/768-byte caps; check 3.097 s and tier-report .377 s reported green. Typecheck/lint/diff checks pass. No task receipt yet.

## Spec
Prior M1/C1–C2 resolved. durationBudgetSummary now collapses missing-baseline diagnostics to a count, keeping ranked overages and legacy/ratchet summaries. Raw run-suite logging still writes every original diagnostic. The detail-count/artifact pointer belongs to the primary summary. When a normal report overflows, both cached and fresh branches use the same priority-only summary before optional branch/execution/selection metadata and preserve the log id. The existing explicitly tiny-cap fallback remains only when the required summary itself cannot fit.

The new paired receipt test asserts ordered counts, all tiers/share, lint census and budget, detail count/log id, byte cap, optional metadata after required lines and artifact retention of all 400 diagnostics. The original repository-sized lint-detail test retains every reported lint line in the artifact. Dry-run still orders tier/share/lint/budget ahead of per-finding/tier detail. Admission refusal code is unchanged; supplemental refusal checks retain exact codes and finding text.

Coordinator 7cb99af1-1d14-4459-8467-47eb9c8cfabd explicitly accepts fixed-source real CLI dry-run plus T2 integrated-receipt ordering as C3 ticket evidence. Live first integrated cover after hub restart and E-676 C2 demo remain Coordinator-owned after merge; this review does not claim that live proof already exists.

C1–C3 source design and controls are clear; all remain unverified until the exact-head post-source-clear task result. No remaining finding; no per-item QA. One mode-free task droplet verification may proceed under the Coordinator's existing direction.

Standards: zero findings. Spec: zero findings.

Artifact A-5275.

### impl-800 · 2026-10-18T12:23:27.749Z

After source-clear rev-20261018-800-source-2 (A-5275), submitted mode-free droplet verify 40dc82a6-b095-4925-b518-1d48b5ce77d6 at exact clean reviewed head be1d7cd6fe7d704ed45444ca1a45c3052ff828c1. Recipients reviewer and impl-800, topic-506. No head changes or further dev merges; waiting for hub result.
