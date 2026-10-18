---
id: T-771
kind: task
title: A test-fixture hub outlives its test worker when the worker is SIGTERMed mid-file
state: open
status: backlog
size: S
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-18T04:44:16.774Z
updated: 2026-10-18T04:44:16.774Z
---

## Summary

On 2026-10-18 at 03:52Z, impl-723's load watchdog sent SIGTERM to two companion test files (daemon and orphan-servers) mid-run. A `hub serve` started by one of them, in a temp project (cland-proj-*), survived re-parented to launchd for about 50 minutes, until cland-impl stopped it by hand. `cland doctor --fix` didn't touch it, because its root was outside this project. The temp directory was left behind.

## What to build

A fixture-started hub dies with its test worker: a process group or a parent-death watch, or the worker's SIGTERM handler stops its fixtures before exiting. The test cleanup also removes the temp project. A sweep of fixture-root hubs can back this up.

## Acceptance criteria

- [ ] C1. A T3 test SIGTERMs a test worker that holds a fixture hub, finds no surviving hub process and no temp project left within the cleanup bound, and fails before the fix.
