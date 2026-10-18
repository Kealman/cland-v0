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
updated: 2026-10-18T09:32:30.849Z
---

## Summary

Found by impl-714 on 2026-10-18. `#existingSubmission` in hub/src/hub/suites.ts matches an active run by actor, cwd, head and mode (T-714 adds occasion). It ignores the executor and the size and worker overrides. A stage close needs a Linux droplet run and a macOS local run at one tree. If the Coordinator submits `--occasion stage --executor local` while the stage droplet run is still active, it gets the droplet run back instead of separate macOS evidence. The next stage close is E-677 stage 3, today.

## Acceptance criteria

- [x] C1. A T1/T2 test submits the same head as a stage droplet run and then a stage local run while the first is active, and gets two distinct runs. A repeat of either submission returns its own run. The test fails before the fix.
  - done: impl-792 · 2026-10-18T09:32:06.952Z
- [x] C2. Executor, size and worker overrides are part of the dedup identity; T-770's same-request idempotency is otherwise unchanged.
  - done: impl-792 · 2026-10-18T09:32:12.598Z

## Comments

### impl-792 · 2026-10-18T09:31:25.736Z

C1 red confirmed before production changes: stage droplet then local submission returned the same run id (assert.notEqual failed). Regression is T1 at Suites.start using suiteUnit semantic executors/fake clock, with no real processes. Fix is confined to #existingSubmission: search matching caller/base requests, compare requested executor, size and workers overrides, and retain different-head/mode refusal.
