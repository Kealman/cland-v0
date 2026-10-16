---
id: T-560
kind: task
title: "default-subscriptions test: session.launch times out at 5 s in the older pooled Reviewer death case (Linux, loaded)"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: topic-383
branch: t/T-560-default-subscriptions-test-session
created: 2026-10-16T01:20:47.649Z
updated: 2026-10-16T16:01:53.010Z
---

## Summary
In T-527's droplet verify 62859e0a at 5b89aa37 (2026-10-16 ~01:14Z; log A-3540, lines 4288–4293), `hub/test/default-subscriptions.test.ts:266`, 'terminal recovery routes an older pooled Reviewer death past its already-dead lead', failed with "no result for session.launch within 5000ms" (harness.ts:493). The verified-stopped-lead variant of the same templated test passed. The run was heavily loaded: the stale manifest made the load gate repeat dozens of tests, fixed later by 2149fe33. So check for recurrence under normal load first.

## Acceptance criteria
- [ ] C1. Reproduce under load, or close as a load artefact after two clean runs on heads that contain 2149fe33. If it's real, the case waits on the launch's own completion receipt, not a fixed 5 s frame wait, with every assertion kept.
  - verified: rev-31 [reviewer] · run rev-20261016-560-source · 2026-10-16T16:01:53.010Z · commit a3012566afb121327e616c88a0c579ce9e45f4e9
- [ ] C2. default-subscriptions.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-560 · 2026-10-16T15:51:23.783Z

Diagnosis: both whole-file normal-load baselines passed (13/13, 24.10 s and 28.21 s) at a descendant of 2149fe33. The historical log A-3540 identifies only the session.launch result timeout, so its particular native step cannot be proven retrospectively. Code tracing found that ClaudeCodeAdapter.#launch awaits #agents, whose native CLI has a 15 s deadline, but FrameClient.request drops the correlated result waiter after 5 s. Controlled reproduction held the fake's existing agents probe for 5200 ms after its agents-started receipt: the exact already-dead-lead case failed with the same 5000 ms timeout (6.44 s total); changing only that launch's receipt bound to testWaitMs(30_000) passed with every recovery assertion retained (8.84 s). This demonstrates a valid slow native probe can outlive the test client, without machine-wide stress. Temporary instrumentation removed; minimal fix applies a bounded 30 s correlated completion receipt wait to both setup launches in the existing templated case. No test renamed/added.

### impl-560 · 2026-10-16T15:58:10.056Z

Review evidence at a3012566afb121327e616c88a0c579ce9e45f4e9 (pushed to origin/t/T-560-default-subscriptions-test-session after fetching and merging origin/dev): npm run typecheck exit 0, A-3945. Whole hub/test/default-subscriptions.test.ts passed 10/10 serially on the Mac (130/130 tests, every run exit 0), A-3944. Wall times 32.89, 34.06, 38.24, 58.13, 35.04, 32.84, 35.80, 40.14, 35.10, 31.03 seconds. Diagnosis and controlled 5200 ms native agents barrier red/green: A-3934. Working tree clean; no temporary probe code. Awaiting source review before same-head droplet verification.

### rev-31 · 2026-10-16T16:01:53.010Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-560-source
commit: a3012566afb121327e616c88a0c579ce9e45f4e9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 findings, Spec 0 findings. A-3954 records the review. The two existing terminal-recovery variants retain every lifecycle and recipient assertion; both Claude setup launches await their own correlated result for testWaitMs(30000), covering the native agents probe's 15000 ms deadline independently from later observations. A-3934 controlled 5200 ms probe barrier reproduces the original 5000 ms receipt failure and passes after the correction; historical native-step attribution remains unknown. A-3944 provides ten Mac whole-file passes (130/130), and A-3945 typecheck evidence. C1 verified; C2 awaits same-head post-review droplet evidence.

Criteria: C1 verified.
