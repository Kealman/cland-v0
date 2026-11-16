---
id: T-1796
kind: task
title: macOS stage cover T2 stalled 10 min after its last file passed (command end 1, no failing test)
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: null
branch: null
created: 2026-11-09T18:33:53.922Z
updated: 2026-11-16T07:28:46.517Z
---

## Summary

The macOS local stage cover e50b7ddb at dev 700f88ce (A-18171) ended `exit 1; stalled: no output for 10 min` in T2 with no failing test: 1611 pass, 0 fail. The last T2 files, web-tunnel-guide.test.ts and web-upload.test.ts, both ran to `finish … outcome pass`. Then the log shows `suite command end … 1` and nothing more until the 10-minute stall guard fired. So the T2 command didn't exit after its last file completed: a handle or child process survived the file teardown, or the runner waited on something. Its "last started tests" list names files that had in fact finished. Alone, both files pass 5/5 in about 1 s each on macOS at the same commit.

## Acceptance criteria

- [ ] C1. Identify what kept the T2 command alive after its last file finished: a live handle, a child process or a runner wait. Retain the evidence in the stall report (for example the active handles or child processes at the stall) (test).
- [ ] C2. The stall report's "last started tests" lists only tests that started without finishing (test).
