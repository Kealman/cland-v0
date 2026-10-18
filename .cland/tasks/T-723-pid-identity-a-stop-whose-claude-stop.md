---
id: T-723
kind: task
title: pid-identity 'a stop whose claude stop fails never SIGTERMs a reused pid' fails with 'database is locked' under load
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-474
branch: t/T-723-pid-identity-a-stop-whose-claude-stop
created: 2026-10-17T01:06:44.540Z
updated: 2026-10-18T03:45:43.419Z
---

## Summary

hub/test/pid-identity.test.ts "Claude Code: a stop whose `claude stop` fails never SIGTERMs a pid that another process reuses" fails now and then with `Error: database is locked` (ERR_SQLITE_ERROR). It failed in three runs: 2410465e (A-1151), 0ea19bdd (A-3306) and a4c094d5 (A-4259, T-689's droplet run at 19be0a95, outside its diff). Something in the case or its fixture writes the hub database while another handle holds a lock, and load decides who wins.

## What to build

Find which two writers contend, the test fixture or the hub under test, and make the case wait on the observable stop outcome instead of racing a second database handle. Use a single handle or the hub's own busy timeout if the product genuinely needs two. Keep the case a T3 lifecycle test, since it proves the stop path doesn't signal a reused pid, and keep its assertions' meaning.

## Acceptance criteria

- [ ] C1. The cause of the lock is recorded on this item and fixed, with the case's assertions unchanged in meaning.
- [ ] C2. pid-identity.test.ts passes 10/10 serially as a whole file on the Mac at load above 8, and in the task's droplet verify.

## Comments

### impl-723 · 2026-10-18T03:45:43.419Z

C1 cause confirmed after merging origin/dev: T-763 (447064753250a8627f9d14c90ff96a07d5adb202), evidence A-4909, identified raw DatabaseSync handles without a busy_timeout. The fixture's stale Claude identity UPDATE competes with the live hub's independent harness_processes writes; the raw fixture handle formerly failed immediately with database is locked. T-763 moved all three pid-identity.test.ts hub.db handles (reusePid, pidRow and the Claude stale-identity UPDATE) to shared openDatabase, which sets pragma busy_timeout = 5000 before use. No raw node:sqlite import or DatabaseSync construction remains in this file. Assertions and PID refusal semantics are unchanged; no further source change is needed.
