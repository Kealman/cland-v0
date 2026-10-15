---
id: T-508
kind: task
title: "heartbeat test: run-digest aging case fails once and leaves the test runner hanging (Mac, quiet)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-454
topic: null
branch: null
created: 2026-10-15T15:33:39.730Z
updated: 2026-10-15T15:35:06.843Z
---

## Problem

`hub/test/heartbeat.test.ts:155`, 'the digest includes running and queued runs and ages timeouts and ended runs without results', failed in a quiet whole-file run on the Mac (2.413 s), in impl-506's fifth T-506 repetition on 2026-10-15 at about 15:31Z. The four earlier runs were green. The runner then hung after printing every case, without a final summary, which suggests a timer or handle the case leaves open. It's T-454's test, so it's rework of T-454.

## Acceptance criteria

- [ ] C1. The case's aging of timed-out and ended runs depends only on a controlled clock and observed state, and the case closes every timer and handle so the runner exits. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. heartbeat.test.ts passes 5/5 serially, whole file and alone on the Mac, each run exiting on its own, plus once on a droplet in the task's verify.

## Comments

### coord · 2026-10-15T15:35:06.843Z

Correction from impl-506 at 15:34Z: once the runner was stopped, the flushed log showed the real failure. It was ENOTEMPTY on rmdir of the scratch dir cland-suite-cli-* during the run-digest case teardown, not a clock assertion. That is the same family as T-498 (rm racing a live writer), so the fix is in the teardown. C1 should read: teardown waits for, or retries past, the live writer, and the runner exits.
