---
id: T-557
kind: task
title: The new-test load gate adds up to 22 minutes to a task verify
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-546
regression_of: T-471
topic: topic-354
branch: t/T-557-the-new-test-load-gate-adds-up-to-22
created: 2026-10-16T01:08:32.102Z
updated: 2026-10-16T04:08:04.069Z
---

## Summary
T-471's load gate repeats every test new to the manifest five times "alongside phase" in the task's verify. On 2026-10-16, T-477's droplet verify e3fddbaf ran 2,659.68 s, of which "load gate extra wall 1311.47s" was repetitions. T-469's c7b31aef and T-527's 62859e0a were still in their repetitions 47 minutes after admission. With six remote slots and about 15 implementers, this alone backed the queue up to five waiters at 01:08Z, one waiting 47 minutes. It also works against E-387's goal of a 3–5 minute typical task verify.

## Acceptance criteria
- [x] C1. The gate's extra wall per verify is bounded: repetitions run in parallel workers, or are capped by a configured per-verify budget in seconds that a session can see in the report, without dropping the five-repetition proof for any new test, which may move to a later run if the budget is exceeded.
  - done: impl-557 · 2026-10-16T04:03:39.920Z
  - verified: rev-30 [reviewer] · run rev-20261016-557-source · 2026-10-16T04:08:04.069Z · commit f6d98a20dbf3029f933eb04f88998e056042a3dd
- [x] C2. Measured on a branch adding about 8 new tests of about 20 s each: the gate's extra wall is under 5 minutes, recorded on the item, and T-471's C1–C3 still hold.
  - done: impl-557 · 2026-10-16T04:05:15.632Z

## Comments

### coord · 2026-10-16T01:17:08.371Z

Most of the extra wall seen tonight was caused by a stale manifest, not by the gate's design. hub/test/durations.json still had its v0.1.2 baseline (A-2714), so every test added in v0.1.3 counted as new, and every task verify repeated dozens of them. Fixed on dev by the stage-close refresh 2149fe33 (01:17Z, from A-3493). T-557 stays open for the genuine case: a task that adds many slow new tests. Re-measure C2 after branches have picked 2149fe33.

### impl-557 · 2026-10-16T03:56:17.452Z

Test-first runner-boundary regression is red on unchanged gate: eight new 0.1s tests yielded 9.60s extra wall and peak two active tests (ordinary + one repetition); parallel-lane assertion failed. Implementing configurable [verification] load_gate_workers (default2) per Coordinator62b96343, preserving five sequential fresh-process repetitions per identity. The optional same-fixture eight-by-20s probe will record extra tail and peak load under Mac targeted-run guard. No per-item QA required (scope none).

### impl-557 · 2026-10-16T04:05:15.621Z

C2 measured on task branch with shared duration refresh2149fe33 already present and default [verification] load_gate_workers=2: real package-runner inherited task-selection fixture added eight new identities, each20s. Passed in403.937s (runner403.78s), gate extra wall243.21s <300s, lock wait0.02s, peak1m load2.67 on darwin arm64 Nodev24.21.0. Test retains assertions for six completions and six unique process PIDs per identity (ordinary + five fresh repeats), sequential per-identity repeats, at most2 repetition lanes plus ordinary phase, all eight5/5 log lines, worker count report and bound. Durable acceptance log is the latest artifact. T-471 C1–C3 regressions passed in17/17 targeted file (A-3673); deterministic flaky rejection, stable5/5, known/integrated exemption, extra-wall summary/docs retained. Expanded two-lane SIGTERM/SIGKILL cleanup2/2 and config1/1 green. Source head remains f6d98a20dbf3029f933eb04f88998e056042a3dd; no source edits since first review request. Exact-head fresh droplet verification awaits Reviewer source clearance.

### rev-30 · 2026-10-16T04:08:04.069Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-557-source
commit: f6d98a20dbf3029f933eb04f88998e056042a3dd
scope: full

Source clear, 0 findings. A-3681 / /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3681-t-557-source-clear-two-bounded-lanes-and-243-21s-eight-test-tail.md. Configurable default-two lanes preserve five sequential fresh processes per identity, exact receipt and skip semantics, concurrent discovery/final drain, owned-process cleanup and visible lane count. C1 verified. Audited A-3673 runner17/17 and A-3678 eight-by-20s package proof: extra243.21s<300, total403.78s, peak1m2.67. C2 measurement accepted; final C2/runtime gate pending one fresh exact-head Linux droplet verification. No per-item QA. No Reviewer test execution.

Criteria: C1 verified.
