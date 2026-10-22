---
id: T-1079
kind: task
title: The full Neovim fixture recorder aborts on a native test file that records no frames
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-826
branch: t/T-1079-the-full-neovim-fixture-recorder-aborts
created: 2026-10-21T17:52:08.489Z
updated: 2026-10-22T01:03:33.808Z
---

## Summary

`npm run test:nvim-fixtures` (the full recorder) aborts with "fixture refresh failed: nvim/test/artifact-browser.test.ts recorded 0 frames; expected at least 1". That file's three tests pass, but it is a native real-hub consumer that produces no stub capture, and the recorder selects it anyway. The guard leaves every fixture unchanged, so a full refresh is impossible until the file is excluded or records. Found by impl-1052 at 21c10189 (T-1052); the `--from-recordings` path still works.

## Acceptance criteria

- [ ] C1. The full recorder selects only files that record frames, or skips a native consumer that records none and names it, and completes on dev (test).
- [ ] C2. A file meant to record that records zero frames still fails the refresh (test).
