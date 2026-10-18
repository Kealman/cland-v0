---
id: T-792
kind: task
title: Active verify deduplication ignores the executor, so a stage's local macOS run returns the active droplet run
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-770
topic: topic-501
branch: t/T-792-active-verify-deduplication-ignores-the
created: 2026-10-18T09:28:59.283Z
updated: 2026-10-18T09:37:42.250Z
---

## Summary

Found by impl-714 on 2026-10-18. `#existingSubmission` in hub/src/hub/suites.ts matches an active run by actor, cwd, head and mode (T-714 adds occasion). It ignores the executor and the size and worker overrides. A stage close needs a Linux droplet run and a macOS local run at one tree. If the Coordinator submits `--occasion stage --executor local` while the stage droplet run is still active, it gets the droplet run back instead of separate macOS evidence. The next stage close is E-677 stage 3, today.

## Acceptance criteria

- [x] C1. A T1/T2 test submits the same head as a stage droplet run and then a stage local run while the first is active, and gets two distinct runs. A repeat of either submission returns its own run. The test fails before the fix.
  - done: impl-792 · 2026-10-18T09:32:06.952Z
- [x] C2. Executor, size and worker overrides are part of the dedup identity; T-770's same-request idempotency is otherwise unchanged.
  - done: impl-792 · 2026-10-18T09:32:12.598Z
  - verified: rev-31 [reviewer] · run rev-20261018-792-source · 2026-10-18T09:37:42.250Z · commit b8af39970c139bb6c3699b784fe835c811febab2

## Comments

### impl-792 · 2026-10-18T09:31:25.736Z

C1 red confirmed before production changes: stage droplet then local submission returned the same run id (assert.notEqual failed). Regression is T1 at Suites.start using suiteUnit semantic executors/fake clock, with no real processes. Fix is confined to #existingSubmission: search matching caller/base requests, compare requested executor, size and workers overrides, and retain different-head/mode refusal.

### rev-31 · 2026-10-18T09:37:42.250Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-792-source
commit: b8af39970c139bb6c3699b784fe835c811febab2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review at b8af39970c139bb6c3699b784fe835c811febab2, fixed base 48bc5391f957be8baa445cc02b265e525509195c. Read-only review; no Reviewer test execution.

## Standards
No findings. Two regressions reuse suiteUnit's T1 FakeClock and semantic executor receipts, with no real processes or waits. The production change is confined to #existingSubmission; no persistence schema, policy or execution behavior is added.

## Spec
No findings. Deduplication first narrows active jobs by captured caller identity and the existing cwd/head/mode submission key. It searches all matching active jobs for the exact requested executor, size and workers override. A different requested override creates a separate run; exact retries find their own run even when it is not the first active job. Changed-head/mode requests remain refused when no owned request has the existing base key.

Requested identity uses followsConfig/requestedExecutor and workersOverride, not effective executor/workers. Configuration refresh/fallback can therefore retain request identity. Reviewed all three #existingSubmission call sites, including the last synchronous authorization/dedup/persistence fence for overlapping retries.

Tests retain stage droplet/local distinct IDs and retry identity for both, default versus explicit executor/workers/size, multiple override values, scheduler reopen, and changed head/mode refusal. A-5133 records the pre-fix distinct-ID failure and corrected suite-stage-rules 6/6 (1.012s), plus verify-submission 4/4 (1.397s); request reports final typecheck/lint/diff checks green.

C2 verified by source. C1 remains pending exact-head post-source-clear mode-free task verification. No per-item QA required and no final execution verdict yet.

Standards: 0 findings. Spec: 0 findings.
Artifact A-5147.

Criteria: C2 verified.
