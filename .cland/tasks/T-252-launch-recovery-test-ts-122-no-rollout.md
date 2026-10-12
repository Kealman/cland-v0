---
id: T-252
kind: task
title: 'launch-recovery.test.ts:122 "no rollout found for thread id" about 1 in 5 runs: the fake Codex saves its rollout only after the first turn while the test relaunches at once'
state: open
status: backlog
labels:
  - v0.1.1
  - ready-for-agent
  - tech-debt
assignee: null
parent: T-229
blocked_by: []
topic: null
branch: null
created: 2026-10-12T00:15:33.334Z
updated: 2026-10-12T00:15:33.334Z
---

## What happened

T-250's work (A-1463, A-1466) showed launch-recovery.test.ts (from T-129) failing at line 122, "no rollout found for thread id <uuid>", in 1 of 5 isolated runs at c7db08b. It passed 5/5 at dev fae0e78, 5/5 for the single case at fa3a864, and 4/4 at T-250's integrated head 9728a5f. The test and fake-harness sources are byte-identical across those heads, so the failure is rare and timing-dependent, and not tied to a code change.

Hypothesis, from impl-250's reading of the source: the fake Codex persists turns and the rollout only after its 300 ms clause turn finishes, but CodexAdapter.spawn returns as soon as turn/start is accepted. This case relaunches immediately, so the resume can race the rollout write.

## What to build

Confirm the race. Make the fixture, or the fake, wait on an observable condition: the rollout file existing, or the first turn's completion receipt. Don't lengthen timeouts and don't drop assertions. If real Codex can show the same window (spawn returns before the rollout exists), decide whether the adapter's resume should wait for it, and file that if so.

## Acceptance criteria

- [ ] The race is confirmed or refuted, with a deterministic reproduction.
- [ ] The case passes 20/20 isolated and under induced load on Node 24.21.0, recorded in an artifact, with assertions unchanged.
- [ ] `npm run typecheck && npm test` pass.
