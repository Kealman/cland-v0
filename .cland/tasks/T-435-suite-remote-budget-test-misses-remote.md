---
id: T-435
kind: task
title: suite-remote-budget test misses 'remote budget 1/1 full' on Linux after an unconfirmed acquire cleanup
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-261
branch: t/T-435-suite-remote-budget-test-misses-remote
created: 2026-10-14T18:23:17.170Z
updated: 2026-10-14T18:39:30.841Z
---

## Summary

`hub/test/suite-remote-budget.test.ts:191` ("unconfirmed acquire cleanup keeps durable remote budget reservation") failed on a Linux c-8 droplet in T-430's run 077a0297 at 564e7a4c (A-2501), after 8453 ms. At line 205 the history never contained "remote budget 1/1 full". It passes on macOS. It is one of the Linux-only failures that block clean droplet runs, with T-429, T-430 and T-432 to T-434.

## What to fix

Find whether the test samples the history before the reservation's notice is sent, or whether the product drops or delays the notice when cleanup is unconfirmed. The notice may also be affected by T-431's change to once-per-run fallback notices, so check the interaction. Wait on the real state, or fix the product, in one commit. Don't widen time bounds.

## Acceptance criteria

- [ ] C1. The cause is named with evidence, with a deterministic reproduction red before the fix and green after.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-435-1 · 2026-10-14T18:31:17.177Z · commit c652394614d783ec07266c83073d4ceb940353be
- [ ] C2. The file passes 5/5 whole-file runs serially beside a full local run.

## Comments

### impl-435 · 2026-10-14T18:26:37.067Z

Baseline focused command node --test --test-name-pattern='unconfirmed acquire cleanup' hub/test/suite-remote-budget.test.ts reproduced the exact missing-notice assertion on macOS (0/1, 8.63s). Queue membership is not a fallback completion signal: #start persists queued before asynchronous #launchRemote/#droplet.acquire; queue displays requestedExecutor even after fallback. Fix waits for the run-specific persisted fallback notices for both callers with the existing 20s bounds, then checks the exact budget-full text. T-431's once-per-run notices remain compatible.

### rev-23 · 2026-10-14T18:31:17.177Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-435-1
commit: c652394614d783ec07266c83073d4ceb940353be
scope: full

No high or medium source findings. Old queued-membership waits precede async acquisition/fallback; new correct-topic durable executor-fallback:<run> waits establish actual state, retain one droplet/create and cleanup checks, tighten exact next warning text, preserve20s deadlines. A-2505 public integration red/green plus A-2504 deterministic scheduler interleaving establish C1. Compatible with T-431’s single persisted notice; no repeated emission dependency or product seam. C2 remains pending five serial whole-file passes beside full local run (first8/8 insufficient). Exact-head no-mode local suite follows source-clear, final needs C2 proof too. A-2512: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2512-t-435-source-review-observe-durable-fallback-before-reservation-assertions.md.

Criteria: C1 verified.

### impl-435 · 2026-10-14T18:39:30.841Z

C2 evidence at reviewed c6523946: suite-remote-budget.test.ts passed 5/5 whole-file serial invocations, 8/8 tests each. Durable logs: A-2509 (108.64s), A-2514 (121.24s), A-2516 (97.14s), A-2517 (100.80s), fifth log posted in topic-261 (75.28s). No stress loop or overlapping file runs. Queue snapshots at 18:24:38Z and 18:37:23Z show full local run 42895a87 (impl-429) holding the slot through repetitions, including final repetition's start. Exact-head inferred-mode local verification b14a97d5-30b5-4a2e-8e06-11211ae4aad8 was queued after source clear; waiting for its hub result. Working tree clean.
