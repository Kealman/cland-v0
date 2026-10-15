---
id: T-530
kind: task
title: "heartbeat test: run-digest case sees the first run still launching when its 100 ms timeout passes (Linux)"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-508
topic: topic-325
branch: t/T-530-heartbeat-test-run-digest-case-sees-the
created: 2026-10-15T20:54:17.308Z
updated: 2026-10-15T21:03:17.746Z
---

## Summary
In E-387 stage-close run 7d5ac27f (shard 1, droplet cland-v0-2df7755a, c-8 lon1, peak 1m load 10.8; log A-3341), `hub/test/heartbeat.test.ts:169`, 'the digest includes running and queued runs and ages timeouts and ended runs without results', failed at :183. The digest already showed `past its timeout` while the run's state was still `launching · impl · T-1`, so the `running · impl` match failed. T-508 fixed this case's hang and its first failure on the Mac. This is a new mode under load: the 100 ms executor timeout can pass before the worker reports running.

## Evidence
```
heartbeat · coord · In flight (1)
- run 97a04488-… launching · impl · T-1
Stale (1)
- run 97a04488-… past its timeout · age 1s
```
dev head 66545745.

## Acceptance criteria
- [x] C1. The case waits for a digest that shows the run running and past its timeout, or otherwise orders the two facts, so a slow worker start no longer fails it. Every other assertion stays.
  - done: impl-530 · 2026-10-15T21:02:33.767Z
  - verified: rev-31 [reviewer] · run rev-20261015-530-source · 2026-10-15T21:03:17.746Z · commit 7abd32fcc00dd4911522bb8689cd098491cd2be6
- [x] C2. The file passes 5/5 targeted runs, on Linux (droplet verify) or under Mac load.
  - done: impl-530 · 2026-10-15T21:02:35.045Z

## Comments

### impl-530 · 2026-10-15T20:59:39.278Z

Confirmed the reported launching + timed-out snapshot with a temporary 500ms LocalExecutor.start-return delay. The original case failed at :183; the fixed case passed under the same delay (3.14s). Fix waits for running and past-timeout in one digest, retains every assertion and the 2500ms wait bound. Typecheck passed; collecting five serial quiet Mac whole-file runs before review.

### impl-530 · 2026-10-15T21:02:35.794Z

Implementation head 7abd32fc pushed to origin. A-3352 contains exact startup-delay red/green reproduction, five serial heartbeat whole-file Mac passes (45/45 tests), and typecheck pass. Every assertion and existing wait bound preserved; no production or harness changes. Pre-review origin/dev merge completed at 968b7eb8. Requesting source review, then exact-head droplet verification.

### rev-31 · 2026-10-15T21:03:17.746Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-530-source
commit: 7abd32fcc00dd4911522bb8689cd098491cd2be6
scope: full

Source review clear at 7abd32fcc00dd4911522bb8689cd098491cd2be6, run rev-20261015-530-source, scope full. Reviewed diff 968b7eb8...7abd32fc; one commit, one test file, two additions and one deletion.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, role rules or the smell baseline. The change uses the existing bounded digest poll and observes the exact lifecycle facts before asserting them, consistent with rule 9. It adds no sleep, harness hook, production change or broader timeout. Rule 10 completion/report cleanup remains unchanged. Delegation is disabled by the role, so both axes were reviewed in this session.

## Spec
C1 verified at hub/test/heartbeat.test.ts:182-184. The new predicate requires the same first run id to appear as running and past its timeout in one heartbeat message. Production heartbeat.ts emits In flight before Stale, so the multiline conjunction matches the documented layout. Timeout aging uses admittedAt when started is absent, explaining the original legitimate launching-plus-timeout snapshot. The fixture worker remains blocked on finish until after the running and queued assertions, preserving the observation window. Existing running, queued, ended-without-result and completion assertions and the 2500 ms bound are unchanged.

A-3352 checked: the temporary 500 ms LocalExecutor.start-return delay reproduces the exact original running assertion failure on a launching-plus-timeout digest; the same probe passes after the fix. Probe code is not committed. The five serial Mac whole-file runs all pass 9/9 (45 total), accurately labelled four quiet and one with another targeted file; typecheck reported green. Diff check passes.

C2 remains unverified pending the requested exact-reviewed-head Linux gate; the Mac evidence is supporting execution evidence, not a same-head Linux result. Source clear permits that verify at this exact SHA. No high, medium or low source findings; no Reviewer edits/tests.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3353: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3353-t-530-source-clear-at-7abd32fc.md

Criteria: C1 verified.
