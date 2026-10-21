---
id: T-1067
kind: task
title: A hung droplet task run is not stopped by the silent-output watchdog
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-21T15:34:51.747Z
updated: 2026-10-21T15:34:51.747Z
---

## Summary

A remote task verify hung on its droplet for about 30 minutes with no output, and nothing stopped it until its owner cancelled it. Run 56752f57 (T-1052 at e79e1231, Linux c-8 droplet) printed its last progress receipt at 15:05:00.723Z (web-edge.test.ts file pass). The mirrored suite.log was unchanged from 15:05:09Z to 15:34:01Z. The only unclosed file was hub/test/task-prefixes.test.ts, started 15:03:57Z. The silent-output watchdog in hub/src/suite-command.ts takes its stall limit from `suiteLimits(cwd, 'local', …)`, which suggests droplet runs are not covered, or are covered with a much longer limit.

## What to build

A remote run with no output for longer than the configured stall limit ends as `timeout` with its in-flight file named, exactly like a local run, and its droplet is released.

## Acceptance criteria

- [ ] C1. A droplet run whose test stops printing is ended by the stall limit, and its result has cause `timeout` and names the in-flight file (test with the fake or droplet executor contract).
- [ ] C2. The stall limit for remote runs is documented in docs/agents/tests.md and is no longer than the local one plus the transport's progress interval.
