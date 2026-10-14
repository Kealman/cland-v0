---
id: T-431
kind: task
title: The executor-fallback notice repeats on every scheduler tick for the run's whole life
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
regression_of: T-346
topic: topic-257
branch: t/T-431-the-executor-fallback-notice-repeats-on
created: 2026-10-14T17:24:52.261Z
updated: 2026-10-14T17:31:42.304Z
---

## Summary

The hub sends the `executor-fallback` notice for a verify run on every scheduler tick for as long as the run lives, not once. `Suites.#inspect` calls `#announceFallback(job)` at the top of every inspection (`hub/src/hub/suites.ts:441`). `#announceFallback` calls `onFallback` every time and guards only the log line with `fallbackLogged` (line 348). `dispatch.ts:169` turns each call into a `noticeTo` report.

The journal over 65 minutes on 2026-10-14 shows 3078 fallback events for 7 verify ids (the stand-in's count). Examples:
- T-388's eac22c41 fired 707 times over its run;
- T-383's 83b5a188 and T-385's 44f177e9 fired 477 times each.
The hub held 60–75% CPU, with slow `send` and `inbox.list` calls and CLI acknowledgement timeouts (T-428). With `executor = "droplet"` as the default, every run past the remote budget falls back, so this recurs constantly.

## What to fix

Send the fallback notice once per verify id. On a hub restart, a run that already announced must not announce again. Keep the warn-level log line once, as now.

## Acceptance criteria

- [x] C1. A run that falls back to local produces exactly one `executor-fallback` notice and one `verification-executor-fallback` log line over its whole life, across scheduler ticks.
  - done: impl-431 · 2026-10-14T17:29:56.433Z
- [x] C2. After a hub restart, a restored fallback run does not repeat the notice.
  - done: impl-431 · 2026-10-14T17:29:58.832Z
- [x] C3. A test drives at least 20 scheduler ticks on a fallback run and counts the notices.
  - done: impl-431 · 2026-10-14T17:30:02.529Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-431-1 · 2026-10-14T17:31:42.304Z · commit 5c7d175d02ded4a501f8e0582b05db6602f07f6d

## Comments

### impl-431 · 2026-10-14T17:27:24.456Z

Regression first: `node --test --test-name-pattern='fallback notice and log' hub/test/suite-remote-budget.test.ts` failed with 20 callback notices over 20 ticks, both with and without the existing fallbackLogged checkpoint. Guarding notice and log together with that persisted checkpoint makes both cases green; test reopens the SQLite store and drives 20 further ticks after restart. Running the whole touched test file before review. QA policy is none.

### rev-23 · 2026-10-14T17:31:42.304Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-431-1
commit: 5c7d175d02ded4a501f8e0582b05db6602f07f6d
scope: full

No high or medium Standards/Spec findings. Existing durable fallbackLogged now guards both notice callback and log, including pre-fix saved records; no new state/seam, admission/text unchanged. C3 verified from A-2470 red 20 callbacks then green tests driving 20 scheduler inspections and 20 more after real SQLite reopen for both unannounced and already-announced records. Existing real-frame budget tests retain actual one-notice/warn and journal one-log assertions. C1/C2 await complete exact-head no-mode local verify under 17:18 human executor decision. Saved-checkpoint restart is covered; no new crash-atomic mechanism claimed. A-2473: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2473-t-431-source-review-shared-durable-fallback-checkpoint.md.

Criteria: C3 verified.
