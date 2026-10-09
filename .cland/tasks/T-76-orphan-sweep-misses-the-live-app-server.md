---
id: T-76
kind: task
title: Orphan sweep misses the live app-server of a session recorded as exited
state: open
labels:
  - ready-for-agent
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T16:38:16.092Z
updated: 2026-10-09T16:38:16.092Z
---

## Parent

Part of T-19, a follow-up to T-70. Found by the human's stand-in at the 16:37Z restart on 2026-10-09 (hub pid 14410).

## What happened

`cland doctor` warned "orphan harness pid 5067: no running session owns it": rev-7's Codex app-server, whose session the hub recorded as exited/offline. T-70's startup sweep did not end it, because the session row still existed. `cland session stop rev-7` ended it by hand.

## What to build

- The startup sweep, and `cland doctor --fix`, treat a harness server whose session is not `running` (exited, offline or stopped) as an orphan, with the same ownership proof T-70 uses: pid plus start time, and cwd or descent from a verified wrapper.
- Doctor's warning names the session that owned it and the fix command.

## Acceptance criteria

- [ ] A fake Codex app-server left alive behind a session recorded as exited is ended by `cland hub start` and reported by `cland doctor`, which names the session.
- [ ] A running session's server still survives the sweep.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Follow T-70's ownership rules (A-96, class D).
