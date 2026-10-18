---
id: T-811
kind: task
title: Verify admission of a head with a new test-lint violation takes ~14.5 s on a quiet Mac, near the 15 s CLI deadline (T-788 covers only cached facts)
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-788
found_by: qa
topic: topic-516
branch: t/T-811-verify-admission-of-a-head-with-a-new
created: 2026-10-18T16:16:11.463Z
updated: 2026-10-18T16:27:05.681Z
---

## Summary

In E-676's demo re-check (qa-2026-10-18-4, L6), `cland verify --dry-run` on a throwaway branch with one planted numeric sleep returned the correct verify-test-lint refusal, but only after 14.526 s, on a quiet Mac with an empty queue. In qa-2026-10-18-3, under load, the L6 and L7 dry-runs timed out at 15 s. T-788 made admission about 1.5 s for heads whose facts are warm. A head whose changed test file isn't yet in the digest cache, or the refusal path itself, still costs about 14 s.

## Acceptance criteria

- [x] C1. A profile of one cold planted-violation admission names where the time goes, whether per-file fact parsing, the base snapshot or refusal composition.
  - done: impl-811 · 2026-10-18T16:27:03.817Z
- [x] C2. Admission of a head with one new violating test file finishes under 3 s on a quiet Mac, with the refusal unchanged. A T2 admission-cost test with a planted violation proves it.
  - done: impl-811 · 2026-10-18T16:27:04.589Z

## Comments

### impl-811 · 2026-10-18T16:27:05.547Z

Implemented immutable tier blob batching using the unchanged policy batch reader, shared through git-tree-sources.ts. Corrected the T-788 performance fixture's all-T2 manifest and ls-tree output to exercise real T1 admission. T2 cold new-violation admission: red 4150 modeled ms/65 foreground shows -> green 1200 ms/4 shows, unchanged refusal and no queue reservation. Native-Git candidate comparison after dev warming: 3.389 s before -> 0.817 s after; final merged head e0a38e7f 1.442 s. Profile/evidence artifact posted in topic-516. Host lint/typecheck pass; serial targeted cost 6/6 (2.773 s), tiers 13/13 (1.170 s), lint 30/30 (2.036 s), admission 7/7 (30.800 s). Fetched and merged origin/dev before first review, committed and pushed e0a38e7f. No QA brief required (qaPolicy scope none). Requesting source review before one mode-free droplet verification.
