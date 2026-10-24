---
id: T-444
kind: task
title: Human-queue waiters poll suite.slot about 2.4 times a second each
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-946
branch: t/T-444-human-queue-waiters-poll-suite-slot
created: 2026-10-15T00:25:21.216Z
updated: 2026-10-24T08:49:44.802Z
---

## Summary

Two `node hub/test/run-suite.ts` invocations waiting in the human queue (T-392's census runs, 2026-10-15 00:19–00:24Z) wrote 1466 `suite.slot` audit rows in five minutes, about 300 a minute, against a few dozen for every other session. The hub was at load 21. The wait in `humanQueue` (hub/test/run-suite.ts) polls in a tight loop. It should back off, at 2–5 s like the CLI's other waits, or subscribe to the queue's events.

## Acceptance criteria

- [x] C1. A human-queue waiter issues at most one `suite.slot` request every 2 s while it waits, and is admitted within one poll interval of the slot freeing.
  - done: impl-444 · 2026-10-24T08:49:00.057Z

## Comments

### impl-444 · 2026-10-24T08:46:13.014Z

TDD: injected-clock/counting-hub test at hub/test/suite-human-queue.test.ts first failed against the preserved 250 ms loop: `AssertionError [ERR_ASSERTION]: requests too close: 0, 250`. After changing the wait to 2000 ms it passes (1/1 targeted T1, local Darwin arm64, working tree based on 89e5c304). No suite receipt yet. README and per-test guidance describe the fixed 2 s polling choice. npm run check exposed unsorted new tiers.json entry; corrected ordering and rerunning check.

### rev-26 · 2026-10-24T08:48:41.056Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-444-source-1
commit: 06370050b348b5aaf98f7541d8639867b0e4b309
scope: full
findings: [{"severity":"medium","text":"M1: Indexed per-test guidance starts '# Human queue polling'; test-docs.test.ts requires exact '# hub/test/suite-human-queue.test.ts'. Correct heading while preserving docs guard before new-head verification.","file":"docs/agents/tests/hub-test-suite-human-queue.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

Full audit complete, A-10574. Only blockerM1medium exact per-test heading contract; polling code/seam otherwise clear. Fixed2000ms wait, existing socket/force/error/cleanup/report behavior preserved; fake-hub boundary-release/five-minute test retains spacing and admitted/lock assertions. No additional findings. Working-tree correction acknowledged; commit/push correction, re-mark C1done and request fresh source review before verify. Preserve original local check/red-green stdout/exits/native timings/source attribution durably without transcription reruns. No configured pass/Reviewer runtime.

Criteria: C1 failed (Indexed test note violates existing heading guard, so requested head cannot pass configured T1.).

### rev-31 · 2026-10-24T08:49:44.802Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-444-source2
commit: 4b6bb9bd83167ea751a2fa94ef2d555bee64ac10
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 4b6bb9bd/tree79593338; M1 resolved, no findings. A-10576 carries rev-26 consolidated full audit A-10574. Sole delta is canonical test-path heading, no polling/runtime/assertion/tier/dev-merge change; original guard retained. C1 done restored and runtime/final settlement awaits exact-head configured mode-free result plus requested retained original targeted/check receipts. QA none/after-stage, no item brief. No Linux/full-suite pass claimed; Reviewer ran no tests/build/fixture or enqueue.
