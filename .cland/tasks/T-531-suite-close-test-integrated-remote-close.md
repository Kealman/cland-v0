---
id: T-531
kind: task
title: "suite-close test: integrated remote close counts 24 coverage-map scp calls, not 2 (Linux)"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-394
topic: topic-326
branch: t/T-531-suite-close-test-integrated-remote-close
created: 2026-10-15T20:54:23.323Z
updated: 2026-10-15T21:08:57.101Z
---

## Summary
In E-387 stage-close run 7d5ac27f (shard 1, droplet cland-v0-2df7755a, c-8 lon1, peak 1m load 10.8; log A-3341), `hub/test/suite-close.test.ts:12`, 'integrated remote close collects each map before release and publishes their function union', failed at :33. Its assertions on the result, the artifact and the union passed. It found 24 `scp` lines naming `coverage-map.json` in `machine-calls.jsonl` where it expects 2. Either the collection retries or polls scp under load (each try is logged), or the fake machine's call log is shared with a concurrent case. The count assertion is T-394's; T-517 is a different suite-close flake (:82, active lease).

## Acceptance criteria
- [x] C1. Find which it is and record it in a comment. If collection retries by design, the test counts successful collections per shard, or distinct shard paths, rather than raw scp lines. If the retries are unintended, the hub copies each map once, as a product fix. Every other assertion stays.
  - done: impl-531 · 2026-10-15T21:04:28.094Z
  - verified: rev-30 [reviewer] · run rev-20261015-531-source · 2026-10-15T21:08:57.101Z · commit a85c91359c65ede6ae0c6f0dbb9625cfd9b8366f
- [ ] C2. The file passes 5/5 targeted runs, on Linux (droplet verify) or under Mac load.

## Comments

### impl-531 · 2026-10-15T21:03:54.490Z

C1 diagnosis: neither repeated map collection nor a shared fixture log caused the inflated count. fake-machine.ts records {mode,args,faults,env}; the assertion searches each entire JSON line for both coverage-map.json and scp. Integrated coverage passes NODE_V8_COVERAGE ending in coverage-map.json.raw to test descendants, and the fake environment also names the SCP binary. Consequently unrelated SSH calls and non-map SCP uploads all match. Each fixture has its own fake API stateRoot.

Feedback loop: NODE_V8_COVERAGE=<private scratch>/coverage-map.json.raw node --test --test-name-pattern='integrated remote close collects each map' hub/test/suite-close.test.ts. It deterministically failed 28 !== 2 on Mac (baseline same case passed). A temporary diagnostic parsed the same records: 28 matching raw lines, 10 actual SCP operations, exactly 2 coverage-map downloads. No environment contents were printed. Varying the SSH poll count explains why the Linux receipt found 24 instead of 28. Collection itself is once per shard; no product fix is needed. Fix the test to parse mode and remote source path, keeping the exact two-download assertion and all result/artifact/union/resource assertions.

### rev-30 · 2026-10-15T21:08:57.101Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-531-source
commit: a85c91359c65ede6ae0c6f0dbb9625cfd9b8366f
scope: full

Source review T-531 clear at a85c91359c65ede6ae0c6f0dbb9625cfd9b8366f, parent dev968b7eb8. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

C1 verified: diagnosis on the item and A-3357 establishes neither collection retries nor shared fixture state caused the inflated count. The fake records structured mode/args plus environment. NODE_V8_COVERAGE ends in coverage-map.json.raw and logged SCP executable metadata supplies the other substring, so whole-line matching counts unrelated SSH/SCP records. Deterministic reproduction reports28 raw matches,10 actual scp calls, exactly2 map downloads, then fails28!=2. No environment payload is exposed in the published reproduction.

The five-addition/one-deletion test-only correction parses JSONL and counts mode==='scp' with a complete remote source path runner@<address>:runs/<run>/coverage-map.json at args[-2]. Immutable Machine.get appends [remoteSource, localDestination] after options; collectCoverage requests this exact path. Thus uploads, commands, environment values and .raw paths cannot satisfy the predicate. Exact download count2 is retained. Result exit, coverage artifact count, head, both shard test files/function union, empty droplet/key assertions all remain unchanged. No product path, test name, retries, shared fixture or timeout change.

Standards: local typed record projection matches the existing fake log contract; strict parse fails malformed records instead of silently omitting them. Whitespace check clear. Typecheck reported green. Source scope is one file; no new test or duration baseline entry is introduced.

C2 UNVERIFIED: A-3365 reports only the first complete corrected coverage-instrumented file7/7,49.156s. It does not establish five whole-file repetitions. Complete the remaining serial admitted runs under the Coordinator's current load/window rules and preserve the reproducing coverage environment, then attach their full receipts. One exact-head post-source verification is also required before final suite clearance; preserve actual executor/platform. No per-item QA criteria.

Evidence A-3357 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3357-t-531-deterministic-coverage-environment-reproduction.log; A-3365 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3365-t-531-source-review-evidence.md. No Reviewer tests, edits, merges or provider actions.

Criteria: C1 verified.
