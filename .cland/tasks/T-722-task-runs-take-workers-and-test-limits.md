---
id: T-722
kind: task
title: Task runs take workers and test limits from the hub's config, not the candidate tree's
state: open
status: in progress
size: S
rank: 6899
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-417
branch: t/T-722-task-runs-take-workers-and-test-limits
created: 2026-10-16T20:36:58.759Z
updated: 2026-10-17T03:26:37.185Z
---

## Summary

A task run takes its worker count and test limits from the candidate tree's `.cland/config.toml` (`suiteLimits(input.cwd, …)` in hub/src/hub/suites.ts, around lines 301 and 329). Only runs from the root follow the hub's loaded config. So after D53 set `[verification.droplet] workers = 2`, branches cut before that commit kept running at 4 workers: T-628's run 77556e4a (A-4188) peaked at load 16.4 on a c-8. A project's verification policy is the hub's, not the branch's.

## What to build

Task runs take workers, the load-gate workers and the test and stall timeouts from the hub's loaded project config, exactly as root runs do. An explicit `--workers` still overrides. The candidate tree's config is still validated by admission where it is already checked, but it no longer sets the policy a run executes under. The run log's `Workers` line says which source it came from.

## Acceptance criteria

- [ ] C1. A task run from a worktree whose config says 4 droplet workers runs at the hub config's 2, and an explicit `--workers 3` still runs at 3, proved by a suite-queue test with two configs.
- [ ] C2. Test and stall timeouts and load-gate workers for a task run come from the hub's config, and the run log names the policy source, proved by the same test file.
