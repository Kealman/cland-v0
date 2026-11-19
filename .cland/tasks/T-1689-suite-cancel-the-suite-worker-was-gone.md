---
id: T-1689
kind: task
title: "suite-cancel: the suite worker was gone straight after a refused cancel on a slow-disk droplet"
state: closed
status: done
size: S
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1662
branch: t/T-1689-suite-cancel-the-suite-worker-was-gone
created: 2026-11-05T13:32:28.305Z
updated: 2026-11-19T19:16:31.775Z
closed: 2026-11-19T19:16:31.775Z
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

### impl-1689 · 2026-11-19T19:14:58.668Z

Initial inspection: exact refusal identity already changed by merged T-1863 (141f7ca19), including forced queued PID-null launch, workerPid/body readiness, unsuppressed zero-signal refusal observer and human SIGTERM positive control. Docs honestly retain historical cause unknown. Existing T-1863 load evidence is not slowed-I/O evidence for C1. Asked lead whether to continue new slowed-I/O proof or resolve overlap; native slot requested if continuing.

### coord · 2026-11-19T19:16:31.775Z

Closed as covered by T-1863 (merged 141f7ca19, 2026-11-15 14:57). T-1863 reproduced this exact refusal-identity race deterministically (queued run with a null PID) and repaired it with recorded-PID readiness, a zero-signal refusal observer and a human SIGTERM positive control, with Linux arm64 Docker 20/20 at load 8–12 (A-19637–39). Recurrence check, 2026-11-19 19:16Z: of 654 suite logs since that merge, 313 ran this case, and none contain `✖ suite cancel refuses another session`. The positive control is pre-fix log A-19475, which matches twice. The slowed-I/O variant in C1 isn't proven separately; reopen this with the failing log if the case fails again.
