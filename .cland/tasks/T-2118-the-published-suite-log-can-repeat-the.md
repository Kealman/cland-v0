---
id: T-2118
kind: task
title: The published suite log can repeat the coverage-download.log pointer when a log-inspection retry lands between the append and the finalized-log checkpoint
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-27T07:45:31.612Z
updated: 2026-11-27T07:45:31.612Z
---

## Summary

Found in T-2002's source review (impl-2002 and its reviewer, 2026-11-27). T-2002 appends a `coverage-download.log` pointer to the published suite log once coverage collection settles. The duplicate check reads the filtered `readSuiteEvidence`, which omits that prefix. An inspection retry after the append but before the finalized-log checkpoint can therefore append the pointer twice. The impact is low: the diagnostic bytes stay retained, and only the pointer line repeats.

## What to build

Make the pointer append idempotent against the raw published log or the finalized-log checkpoint, so a retry never adds a second pointer.

## Acceptance criteria

- [ ] C1. A forced inspection retry between the pointer append and the finalized-log checkpoint leaves exactly one pointer line in the published suite log (test with fakes).
