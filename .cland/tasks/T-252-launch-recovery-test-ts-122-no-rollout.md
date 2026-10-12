---
id: T-252
kind: task
title: 'launch-recovery.test.ts:122 "no rollout found for thread id" about 1 in 5 runs: the fake Codex saves its rollout only after the first turn while the test relaunches at once'
state: open
status: review
criterion_seq: 3
labels:
  - v0.1.1
  - ready-for-agent
  - tech-debt
assignee: impl-252
parent: T-229
blocked_by: []
topic: topic-166
branch: t/T-252-launch-recovery-test-ts-122-no-rollout
created: 2026-10-12T00:15:33.334Z
updated: 2026-10-12T02:01:09.267Z
---

## What happened

T-250's work (A-1463, A-1466) showed launch-recovery.test.ts (from T-129) failing at line 122, "no rollout found for thread id <uuid>", in 1 of 5 isolated runs at c7db08b. It passed 5/5 at dev fae0e78, 5/5 for the single case at fa3a864, and 4/4 at T-250's integrated head 9728a5f. The test and fake-harness sources are byte-identical across those heads, so the failure is rare and timing-dependent, and not tied to a code change.

Hypothesis, from impl-250's reading of the source: the fake Codex persists turns and the rollout only after its 300 ms clause turn finishes, but CodexAdapter.spawn returns as soon as turn/start is accepted. This case relaunches immediately, so the resume can race the rollout write.

## What to build

Confirm the race. Make the fixture, or the fake, wait on an observable condition: the rollout file existing, or the first turn's completion receipt. Don't lengthen timeouts and don't drop assertions. If real Codex can show the same window (spawn returns before the rollout exists), decide whether the adapter's resume should wait for it, and file that if so.

## Acceptance criteria

- [x] C1. The race is confirmed or refuted, with a deterministic reproduction.
  - done: impl-252 · 2026-10-12T01:41:48.332Z
- [x] C2. The case passes 20/20 isolated and under induced load on Node 24.21.0, recorded in an artifact, with assertions unchanged.
  - done: impl-252 · 2026-10-12T02:00:29.629Z
- [ ] C3. `npm run typecheck && npm test` pass.

## Comments

### impl-252 · 2026-10-12T01:36:05.067Z

Unmodified recovery test reproduced the reported no-rollout error on the first baseline run (Node v24.21.0). The fake creates a JSON file at thread/start with turns=0; its load/resume requires turns>0, which is saved only after the clause turn completes. Collecting 20 baseline file runs and a deterministic delayed-turn reproduction before adding an observable wait.

### impl-252 · 2026-10-12T01:41:37.436Z

Baseline complete: 20/20 full-file runs failed at the affected final resume assertion with no rollout found. Delaying only that fixture's first turn to 10 seconds also failed 3/3. Added an eventually wait for the launched thread's persisted turns>0 before the deliberate relaunch failure; all original assertions and timeouts are byte-identical. Real Codex 0.162.1 probe persisted before turn acceptance and resumed after stopping the first server, so no production change/follow-up from this evidence. Post-fix isolated/load repetitions next.

### impl-252 · 2026-10-12T02:00:30.021Z

A-1489 contains complete logs and reproducible scripts: baseline full file 0/20 passes with 20 exact no-rollout failures; fixed full file 20/20 isolated and 20/20 with four CPU load workers on Node v24.21.0; delayed-first-turn reproduction 0/3 before and 3/3 after. Original assertions and timeouts unchanged. Durable evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1489-t-252-before-after-and-induced-load-verification/README.md. Fetched and merged origin/dev d57ef7f before final suite (tracker/docs-only update); preparing review request.
