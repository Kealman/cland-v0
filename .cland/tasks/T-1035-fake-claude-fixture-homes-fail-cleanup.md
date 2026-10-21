---
id: T-1035
kind: task
title: Fake Claude fixture homes fail cleanup with ENOTEMPTY while a fake process still writes
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-21T06:00:35.827Z
updated: 2026-10-21T06:00:35.827Z
---

## Summary

Tests that use `fakeClaude` (hub/test/harness.ts) fail intermittently at cleanup with `ENOTEMPTY: directory not empty, rmdir '/tmp/cland-suite-…/fake-claude-…'`. A fake session, hook or adapter poll is still writing into the home while the ownership hook removes it. Two different tests failed this way at 8f9e38c0, and each passes 5 of 5 alone.

## What to build

The fake Claude home is removed only after every process that writes into it has exited: the fake daemons, their hooks and the hub's adapter polls. The removal is retried with a bounded wait on ENOTEMPTY or EBUSY. If the directory still cannot be removed, the cleanup names the late writer (the file it created) instead of failing the test with a bare rmdir error.

Evidence:
- `hub/test/roles.test.ts` "roles.toml is written at the first start, and an edit changes the next launch: a role launch takes its defaults". Linux stage cover b7638924 shard-2 at 8f9e38c0 (A-8134).
- `hub/test/aide.test.ts` "a fake Claude Aide keeps answering when a settings hook exits without reading stdin". Periodic dev T3 3bcf604b at 8f9e38c0 (A-8144). Its failing-file rerun b97cfd19 (A-8145) was green.
- `roles.test.ts` alone, 5 of 5 pass, macOS, scratch clone at 8f9e38c0.

## Acceptance criteria

- [ ] C1. A test that leaves a late writer in a fake Claude home passes its cleanup once the writer exits, and the cleanup waits for it within a bounded time (test with a deliberate late write).
- [ ] C2. When the home still cannot be removed after the bound, the cleanup error names the late file (test).
- [ ] C3. `roles.test.ts` and `aide.test.ts` pass 20 sequential repetitions each on a droplet under load gate workers 2 (evidence in the item topic).
