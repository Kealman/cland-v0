---
id: T-1745
kind: task
title: Waiting launches survive a hub restart
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1744
topic: null
branch: t/T-1745-waiting-launches-survive-a-hub-restart
created: 2026-11-07T16:01:58.235Z
updated: 2026-11-08T07:13:08.897Z
---

## Summary

Waiting launches are durable in `hub.db`. After a hub restart, each waiting launch comes back with its reason and its original since, and is re-evaluated by the scheduler. No launch is placed twice. A waiting launch whose role or pool was removed meanwhile is dropped, and the Coordinator gets one line saying which launch and why.

## What to build

The persistence of T-1744's waiting record:
- written when a wait starts, updated on a reason change, and deleted on placement or cancel;
- read back once at hub start, before the scheduler's first pass;
- placement is idempotent: a record is deleted in the same step that publishes the session row, so a crash between them cannot launch twice.

The drop line is an Agents notice addressed to `coordinator`, one per dropped launch.

## Acceptance criteria

- [ ] C1. After a hub restart, each waiting launch is listed again in `cland session list` and the inbox frame with its reason and its original since (test).
- [ ] C2. After a restart, a restored waiting launch is placed once when room appears, and a launch already placed before the stop is not restored (test).
- [ ] C3. A waiting launch whose role was removed from `roles.toml`, or whose pool was removed from `config.toml`, during the stop is dropped at start, with one Agents line to the Coordinator naming the launch and the reason (test).
- [ ] C4. A launch cancelled before the stop is not restored (test).

## Blocked by

- T-1744

## Notes

- Hot files: `hub/src/host/pool-runtime.ts` (or a new `hub/src/host/waiting-launches.ts`), `hub/src/hub/store.ts` (table), `hub/src/hub/daemon.ts` (restore at start).
- Tests: new `hub/test/waiting-launch-restart.test.ts` (T2, `projectHub` stop and start on one root).
- Serves epic C3.
