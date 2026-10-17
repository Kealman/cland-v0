---
id: T-723
kind: task
title: pid-identity 'a stop whose claude stop fails never SIGTERMs a reused pid' fails with 'database is locked' under load
state: open
status: planned
size: S
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T01:06:44.540Z
updated: 2026-10-17T21:48:42.618Z
---

## Summary

hub/test/pid-identity.test.ts "Claude Code: a stop whose `claude stop` fails never SIGTERMs a pid that another process reuses" fails now and then with `Error: database is locked` (ERR_SQLITE_ERROR). It failed in three runs: 2410465e (A-1151), 0ea19bdd (A-3306) and a4c094d5 (A-4259, T-689's droplet run at 19be0a95, outside its diff). Something in the case or its fixture writes the hub database while another handle holds a lock, and load decides who wins.

## What to build

Find which two writers contend, the test fixture or the hub under test, and make the case wait on the observable stop outcome instead of racing a second database handle. Use a single handle or the hub's own busy timeout if the product genuinely needs two. Keep the case a T3 lifecycle test, since it proves the stop path doesn't signal a reused pid, and keep its assertions' meaning.

## Acceptance criteria

- [ ] C1. The cause of the lock is recorded on this item and fixed, with the case's assertions unchanged in meaning.
- [ ] C2. pid-identity.test.ts passes 10/10 serially as a whole file on the Mac at load above 8, and in the task's droplet verify.
