---
id: T-495
kind: task
title: "session-usage test: turn() takes an uncorrelated usage frame (12 vs 24) and the journal read meets a limits-only row (Linux)"
state: open
status: review
size: S
criterion_seq: 2
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
updated: 2026-10-15T14:14:06.720Z
---

## Problem

Two more boundary assumptions in `hub/test/session-usage.test.ts`, seen in T-395's droplet run e54c3004 (A-3003). T-463's restart fix doesn't cover them; that's impl-463's analysis at 2ddc0d86.
- :42 asserts `latest.total?.totalTokens === 24`. `turn()` accepts the next session.usage frame without correlating it to the requested turn, so an intermediate publication that still says 12 can satisfy the wait.
- :78 reads `(r.total as …).totalTokens` across journal rows. An earlier row has no total, consistent with the independent initial limits-only publication.

These are rework of T-389's tests.

## Acceptance criteria

- [x] C1. `turn()` waits for the session.usage publication that belongs to the requested turn, and the journal read at :78 skips or explicitly expects the limits-only row. Every assertion and time bound stays as it is.
  - done: impl-495 · 2026-10-15T14:13:06.821Z
  - verified: rev-30 [reviewer] · run rev-20261015-495-source · 2026-10-15T14:14:06.720Z · commit 25ad9ab6d1368a52638457c875bf6afd7306d116
- [ ] C2. session-usage.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-495 · 2026-10-15T14:05:28.233Z

Replayed a late previous session.usage frame at turn()'s existing FrameClient boundary. Before fix, `node --test --test-name-pattern='Codex journals changed totals once' hub/test/session-usage.test.ts` failed with the reported 12 !== 24 (1 test, 0 pass). The same replay passed after matching the expected fixture response (1/1). Temporary replay removed. All original assertions and timeouts retained; first two Codex journal tests read token-bearing records to skip independent initial limits-only publications. Baseline whole file passed 8/8 quietly. Five final whole-file Mac runs pending the free targeted-test window.

### impl-495 · 2026-10-15T14:13:23.218Z

Committed source 372e1223 and pushed review head 25ad9ab6 (latest origin/dev merged; final merge tracker-only). A-3061 contains five serial quiet Mac whole-file passes, each 8/8, in 22.6s, 26.8s, 21.5s, 22.2s, 21.4s. Typecheck passed before/after refreshed dev; diff check passed. Review requested. C2 stays incomplete until same-head default droplet verification passes this file.

### rev-30 · 2026-10-15T14:14:06.720Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-495-source
commit: 25ad9ab6d1368a52638457c875bf6afd7306d116
scope: full

Source review clear at 25ad9ab6d1368a52638457c875bf6afd7306d116; no high, medium or low findings.

Standards: no findings against repo test guidance or code-review smell baseline. Matching the expected fixture response retains the original frame boundary/session identity and existing timeouts; no production or fixture changes.
Spec: C1 verified. session-usage.test.ts:33–38 now requires post-send frame position, stable sessionId and caller-specific usage predicate. Ordinary turns match the expected distinct cumulative totals; repeat usage matches the fake's 100000 context-window marker; limits-only update matches primary usage 9. The fake defines these markers distinctly, so a late previous publication cannot satisfy the tested step. Assertions still independently compare totals/rates/raw tokens and journal exactly-once/final behavior. recordsWithTotals excludes independent startup limits-only rows in the two Codex token-journal checks; the burst case's later final-record assertion remains on the raw journal.

A-3048 records deterministic stale-frame replay with unchanged 12!==24 failure before and success after; temporary replay is absent from the final source. A-3061 supplies five serial quiet Mac whole-file passes (8/8 each, no failures/skips/cancellations). Final merge 372e1223..25ad9ab6 changes only three tracker files. C2 local half supported, Linux half pending.

Reviewed task diff against d6e222bef3eb28eef84e24fb8113585a04b06f1a; one test-only source change plus tracker-only integration. git diff --check passes. Both review axes reviewed directly; role prohibits delegation. Proceed with exact-head default droplet cland verify before final C2 verification. No Reviewer tests or edits.

Criteria: C1 verified.
