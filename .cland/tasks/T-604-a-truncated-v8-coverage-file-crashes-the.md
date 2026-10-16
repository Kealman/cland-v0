---
id: T-604
kind: task
title: A truncated V8 coverage file crashes the integrated runner's coverage reduction after every test passed
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-373
branch: t/T-604-a-truncated-v8-coverage-file-crashes-the
created: 2026-10-16T11:49:13.864Z
updated: 2026-10-16T11:52:36.861Z
---

## Summary

The v0.1.3 release run 24b2df33 at 62a434cd, shard-1 (A-3894, Linux c-8), passed every test: the hub machine shard took 786 s, with 0 failures. The runner then exited 1 in `reduceCoverage` (hub/src/suite-coverage.ts:130). It got `SyntaxError: Unterminated string in JSON at position 163840`, from run-suite.ts:194. The file was cut at exactly 160 KiB, most likely a child's NODE_V8_COVERAGE output that was still being written or was killed mid-write. The coverage map for selection is a by-product of the run, so one unreadable file should not turn a green integrated run red.

## Acceptance criteria

- [x] C1. reduceCoverage skips a coverage file that does not parse, names it and its size in the log, and the run's exit stays the tests' exit.
  - done: impl-604 · 2026-10-16T11:51:25.010Z
  - verified: rev-30 [reviewer] · run rev-20261016-604-source · 2026-10-16T11:52:36.861Z · commit 897c65d26aeabfa97cd61402e8348226396e1572
- [x] C2. A test plants a truncated coverage JSON beside a valid one, and the reduction keeps the valid file's functions and reports the skipped one.
  - done: impl-604 · 2026-10-16T11:51:25.354Z

## Comments

### impl-604 · 2026-10-16T11:51:25.685Z

Implemented at 897c65d26aeabfa97cd61402e8348226396e1572; pushed task branch. Regression reproduced original parse crash after green fixture tests, then passed with the narrow parsing catch. Coverage-map publication targeted test and hub typecheck also pass. Evidence artifact is posted in topic-373. Awaiting source review before mode-free cland verify; merge conditional on release resubmit outcome.

### rev-30 · 2026-10-16T11:52:36.861Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-604-source
commit: 897c65d26aeabfa97cd61402e8348226396e1572
scope: full

# T-604 source review clear

Reviewed pushed `897c65d26aeabfa97cd61402e8348226396e1572`, branch `t/T-604-a-truncated-v8-coverage-file-crashes-the`; local/origin refs agree. Fixed point/merge base `0e2a0aee87771bc8b3d2f0aa1d548ffa1ca8a7f2`; captured three-dot diff and single implementation commit. Hold/current claimant/C1–C2 done and QA scope none checked. Exactly two files,11insertions/2deletions.

## Standards

Zero high/medium/low findings. Narrow catch encloses only per-receipt JSON.parse at suite-coverage.ts:133–138. Reads actual Buffer bytes, logs full joined path and Buffer.length (byte count, not UTF-16 character count), then continues to the next matching coverage receipt. Valid reduction loop and coverage map structure remain unchanged. Missing owner/receipt, filesystem errors, malformed parsed schema and source-offset errors are not silently suppressed by a runner-wide catch.

Regression extends the existing real-process package capture proof, retaining CLI/daemon/spoke/fake attribution and import-only negative assertion. A renamed test describes the new behavior; no production seam or test helper is introduced. Whitespace diff check passes. No Fowler-baseline or documented-standard finding.

## Spec / C1 source verified

Malformed coverage-*.json cannot propagate its parse SyntaxError: the reducer emits `suite coverage: skipping <path> (<actual bytes> bytes): invalid JSON` and retains valid input processing. Caller run-suite.ts:189 already returns failing test code before coverage reduction, and budget/load failures likewise return1; successful phases reach reduction at194 and return0 at198. Thus this narrow catch removes the green-tests→parse-crash regression without replacing genuine failing test status with success. It does not promise recovery from unrelated I/O/map-write/valid-JSON-schema errors, which are outside C1's parse failure.

## Spec / C2 regression and local evidence

suite-coverage.test.ts retains real runPackageSuite boundary. Its generated lifecycle test first checks valid real raw contributors, then plants **coverage-0-truncated.json exactly163840bytes** beside them. Outer execFile requires successful package exit; assertions require diagnostic path/byte count, emitted coverage map, valid CLI/daemon/spoke functions attributed to the owning test, and no import-only smoke misattribution. The test makes no directory-order guarantee; regardless of enumeration order, the emitted map must retain valid contributors while reporting the invalid receipt.

**A-3896** durable evidence note reports exact red: all5 nested fixture tests green followed by the original163840-byte Unterminated-string parse error/exit1; corrected whole coverage file1/1 green2.50s. Existing integrated publication case1/1 green5.46s and hub typecheck/diff checks green. These are summarized results, not a separate raw-log bundle. I inspected committed assertions and runner status flow directly; Reviewer executes no tests/compiler/binary/edits.

Searched relevant coverage reduction/publication references across hub/test, including selection, close/cache and publication seams; no adjacent production selection rule changed. Source C1 verified; C2 and final runtime verification await the fresh **no-mode exact-head cland verify** receipt, including the renamed regression's new-test repetitions when selected by manifest policy. No new full local suite/per-item QA requested.

Source **clear**, C1 verified, C2 final pending. Any changed head requires delta review before verification. Conditional release merge/retry timing stays with Coordinator; this source verdict does not change it. Findings: Standards0; Spec0.

Artifact A-3898 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3898-t-604-source-clear-malformed-receipt-skip-and-order-independent-regression-audit.md

Criteria: C1 verified.
