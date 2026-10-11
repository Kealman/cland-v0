---
id: T-208
kind: task
title: A suite report resolves a moved log artifact before reading or attaching it
state: open
status: review
criterion_seq: 3
labels:
  - v0.1
  - ready-for-agent
assignee: impl-208
parent: T-115
blocked_by: []
topic: topic-126
branch: t/T-208-a-suite-report-resolves-a-moved-log
created: 2026-10-11T01:44:33.392Z
updated: 2026-10-11T09:01:52.300Z
---

## What to build

Found by rev-13 in T-178's integration review (A-973, 2026-10-11), a defect between T-193 and T-203 on dev 1c2f5d6. `cland suite`'s checkpointed reporting reads and attaches the log through `store.artifact(id).path`. `artifact.move` (T-193) keeps a redirect entry but unlinks that path. If a recipient mute pauses publication after registration and the log is moved meanwhile, every retry after the unmute fails with ENOENT and the result is never published.

Resolve the artifact (following a moved redirect) before reading or attaching it, at each retry.

## Acceptance criteria

- [x] C1. A report whose log was moved into a folder after registration still publishes after the pause clears, attaching the moved file.
  - done: impl-208 · 2026-10-11T09:01:17.875Z
- [x] C2. A protocol test covers mute, then move, then unmute, then publication.
  - done: impl-208 · 2026-10-11T09:01:18.147Z
- [ ] C3. `npm run typecheck && npm test` pass.

## Notes

Size XS. Edge case: a mute plus a move during one report's publication.

## Comments

### impl-208 · 2026-10-11T08:58:59.532Z

Claimed in t/T-208-a-suite-report-resolves-a-moved-log. Building a protocol regression for recipient mute → registered log move → unmute → publication before applying the narrow redirect-resolution fix.

### impl-208 · 2026-10-11T09:00:01.129Z

Regression reproduced before the fix: node --test --test-name-pattern='muted suite report follows' hub/test/suite.test.ts failed (0 pass, 1 fail) at 'suite publication with moved log: not within 15000 ms'. Test confirms the registered original path is gone and destination preserves log bytes. A-973 already corroborates the root cause; no broader hypothesis/instrumentation work is needed for this one-line lookup fix.

### impl-208 · 2026-10-11T09:01:41.302Z

Implemented redirect resolution per retry and committed/pushed 279900e29546bae529c71a5d77d086dafd6fd77d. Targeted suite.test.ts: 12 pass, 0 fail/cancel/skip/todo; new protocol regression passes after reproducing the timeout before the fix. Fetched and merged origin/dev (already up to date). C1/C2 done; C3 awaits hub-owned full suite. Review evidence shared in item topic.
