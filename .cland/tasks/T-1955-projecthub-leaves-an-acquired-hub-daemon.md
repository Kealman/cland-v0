---
id: T-1955
kind: task
title: projectHub leaves an acquired hub daemon and log without teardown when registerHubCards or the readiness assertion rejects
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
created: 2026-11-18T02:12:33.701Z
updated: 2026-11-18T02:12:33.701Z
---

## Summary

In hub/test/harness.ts, projectHub's catch paths clean up after serveProject and processLog.flush failures. But registerHubCards and the readiness assertion can reject after the daemon and log are acquired and before stopFixtureHub is assigned, which leaves a live hub and log with no teardown owner. Found by impl-1947 while reviewing T-1947 (topic-1608, 2026-11-18). T-1947 left this path out of scope (A-21005), and nothing has been reproduced.

## What to build

Teardown ownership is installed as soon as the daemon and log are acquired, so any later rejection stops the hub and flushes and closes the log before the error propagates. This uses the same whole-case ownership pattern that T-1947 adds.

## Acceptance criteria

- [ ] C1. A fake registerHubCards rejection and a failing readiness assertion each leave no live hub process, socket or open log after the test, and both reject with their original error (test).
- [ ] C2. projectHub's callers are unaffected: the T-1947 census list (A-21000) is checked against the change (rule 41).
