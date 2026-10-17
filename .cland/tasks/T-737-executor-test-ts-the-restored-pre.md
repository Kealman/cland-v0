---
id: T-737
kind: task
title: "executor.test.ts: the restored pre-executor job case reads job.pid before the launched worker reports it (load)"
state: open
status: review
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-440
branch: t/T-737-executor-test-ts-the-restored-pre
created: 2026-10-17T14:18:58.698Z
updated: 2026-10-17T14:22:22.534Z
---

## Summary

`hub/test/executor.test.ts::a pre-executor running job restored from hub.db reports as local exactly once` failed in integrated cover 3fed9129 (A-4528) and earlier on T-689's branch (A-4259, 2026-10-17 00:27Z) at `assert.ok(job.pid)`, right after `f.launch()`. It passes 10/10 alone on the Mac. Under load the launch returns before the worker's pid is recorded.

## What to build

Make the fixture's launch wait for the hub's own "running with pid" receipt (status or journal) before returning, or have the case wait for it, instead of asserting on the first launch reply. Keep every later assertion: stop, the hub.db rewrite to a pre-executor row, the restore and the single local report.

## Acceptance criteria

- [ ] C1. The case passes 5/5 on the Mac and in the task's droplet verify, with no new real-time wait and its assertions unchanged.

## Comments

### impl-737 · 2026-10-17T14:21:32.659Z

Implemented at 76d33d442cccecec2478e1aa9648d260056dc773 and pushed to origin. The legacy restore case opts into a bounded hub.status wait for its exact run's state=running and pid before launch returns and worker ownership is registered. Every assertion retained; no new real-time wait or production change. Typecheck and test:tiers pass. executor.test.ts passed 5/5 serially on macOS: 5.724, 5.736, 5.770, 5.881, 5.878 seconds; starting one-minute loads 3.03–3.63 (<15). Droplet verification follows clear source review; C1 will be marked done after its receipt.

### rev-31 · 2026-10-17T14:22:22.534Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-737-source
commit: 76d33d442cccecec2478e1aa9648d260056dc773
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0 findings, A-4533. Only executor.test.ts changes. Affected legacy restore case opts into bounded hub.status observation for exact run id, running state and PID before ownership/return; no fixed elapsed delay, new timing knob or allowance. Original PID/stop/DB rewrite/finish/restart/local platform/exactly-once assertions remain unchanged. Existing T3 lifecycle reason applies and is named in the case. A-4530 reports whole-file Mac 5/5, 3/3 per run, load 3.03–3.63, static checks green; raw transcripts not included in that summary. Origin tip matches requested commit. C1 execution verification remains pending exact-head droplet and supporting Mac receipt audit. No Reviewer edits/tests/delegation.
