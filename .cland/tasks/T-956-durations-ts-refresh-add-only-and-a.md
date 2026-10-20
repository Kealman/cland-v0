---
id: T-956
kind: task
title: durations.ts refresh --add-only, and a manifest check for duration keys with no matching test
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:53:22.452Z
updated: 2026-10-20T09:53:58.117Z
---

## Summary

At a stage close, `node hub/test/durations.ts refresh <log>` rewrites every allowance to the cover's timings. In the v0.1.4 run it would have shrunk 329 allowances and dropped 15. So the Coordinator hand-merged only the new baselines with Node (dc71dac8). Add an add-only mode, and a check that refuses exact keys that no test identity matches.

## What to build

`durations.ts refresh --add-only <log>` adds baselines for tests and files missing from the manifest. It leaves existing baselines and allowances byte-for-byte unchanged, keeps number formatting and prints what it added. The manifest validation refuses an exact duration key or census expectation that names no existing test identity. This comes from retro finding 4 (A-7261) and cluster 6 of the rule batch (A-7281), which the human approved on 2026-10-20. Update docs/agents/tests.md's stage-close step, and the memory-backed habit, to use `--add-only` until T-931 decides how allowances refresh.

## Acceptance criteria

- [ ] C1. `refresh --add-only` on a log with new tests adds exactly their entries; a diff of the other entries is empty.
- [ ] C2. Manifest validation refuses a key with no matching test identity and names it.
- [ ] C3. docs/agents/tests.md's stage-close step names `--add-only`.
