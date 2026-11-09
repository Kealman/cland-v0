---
id: T-1799
kind: task
title: Stage-1 login test files leave their scratch roots after exit
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
regression_of: T-1774
topic: null
branch: t/T-1799-stage-1-login-test-files-leave-their
created: 2026-11-09T22:31:41.994Z
updated: 2026-11-09T22:32:13.280Z
---

## Summary

Two of E-1535 stage 1's test files leave their scratch roots on disk after they exit, which stage QA row E1534S1-79 rejects (A-18182). `hub/test/fake-harness-login.test.ts` leaves 21 `fake-login-*` roots: it creates them at line 17 and registers only `stopLoginHolder` at line 23, with no root removal. `hub/test/host-login-disk.test.ts` leaves 12 roots (`ld`, `ldc`, `ldi`, `lds`, `ldt`, `ldv`; allocated at lines 18–26, 190, 244, 264, 283 and 306) plus one root from the standalone held-close case.

## What to build

Every fixture root allocation in those two files registers its disposal as soon as it is allocated, ordered after the process teardown that already exists. Disposal uses literal or owned paths, never globs. Processes stay joined before their roots are removed, so a removal never races a live writer.

## Acceptance criteria

- [ ] C1. Running `fake-harness-login.test.ts` alone leaves no `fake-login-*` root in its TMPDIR, checked against a before/after inventory in the test or its fixture (test).
- [ ] C2. Running `host-login-disk.test.ts` alone, including the held-close case alone, leaves no root it allocated (test).
- [ ] C3. A root is removed only after the processes, holders and agents that used it have been joined; a planted failure in teardown still removes the root and reports the failure (test).
- [ ] C4. The existing cases of both files pass unchanged (test).

## Notes

- Hot files: `hub/test/fake-harness-login.test.ts`, `hub/test/host-login-disk.test.ts`, plus their shared fixture helpers if the disposal belongs there.
- Both files are T3; run them under the preservation lock.
- Found by stage-1 QA, run qa-e1535s1-2026-11-09-qa678-1, at 700f88ce.
