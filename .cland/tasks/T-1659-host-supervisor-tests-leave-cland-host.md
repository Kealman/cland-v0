---
id: T-1659
kind: task
title: "host-supervisor tests leave 'cland host serve' agents alive after passing: cleanup never captures agent ownership"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1594
topic: null
branch: null
created: 2026-11-03T07:18:11.410Z
updated: 2026-11-03T07:18:11.410Z
---

## Summary

Found by QA's process census in the E-1532 stage-2 run (qa-678, topic-1362, dev 722f1ce5). Rows 04 and 05 ran `hub/test/host-supervisor.test.ts` six times. Afterwards, 18 `cland host serve` processes survived, three per invocation. They have this run's worktree argv, births at 07:02–07:03Z, and their cwd sits under the hs-* and hs-owner-* fixture roots, including row 05's long root. Every TAP assertion passed, and the fixture directories were removed.

Cause, from QA's read of the source (the survivors themselves are observed): host-supervisor.test.ts:65, 94–98 and 155 close harnesses and supervisors but never capture the agents' ownership, and process-cleanup.ts:436 selects only seed PIDs that are not group leaders, taking whole groups only for group leaders. So the supervisor's agent descendants escape cleanup. Leaked fixture processes accumulate across suites; see the orphan census in the hourly check, with 97 leaked pairs on 2026-10-29 (T-1445).

## What to build

The fixture records every agent the supervisor starts, by PID and start identity, and teardown stops and joins them before the root is removed. Any other fixture that starts supervised agents gets the same, or a recorded reason why it is unaffected. Add a post-file census assertion: no `cland host serve` whose cwd is under the file's roots survives teardown.

## Acceptance criteria

- [ ] C1. After host-supervisor.test.ts passes, no `cland host serve` process whose cwd is under its fixture roots survives, checked by a census assertion with a positive control taken before the fix (test).
- [ ] C2. The same holds with five load-gate repetitions and the long macOS suite TMPDIR root (test).
