---
id: T-501
kind: task
title: "merge-gate and merge-policy tests: the CLI gives up after 3000 ms waiting for a loaded test hub (Linux)"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-394
branch: t/T-501-merge-gate-and-merge-policy-tests-the
created: 2026-10-15T14:44:32.893Z
updated: 2026-10-16T16:12:42.688Z
---

## Problem

`hub/test/merge-gate.test.ts:220` and `hub/test/merge-policy.test.ts:96` both failed on Linux under load (peak 1-min load 14) in T-495's droplet verify af207517 (A-3076). Each time the CLI reported that the hub didn't answer within 3000 ms, and `ok()` in merge-support.ts:18 expects success. These are T-395's split files; the statements are byte-identical to the old merge.test.ts. So the 3 s CLI-to-hub request budget is probably older than T-395 and just too tight for a test hub under load. The stand-in also saw `cland hub status` time out at 3 s under load at 12:04Z.

## Acceptance criteria

- [ ] C1. Find where the 3000 ms CLI request deadline comes from. Either the merge tests pass a deadline matched to the hub operation they wait on, citing its source line, or the CLI's own default is shown to be wrong under load and fixed with the reason. Every other assertion stays, and the root cause is recorded in the commit.
- [ ] C2. merge-gate.test.ts and merge-policy.test.ts each pass 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-501 · 2026-10-16T16:12:42.688Z

Cause: both reported lines (merge-gate.test.ts:220, merge-policy.test.ts:96) run `cland role set`. hub/src/cli/role.ts:48 used askHubFrame's default 3000 ms total connection/hello/result deadline (hub/src/cli/socket-client.ts:20,37). This is not a fixture-startup wait: project() observes Reviewer presence before returning. Dispatcher role.set awaits core.roles.fresh() before assigning/persisting the role and publishing its clause (hub/src/hub/dispatch.ts:1280–1297); async configuration I/O under load can outlast 3 s. Controlled regression using RolesFile's injected file reader delayed 3100 ms reproduced the exact CLI error on Mac (exit 1, 3266 ms). Fix gives only role.set an explicit 10 s operation budget, matching tracker CLI requests (hub/src/cli/task.ts:358); no merge/permission assertions changed. Existing load report af207517/A-3076 supplies original Linux evidence; no machine-wide stress introduced.
