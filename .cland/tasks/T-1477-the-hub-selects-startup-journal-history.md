---
id: T-1477
kind: task
title: The hub selects startup journal history without reading the whole file
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:54:04.775Z
updated: 2026-10-30T07:54:17.846Z
---

## Summary

At startup the hub reads the whole journal (374 MB, 1.1 M lines on this project) into one UTF-8 string, about 0.7 GiB of peak heap (A-14160, `readJournal` journal.ts:483,492). Select the startup history by streaming bounded complete lines or from a durable checkpoint, sharing one in-flight scan, without changing replay semantics.

## Acceptance criteria

- [ ] C1. Startup journal selection never holds the whole file in one string. It streams complete lines in bounded chunks, or resumes from a durable checkpoint, and produces the same selected records as today on a recorded journal fixture.
- [ ] C2. Concurrent readers of the startup history share one scan.
- [ ] C3. On the T-1467 scratch copy, the heap at the journal-read checkpoint drops by at least 500 MiB against A-14160's 743.7 MiB, same probe and machine.
- [ ] C4. A test with a journal of at least 300 MB of synthetic lines asserts peak bytes held for the selection stay under a fixed bound (a work-count guard, rule 23).
