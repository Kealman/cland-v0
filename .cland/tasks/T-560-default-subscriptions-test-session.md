---
id: T-560
kind: task
title: "default-subscriptions test: session.launch times out at 5 s in the older pooled Reviewer death case (Linux, loaded)"
state: open
status: in progress
size: S
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: topic-383
branch: t/T-560-default-subscriptions-test-session
created: 2026-10-16T01:20:47.649Z
updated: 2026-10-16T15:48:42.683Z
---

## Summary
In T-527's droplet verify 62859e0a at 5b89aa37 (2026-10-16 ~01:14Z; log A-3540, lines 4288–4293), `hub/test/default-subscriptions.test.ts:266`, 'terminal recovery routes an older pooled Reviewer death past its already-dead lead', failed with "no result for session.launch within 5000ms" (harness.ts:493). The verified-stopped-lead variant of the same templated test passed. The run was heavily loaded: the stale manifest made the load gate repeat dozens of tests, fixed later by 2149fe33. So check for recurrence under normal load first.

## Acceptance criteria
- [ ] C1. Reproduce under load, or close as a load artefact after two clean runs on heads that contain 2149fe33. If it's real, the case waits on the launch's own completion receipt, not a fixed 5 s frame wait, with every assertion kept.
- [ ] C2. default-subscriptions.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.
