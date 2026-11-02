---
id: T-1610
kind: task
title: Flush before verify and ready, and the clause
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1609
topic: null
branch: null
created: 2026-11-02T03:33:57.872Z
updated: 2026-11-02T03:33:57.872Z
---

## Summary

`cland verify` and setting an item `ready` from a host session first ask the host's agent to flush the task branch's push. The CLI reports the worktree's HEAD, and the hub compares it with the territory head, refuses a mismatch naming both, and verifies from the territory branch, never from the session's directory. The Implementer's clause says that cland pushes the task branch for host sessions, within the clauses' byte reserve.

Hot files: `hub/src/hub/dispatch.ts`, `hub/src/cli/suite.ts`, `hub/src/cli/task.ts`, `hub/src/roles/default-roles.ts`, `hub/test/host-flush.test.ts` (new)

## Acceptance criteria

- [ ] C1. `cland verify` from a fake host session whose last commit was not yet pushed waits for the flush and runs at the territory head equal to the reported HEAD (test).
- [ ] C2. `cland task edit <id> --status ready` from a host session flushes first, and is refused with both heads named when the territory head still differs after the flush (test).
- [ ] C3. A verify from a host session never reads the session's working directory on the hub's machine (test).
- [ ] C4. Local sessions' verify and ready behave as today, and the verify-cli and task-cli test files pass with no test edited.
- [ ] C5. The Implementer's clause has one sentence saying that on a host cland pushes the task branch on every commit, and `roles-clauses.test.ts` passes with its reserve and growth ceilings unchanged.

## Notes

Shared files: `hub/src/hub/dispatch.ts` (verify submission and `task.edit` status), `hub/src/roles/default-roles.ts` (sole clause edit in E-1532)
