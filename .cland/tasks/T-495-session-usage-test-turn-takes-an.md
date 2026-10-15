---
id: T-495
kind: task
title: "session-usage test: turn() takes an uncorrelated usage frame (12 vs 24) and the journal read meets a limits-only row (Linux)"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by:
  - T-463
regression_of: T-389
topic: topic-298
branch: t/T-495-session-usage-test-turn-takes-an
created: 2026-10-15T13:10:49.459Z
updated: 2026-10-15T14:05:28.233Z
---

## Problem

Two more boundary assumptions in `hub/test/session-usage.test.ts`, seen in T-395's droplet run e54c3004 (A-3003). T-463's restart fix doesn't cover them; that's impl-463's analysis at 2ddc0d86.
- :42 asserts `latest.total?.totalTokens === 24`. `turn()` accepts the next session.usage frame without correlating it to the requested turn, so an intermediate publication that still says 12 can satisfy the wait.
- :78 reads `(r.total as …).totalTokens` across journal rows. An earlier row has no total, consistent with the independent initial limits-only publication.

These are rework of T-389's tests.

## Acceptance criteria

- [ ] C1. `turn()` waits for the session.usage publication that belongs to the requested turn, and the journal read at :78 skips or explicitly expects the limits-only row. Every assertion and time bound stays as it is.
- [ ] C2. session-usage.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-495 · 2026-10-15T14:05:28.233Z

Replayed a late previous session.usage frame at turn()'s existing FrameClient boundary. Before fix, `node --test --test-name-pattern='Codex journals changed totals once' hub/test/session-usage.test.ts` failed with the reported 12 !== 24 (1 test, 0 pass). The same replay passed after matching the expected fixture response (1/1). Temporary replay removed. All original assertions and timeouts retained; first two Codex journal tests read token-bearing records to skip independent initial limits-only publications. Baseline whole file passed 8/8 quietly. Five final whole-file Mac runs pending the free targeted-test window.
