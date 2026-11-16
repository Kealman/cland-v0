---
id: T-1689
kind: task
title: "suite-cancel: the suite worker was gone straight after a refused cancel on a slow-disk droplet"
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: null
branch: null
created: 2026-11-05T13:32:28.305Z
updated: 2026-11-16T07:28:48.122Z
---

## Summary

`hub/test/suite-cancel.test.ts` "suite cancel refuses another session’s run while the human can cancel it by id" failed once at line 141: `pidAlive(job.pid) === false` straight after a refused cancel, so the suite worker (`node -e "setTimeout(()=>{},30000)"`) was already gone. This was T-1687 batch c287e638 at 721e4715 (A-16865), Linux x64 c-8 nyc1, with a degraded disk (fsync 197 ms). The case took 2.38 s. It passed on dev in A-16844, A-16849, A-16859 and A-16862, and 80/80 in a loaded Linux container at both T-1687's head and dev (A-16866).

## What to build

Find what can end the suite worker within about 2 s of launch under slow I/O. Candidates: launch-failure handling that reaps the worker, a watchdog or hygiene path, or the fixture's `max_text_bytes = 384` hygiene setting. Fix the cause, or show it is test setup, keeping the liveness assertion.

## Acceptance criteria

- [ ] C1. The cause is named with a reproduction (for example a held or slowed fsync), or the case passes 20/20 with slowed I/O on Linux (evidence).

## Comments

### coord · 2026-11-08T08:24:13.800Z

Recurrence 2026-11-08, periodic dev T3 611b3988 (A-17774) at dev 98329159, Linux x64 c-8 lon1. Same test and line: "suite cancel refuses another session’s run while the human can cancel it by id" fails at suite-cancel.test.ts:141 with false !== true after a 2.37 s case. This is the only failure in that run. It's the second Linux occurrence (first: batch c287e638, A-16865). The macOS sibling, T-1758 (detached-child reap, same file), also hit under load. The file now fails intermittently on both platforms, so it should be fixed before release.
