---
id: T-697
kind: task
title: Suites and the droplet executor take the hub Clock, and an in-process fake provider and scripted machine replace HTTP, ssh and the worker in T2
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-685
topic: topic-420
branch: t/T-697-suites-and-the-droplet-executor-take-the
created: 2026-10-16T19:59:36.515Z
updated: 2026-10-17T06:27:44.260Z
---

## Summary

The executor and suite files are the heaviest class: `suite-remote-budget` 143.9 s, `executor-safety` 129.0 s, `executor-run` 104.2 s, `executor-prepare` 75.6 s and more (memo §5.5 step 2). Every one of them goes through `hub/test/remote-fixture.ts`: a fake DigitalOcean HTTP server, fake `ssh`/`scp` binaries, a real suite worker on each fake machine, and a fixed 2000 ms machine-ready delay per droplet (`CLAND_TEST_DROPLET_MACHINE_MS`). `Suites` and the droplet modules read `Date.now` and real timers directly (`suites.ts`, `droplet.ts`, `prepare.ts`, `run.ts`, `watchdog.ts`, `cleanup.ts`). This ticket is the class's enabler; T-698 to T-700 use it.

## What to build

- **The clock.** `Suites` and the droplet executor take T-685's `Clock`; `serveProject` passes the hub's.
- **An in-process provider.** A fake with the `DigitalOceanApi` shape and the same state machine and fault knobs as `fakes/digitalocean/fake-api.ts`, without an HTTP server.
- **A scripted machine.** The executor's deliver, start, status, log and collect steps are answered in-process from a script (green, red with a failure list, lost, slow), with no `ssh`, `scp` or suite worker process.
- **The fixture.** `remote-fixture.ts` offers `machine: 'scripted' | 'process'`. The process machines keep the HTTP fake for T3 lifecycle tests, and their ready delay defaults to 200 ms; only the watchdog-timing case sets its own.
- **First consumers.** `demo-release.test.ts` (44.9 s) drives the demo release state machine in-process, keeping the detached-watchdog test and one `demo stop` through the hub as T3. `executor-droplet.test.ts`'s role table (a spawned hub plus four spokes) runs through the dispatcher.

## Acceptance criteria

- [ ] C1. A T2 test drives a whole remote verify (acquire, deliver, start, collect, release) on the in-process provider and scripted machine, advancing a `FakeClock`, with no child process, proved by the test and the tier lint.
- [ ] C2. With the default clock and process machines, `executor-run.test.ts` and `suite-close-recovery.test.ts` pass unchanged, 5/5 serially as whole files on the Mac and once in the task's droplet verify.
- [ ] C3. `demo-release.test.ts` falls from 44.9 s (A-3877) to 15 s or less, and `executor-droplet.test.ts` from 20.1 s to 14 s or less.
- [ ] C4. An audit of the two converted files maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.

## Blocked by

T-685 (hub Clock seam).
