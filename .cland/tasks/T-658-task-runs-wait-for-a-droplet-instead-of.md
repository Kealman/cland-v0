---
id: T-658
kind: task
title: Task runs wait for a droplet instead of falling back to the Mac
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - flaky
  - verification
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-400
branch: t/T-658-task-runs-wait-for-a-droplet-instead-of
created: 2026-10-16T16:29:56.442Z
updated: 2026-10-16T16:31:49.946Z
---

## Summary

The Mac hosts 7–16 harness sessions and the hub, so a task run that falls back to it runs at load 15–25 and goes red about half the time (A-4004, recommendation 1). With droplet as the project executor, a task run should wait for a droplet slot instead of falling back to local.

## What to build

A `[verification] local_fallback` setting, default `true`, written `false` in this project's config. When it's false and the executor is droplet, a task run whose remote slots are full waits in the queue with its position and ETA instead of running locally. An explicit `--executor local` still runs locally, and the human's own `npm test` is unchanged. `cland verify queue` reports the setting.

## Acceptance criteria

- [ ] C1. With local_fallback = false, a task verify submitted while every remote slot is busy stays queued and runs on the next free droplet, never locally, proved by a suite-queue test with fake slots.
- [ ] C2. With local_fallback = true (the default) today's fallback behaviour is unchanged, and `--executor local` always runs locally, proved by the same test file.
- [ ] C3. `cland verify queue --json` reports the setting, and docs/agents/tests.md describes it.
