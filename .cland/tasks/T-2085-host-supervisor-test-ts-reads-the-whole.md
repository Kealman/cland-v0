---
id: T-2085
kind: task
title: host-supervisor.test.ts reads the whole supervisor.log on failure before slicing 2,048 bytes (unbounded read, rule 42)
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-24T12:09:59.834Z
updated: 2026-11-24T12:09:59.834Z
---

## Summary

Low finding L1 from T-2009's clear source review (A-22918), reported by impl-2009. On failure, hub/test/host-supervisor.test.ts:300 reads the whole supervisor.log and only then slices the last 2,048 bytes, so the read is unbounded (rule 42). This applies to both the existing and the new supervisor catch paths.

## What to build

Read the failure-only supervisor.log tail through the shared bounded-read diagnostic helper, counting the kept bytes as they're read, for every supervisor catch path in the file.

## Acceptance criteria

- [ ] C1. Under a fake supervisor log larger than the cap, the failure diagnostic reads at most the cap plus one boundary byte and still reports the tail (test).
