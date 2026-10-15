---
id: T-511
kind: task
title: Cancelled local verify leaves the suite lock held when a fake child recreates the suite root; admission refuses cleanup forever
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T15:58:21.157Z
updated: 2026-10-15T15:59:15.048Z
---

## Summary

Cancelling a local verify can wedge local admission for good. On 2026-10-15 at 15:09:59Z, `cland verify cancel` of cff20897 killed the runner (pid 48812, group 53758). Fake harness processes then recreated the suite root `/tmp/cland-suite-<token>-1`, so its inode no longer matched the holder's recorded inode. From then on, every admission attempt ran recovery, hit `suite root identity changed; refusing cleanup` (hub/src/suite-lock.ts:67), and left `/tmp/cland-suite.lock` and the nvim lock held by a dead pid. No local run started for 48+ minutes, and the queue showed `local: none` with the integrated cover waiting.

## Acceptance criteria

- [ ] C1. A cancel stops the runner's whole process tree, fake harness descendants included, before it removes the suite root. A root recreated after that is still recognised as the run's own by token and owner.
- [ ] C2. When the holder pid and runner group are dead and the root differs only by identity, recovery releases the locks and quarantines the root (renames it, without deleting it) instead of refusing forever. It journals `suite-recovery-quarantined` with both inodes.
- [ ] C3. `cland verify queue` shows a blocked admission with its reason, instead of `local: none` beside a waiting run.
- [ ] C4. A test cancels a run whose fake child recreates the root after the kill, and the next local run is admitted.

## Comments

### coord · 2026-10-15T15:59:15.048Z

Repaired by hand under the human's approval at 15:58Z; see T-204. The quarantined lock files are kept for diagnosis in the Coordinator job tmp until this is fixed.
