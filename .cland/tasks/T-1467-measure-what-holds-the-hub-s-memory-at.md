---
id: T-1467
kind: task
title: Measure what holds the hub's memory at startup and at rest
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
created: 2026-10-30T06:38:36.583Z
updated: 2026-10-30T06:38:47.768Z
---

## Summary

Measure what holds the hub's memory at startup and at rest on a scratch copy of this project's live data, and name the top retainers with sizes and code paths, so the fix tickets can be cut from facts.

## What to build

- A reproducible measurement script, committed under `hub/test/` or `tools/`. It copies the live project's `.cland` state into a disposable root (rule 15) and starts a sealed hub on it. It samples RSS, heap used and total, external memory and array buffers every second through startup and 10 minutes at rest. It takes heap snapshots at the end of startup and at rest.
- An artifact with the breakdown:
  - the top retainers by retained size, with their code paths, such as tracker index, artifact index, message history, coverage maps, journals and caches;
  - the non-heap memory: buffers, SQLite and native;
  - the growth over time, if any.
- Each holder gets a proposed fix and its estimated saving.

Context: hub 88459 (v0.3.0) held 3.0 GB RSS 80 s after start on this project (about 1,460 tracker items, 14,000 artifacts). Hubs run with an 8 GB heap cap since the restart-#22 OOM (T-912). Earlier fixes with the same pattern: T-912, T-1038, coverage-map OOM, T-1436. Rule 23 applies to any fix.

## Acceptance criteria

- [ ] C1. The script runs a sealed hub on a scratch copy of the live `.cland` state, never the live hub, and records RSS, heap and external memory at startup and after 10 minutes at rest.
- [ ] C2. An artifact names the top ten retainers by retained size from heap snapshots at startup and at rest, with code paths, plus the non-heap breakdown.
- [ ] C3. The artifact proposes a fix per holder with an estimated saving and a suggested RSS budget for a project of this size.
