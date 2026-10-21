---
id: T-1063
kind: task
title: connection-snapshot test spawns the real account poller instead of injecting accountReader
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-21T14:26:07.116Z
updated: 2026-10-21T14:26:07.116Z
---

## Summary

The existing test `hub/test/connection-snapshot.test.ts` "snapshot contains each workbench domain, compact verdict rounds and recent closed topics" creates a named account without injecting `projectHub.accountReader`. The Linux runtime tripwire therefore reports a T2 `child_process.spawn` from `hub/src/accounts/poller.ts` (report-only, run 117424cc, A-8457). Found aside by impl-1053, which fixed the same pattern in T-1053's own fixture.

## Acceptance criteria

- [ ] C1. The test injects the existing `accountReader` port for its named account, and a targeted Linux run of the file reports no `child_process.spawn` tripwire finding for it.
- [ ] C2. The test's assertions are unchanged and pass.
