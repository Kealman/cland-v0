---
id: T-1669
kind: task
title: A scripted fake-Claude __session from a fixture outlived its test for nine days, reparented to launchd with its spoke
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-04T00:16:33.070Z
updated: 2026-11-17T23:14:15.038Z
---

## Summary

On 2026-11-04 impl-1607 found PID 42652 (`hub/test/fakes/claude-code/fake-claude.ts __session 14468a72`, from the T-1274 worktree) with PPID 1, elapsed 9 d 15 h. Its `cland-spoke.ts` child was PID 43277. Some fixture launched a scripted fake-Claude session and never joined it. coord sent SIGTERM to both literal PIDs; both exited. Which test leaked it is unknown.

## What to build

Find the fixture path that can leave a fake-Claude `__session` (and its spoke) running after its test ends, and make that path own and join it, as T-1659 did for host agents. Add a post-file census for fake-Claude sessions to the Claude adapter test files.

## Acceptance criteria

- [ ] C1. The leaking fixture path is named, with a deterministic reproduction that leaves a `__session` alive before the fix (test).
- [ ] C2. After the fix, the Claude adapter test files end with an empty census of fake-Claude sessions and spokes, including on a failing test (test).
