---
id: T-2109
kind: task
title: orphan-servers and session-native-lifecycle timeout diagnostics drop the fixture's retained stderr and journal, so a timeout cannot be attributed
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-25T14:27:15.413Z
updated: 2026-11-25T14:27:15.413Z
---

## Summary

impl-2031 found this in T-2031's red verify 648eea69 (A-23474, 2026-11-25). Two failures were the `orphan-servers.test.ts` "background sweep completes: not within 30000 ms" and the `session-native-lifecycle.test.ts` "native resume is pending: not within 30225 ms". Each left only a timeout stack (log lines 52416–52421 and 52531–52536). Both fixtures keep the child's stderr and journal internally, but drop them on the timeout path, so nobody could tell whether these timeouts shared T-2031's /proc ENOENT cause or were unrelated.

## What to build

On the timeout path of those two cases, include a bounded, redacted tail of the retained stderr and journal (from the producer's native receipt) in the failure message, the same way the other owned fixtures report on failure.

## Acceptance criteria

- [ ] C1. A forced timeout in each of the two cases reports a bounded, redacted stderr and journal tail alongside the timeout stack (test).
