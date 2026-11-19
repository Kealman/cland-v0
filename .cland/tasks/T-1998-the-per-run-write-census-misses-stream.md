---
id: T-1998
kind: task
title: The per-run write census misses stream writes and renames, such as suite provenance's temp file
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-19T06:03:42.675Z
updated: 2026-11-19T06:03:42.675Z
---

## Summary

T-1957's per-run write census intercepts `writeFile`, `appendFile` and `open`, but not stream writes or renames. Suite provenance finalization (`suite-provenance.ts`) writes `suite.log.provenance.tmp` with `createWriteStream` and then renames it, so the census misses it. The census is scoped API evidence, not a complete per-run file inventory, as found at T-1957's final evidence review on 2026-11-19.

## What to build

Extend the run-directory write census to cover stream writes (`createWriteStream`), renames and temp files, and to distinguish a final inventory (what remains in the run directory) from the write calls observed. The aim is a complete per-run file census that later retention and watcher-scope changes can rely on.

## Acceptance criteria

- [ ] C1. A suite run's census records every file created in its run directory, including stream-written temp files and their renames, checked against a directory listing taken after the run (test with a positive control that adds a stream write).
- [ ] C2. The census output separates observed write calls from the final file inventory (test).
