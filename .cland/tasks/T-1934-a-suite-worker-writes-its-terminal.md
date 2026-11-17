---
id: T-1934
kind: task
title: A suite worker writes its terminal Finished log line before it persists the result, so a failed persist leaves a finished log with no durable completion
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-17T06:07:58.731Z
updated: 2026-11-17T06:07:58.731Z
---

## Summary

The suite worker writes its terminal "Finished" log line before it persists and renames the result: hub/src/suite-worker-admission.ts:41–42 (before T-1850's extraction, suite-worker.ts:118–120). If the persist rejects, the log says the run finished, but there is no durable completion, which local executor status requires. Found by the Reviewer during T-1850's source review (topic-1589, 2026-11-17). It is a source-only finding, with no fault injection run; T-1850 kept the existing order.

## What to build

Settle the durable result receipt first, then write the terminal notice. When the persist rejects, the log reports that instead of "Finished".

## Acceptance criteria

- [ ] C1. A test with a held persist shows no terminal Finished line until the result is durable, and a test with a rejected persist shows a non-finished terminal cause in the log and no Finished line (test, under rule 25).
- [ ] C2. Local executor status and the suite summary read the same outcome as the durable receipt in both cases (test).
