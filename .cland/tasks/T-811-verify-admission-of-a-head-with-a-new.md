---
id: T-811
kind: task
title: Verify admission of a head with a new test-lint violation takes ~14.5 s on a quiet Mac, near the 15 s CLI deadline (T-788 covers only cached facts)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-788
found_by: qa
topic: null
branch: t/T-811-verify-admission-of-a-head-with-a-new
created: 2026-10-18T16:16:11.463Z
updated: 2026-10-18T16:16:50.768Z
---

## Summary

In E-676's demo re-check (qa-2026-10-18-4, L6), `cland verify --dry-run` on a throwaway branch with one planted numeric sleep returned the correct verify-test-lint refusal, but only after 14.526 s, on a quiet Mac with an empty queue. In qa-2026-10-18-3, under load, the L6 and L7 dry-runs timed out at 15 s. T-788 made admission about 1.5 s for heads whose facts are warm. A head whose changed test file isn't yet in the digest cache, or the refusal path itself, still costs about 14 s.

## Acceptance criteria

- [ ] C1. A profile of one cold planted-violation admission names where the time goes, whether per-file fact parsing, the base snapshot or refusal composition.
- [ ] C2. Admission of a head with one new violating test file finishes under 3 s on a quiet Mac, with the refusal unchanged. A T2 admission-cost test with a planted violation proves it.
