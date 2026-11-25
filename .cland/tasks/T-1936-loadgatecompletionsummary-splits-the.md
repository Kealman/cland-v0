---
id: T-1936
kind: task
title: loadGateCompletionSummary splits the whole retained semantic log into an array (unbounded allocation, rule 23)
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
regression_of: T-1582
topic: null
branch: null
created: 2026-11-17T07:21:10.812Z
updated: 2026-11-25T13:02:26.922Z
---

## Summary

`loadGateCompletionSummary` in hub/src/suite-load-gate-plan.ts (landed with T-1582, 1e4bceff6) runs `log.split('\n')` over the entire retained semantic log, which has no fixed byte or line bound. That allocates an array of the whole history on every batch completion, against rule 23 and suite-log.ts's incremental line policy. Raised by the Reviewer during T-1931's delta review at 84ce9a604 (topic-1584). T-1931's own marker scanner in the same file was already made bounded at review.

## What to build

Scan the log incrementally (an index-based line walk or a shared pure line iterator) with bounded extra storage, keeping the same results: complete, unknown and skipped sets.

## Acceptance criteria

- [ ] C1. loadGateCompletionSummary returns identical counts for the existing fixtures, plus a large planted log, without creating a whole-log array (test that bounds the work, as T-1931's bounded-scan control does).
