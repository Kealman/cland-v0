---
id: T-518
kind: task
title: An explicit --executor droplet request can reuse a cached local green and never run on Linux
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by:
  - T-512
topic: topic-320
branch: t/T-518-an-explicit-executor-droplet-request-can
created: 2026-10-15T18:04:23.485Z
updated: 2026-10-15T19:35:44.334Z
---

## Summary

The verify cache lookup in hub/src/hub/suites.ts (#cached / #start, around lines 239–248) ignores the executor. So an explicit `--executor droplet` request at a head with an earlier local green result returns that Mac result, and the Linux evidence the request was made for never runs. Found by impl-512 while fixing T-512.

## Acceptance criteria

- [ ] C1. An explicit `--executor droplet` request reuses only a cached green that ran on a droplet. A local-only green triggers a fresh remote run, and the result header says why.
- [ ] C2. Requests with no executor flag keep today's cross-executor reuse. The docs describing reuse (hub/README.md Tests, docs/agents/tests.md) are updated, and a test covers both cases.
