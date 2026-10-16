---
id: T-528
kind: task
title: "session-usage test: a coalesced Codex usage burst journals a duplicate rate-limit row (Linux)"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-495
topic: topic-393
branch: t/T-528-session-usage-test-a-coalesced-codex
created: 2026-10-15T20:01:03.365Z
updated: 2026-10-16T16:17:52.791Z
---

## Problem

`hub/test/session-usage.test.ts:88`, 'Codex coalesces a usage burst and journals a rate-limit-only change', expected three journal rows and got four on Linux: `[[12,6],[24,6],[24,9],[24,9]]`, a duplicate `[24,9]`. This was in T-474's droplet verify fb5a0840 (A-3313). It's either the test reading two publications of one coalesced change, or the coalescer itself journalling the same change twice under load. T-495 fixed different assertions in this file.

## Acceptance criteria

- [x] C1. Determine whether the duplicate row is a test boundary or a real double journal write. If it's a product bug, the coalescer journals each distinct change once, with a regression test. Otherwise the test reads the coalesced boundary it means to observe. Record which in the commit.
  - done: impl-528 · 2026-10-16T16:15:55.676Z
- [ ] C2. session-usage.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-528 · 2026-10-16T16:11:32.065Z

Cause is a test boundary/data artefact, not an identical production double write. A-3976 records a deterministic Mac replay of the exact [[12,6],[24,6],[24,9],[24,9]] failure: hold the existing fake rate-limit-read barrier across the push publication, release it and observe the next publication. The pushed [24,9] has rateLimitsByLimitId.codex, while the authoritative compatibility-only read removes that map. #recordUsage correctly treats those as different snapshots. The original test projected away the field and assumed the push/read completed within 100 ms. Correcting only this test's scripted read/push data to agree, while preserving exact row assertions and explicitly crossing the delayed-read boundary.

### impl-528 · 2026-10-16T16:16:32.755Z

Source review requested at 1835e287cf9f85befc4788702648985bcaaca6a2 (origin/dev merged, head pushed). npm run typecheck at this head from task worktree exited 0; git diff --check exit 0. Review brief A-3988 (not A-3980; that request reference was a typo). One collected whole-file Mac pass 8/8 so far, with nine remaining gated on uptime <15 per Coordinator load notice. C2 remains incomplete until all ten collected runs and droplet evidence. No per-item QA (none/after-stage).
