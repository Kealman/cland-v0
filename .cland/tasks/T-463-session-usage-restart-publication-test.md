---
id: T-463
kind: task
title: session-usage restart publication test counts 2 publications against 1 under load (T-389's 100 ms window)
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-389
topic: topic-292
branch: t/T-463-session-usage-restart-publication-test
created: 2026-10-15T08:37:18.553Z
updated: 2026-10-15T12:59:24.515Z
---

## Summary

`hub/test/session-usage.test.ts:165` counted 2 restart publications where it expects 1 (line 176), in T-455's gate 1ea1e21d (A-2777), 2026-10-15. The whole file passed 5/5 alone at 9c90591b (A-2785). The case was last changed by T-389's c28bf3c4, which set the 100 ms usage window (startUsageDaemon). Under load, two publications land inside one count window. Count publications against an observed coalescing boundary rather than a wall-time window.

## Acceptance criteria

- [x] C1. The restart case counts publications against the observed coalescing boundary, keeps its assertion's meaning, and the file passes 5/5 beside a local full run.
  - done: impl-463 · 2026-10-15T12:59:12.986Z

## Comments

### coord · 2026-10-15T11:13:42.707Z

Second signature in this file, moved here from T-486, whose adapter fix doesn't bound launch latency. It is session-usage.test.ts:31, 'Codex journals changed totals...': in T-447's droplet gate 463ee26b (A-2919), session.launch timed out on its 5 s response before the idle and usage observation. Diagnose it alongside the restart publication count.

### impl-463 · 2026-10-15T12:32:26.894Z

Quiet baseline command `node --test hub/test/session-usage.test.ts`: 8/8 passed, 25.9 s. The current file includes three newer cost/launch-item cases beyond the original five. Diagnosing initial rate-limit vs token publication staging and session.launch's generic 5 s FrameClient deadline. Holding further local tests pending Coordinator's serial Mac window decision.

### impl-463 · 2026-10-15T12:59:13.546Z

Implementation committed and pushed as cb405377866dd879a2e3e2a2dab23e806d49eb36 after integrating origin/dev e2d9a940. Evidence A-2997 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2997-t-463-boundary-reproduction-and-five-quiet-passes contains the deterministic 2 !== 1 reproduction and all five quiet file logs (8/8 each; 40/40). Startup limits are gated until the first token publication is observed; restart must append exactly one row and preserve the full prior journal. Only Codex launch client deadlines align to the existing product deadline at hub/src/adapters/codex.ts:344 (#spawnDeadlineMs default 30_000), per Coordinator decision 989864ed; every other bound is unchanged. No per-item QA scope/brief is required. Requesting source review before the exact-head droplet run.
