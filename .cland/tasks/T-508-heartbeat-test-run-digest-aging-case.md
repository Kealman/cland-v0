---
id: T-508
kind: task
title: "heartbeat test: run-digest aging case fails once and leaves the test runner hanging (Mac, quiet)"
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-454
topic: topic-311
branch: t/T-508-heartbeat-test-run-digest-aging-case
created: 2026-10-15T15:33:39.730Z
updated: 2026-10-15T17:47:47.564Z
---

## Problem

`hub/test/heartbeat.test.ts:155`, 'the digest includes running and queued runs and ages timeouts and ended runs without results', failed in a quiet whole-file run on the Mac (2.413 s), in impl-506's fifth T-506 repetition on 2026-10-15 at about 15:31Z. The four earlier runs were green. The runner then hung after printing every case, without a final summary, which suggests a timer or handle the case leaves open. It's T-454's test, so it's rework of T-454.

## Acceptance criteria

- [ ] C1. The case's aging of timed-out and ended runs depends only on a controlled clock and observed state, and the case closes every timer and handle so the runner exits. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. heartbeat.test.ts passes 5/5 serially, whole file and alone on the Mac, each run exiting on its own, plus once on a droplet in the task's verify.

## Comments

### coord · 2026-10-15T15:35:06.843Z

Correction from impl-506 at 15:34Z: once the runner was stopped, the flushed log showed the real failure. It was ENOTEMPTY on rmdir of the scratch dir cland-suite-cli-* during the run-digest case teardown, not a clock assertion. That is the same family as T-498 (rm racing a live writer), so the fix is in the teardown. C1 should read: teardown waits for, or retries past, the live writer, and the runner exits.

### impl-508 · 2026-10-15T17:38:37.401Z

Investigating the corrected teardown failure (ENOTEMPTY on cland-suite-cli-*), rather than changing clock assertions. Mac tests wait while the local verify slot belongs to Coordinator. Will retain every existing assertion and produce five serial whole-file runs plus reviewed-head droplet verify.

### impl-508 · 2026-10-15T17:40:17.525Z

Historical failure predates T-393 (10fa25e2) by about one minute. That merged change already waits for both run results before fixture teardown and stops an embedded hub before removing its directory. Skipping a new stress reproduction/minimisation while local: coord holds the Mac: the original ENOTEMPTY receipt and this exact one-case lifecycle provide the regression seam. Ranked causes: (1) unobserved queued worker still writing at removal (addressed on success by T-393); (2) native Coordinator t.after skipped after the cleanup error, stranding its MCP client/spoke (still present); (3) hub writes still in flight (embedded stop now awaited before removal). Scope: keep assertions/deadlines, make settlement run even after an assertion failure, and register the Coordinator in ownership cleanup.

### coord · 2026-10-15T17:47:47.564Z

Impact: the run-digest hang now costs whole verifies. T-396's droplet run 8d628041 hit the 50 min remote timeout (exit 124, $0.21, A-3213), stuck in "the digest includes running and queued runs…". This ticket is the priority among the heartbeat lane.
