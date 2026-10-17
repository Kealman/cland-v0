---
id: T-697
kind: task
title: Suites and the droplet executor take the hub Clock, and an in-process fake provider and scripted machine replace HTTP, ssh and the worker in T2
state: open
status: review
size: M
criterion_seq: 4
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
updated: 2026-10-17T07:21:24.688Z
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

- [x] C1. A T2 test drives a whole remote verify (acquire, deliver, start, collect, release) on the in-process provider and scripted machine, advancing a `FakeClock`, with no child process, proved by the test and the tier lint.
  - done: impl-697 · 2026-10-17T07:03:00.533Z
  - verified: rev-31 [reviewer] · run rev-20261017-697-source-2 · 2026-10-17T07:21:24.688Z · commit 87077ecbce2427a5b17a07705b3807362bfdaa9c
- [ ] C2. With the default clock and process machines, `executor-run.test.ts` and `suite-close-recovery.test.ts` pass unchanged, 5/5 serially as whole files on the Mac and once in the task's droplet verify.
- [ ] C3. `demo-release.test.ts` falls from 44.9 s (A-3877) to 15 s or less, and `executor-droplet.test.ts` from 20.1 s to 14 s or less.
- [x] C4. An audit of the two converted files maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-697 · 2026-10-17T07:20:34.371Z
  - verified: rev-31 [reviewer] · run rev-20261017-697-source-2 · 2026-10-17T07:21:24.688Z · commit 87077ecbce2427a5b17a07705b3807362bfdaa9c

## Blocked by

T-685 (hub Clock seam).

## Comments

### impl-697 · 2026-10-17T06:37:41.037Z

Implemented the hub Clock across Suites, droplet acquisition/release/preparation, demo expiry and spend accounting. Added injectable provider/remote-run/host boundaries and a shared direct/HTTP fake provider; scripted fixtures omit the reaper, SSH/SCP and suite worker. First unchanged process regressions passed: executor-run 21/21 (112.98s), suite-close-recovery 5/5 (33.63s). Running the required five serial whole-file repetitions at load <15; the audit will map all original declarations and timing allowances.

### coord · 2026-10-17T06:45:35.143Z

Coordinator decision, 06:46Z: the default for CLAND_TEST_DROPLET_MACHINE_MS stays 2000 ms for process-machine fixtures. It's a readiness timeout, not a delay. The requested 200 ms default rested on a wrong premise and made executor-run flaky under load: repetition 2 of 5 fell back to local. The in-process scripted machine needs no readiness bound. Any criterion text that asks for a 200 ms default is superseded by this decision, and the speedup is measured from cases moved onto the scripted machine.

### rev-31 · 2026-10-17T07:04:48.649Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-697-source-1
commit: d3648a5b1a7ea56c21e22f860aa4b3329e9f372c
scope: full
findings: [{"severity":"medium","text":"Advancing 1 virtual ms until arbitrary async work settles couples release/deletion deadlines to real I/O progress; held persistence can expire a bound before the intended observation.","file":"hub/test/remote-clock.ts","line":8}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; Standards1medium/Spec0additional findings, A-4343. All27paths reviewed. M1 driver requires explicit executor-wait admission/completion, time frozen during I/O, retained bounds/assertions and controlled held-I/O regression. Implementer03e3a0a7 confirms gap and correction; no verify submitted. C4 failed pending corrected migration-boundary proof. Clock/default transport/host ownership seams, shared provider engine/copies, explicit scripted-start receipt and mapped12demo/14executor assertions otherwise reviewed. A-4341 supplies35greenserialfiles including unchanged C2files5/5; timingmedians11.191demo/12.629executor support improvement but final task droplet pending. Coordinator22f800df independently supersedes200ms readiness premise, retain2000ms process bound. Fresh source review required before verification; no Reviewer edits/tests.

Criteria: C4 failed (Migrated release-boundary assertions depend on drive() consuming virtual deadlines during unrelated pending real I/O.).

### impl-697 · 2026-10-17T07:20:34.674Z

Corrected source is committed/pushed at 87077ecbce2427a5b17a07705b3807362bfdaa9c. A-4353 is the refreshed declaration audit and held-I/O red/green proof; A-4352 contains all35 corrected-head serial Mac whole-file receipts, each admitted below load15, plus census. C2 source files remain unchanged and each passes5/5. Combined median test-seconds including moved components: demo8.722 (<15), executor10.242 (<14). C2/C3 exact-head droplet receipt is pending source review. No dev merge after first source review; process readiness remains2000ms under Coordinator decision22f800df.

### rev-31 · 2026-10-17T07:21:24.688Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-697-source-2
commit: 87077ecbce2427a5b17a07705b3807362bfdaa9c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 remaining findings, A-4354. M1 resolved via product-delay collaborator with unchanged pause(ms,clock) default; driver awaits delay admission, advances once and observes completion, otherwise keeps time frozen through pending I/O. All9delta paths inspected; no devmerge. Controlled held-key-list regression observes independent status/releasing/key-retained/identicalclock, releases hook and awaits completion then cleanup; previous assertions/bounds retained. A-4352 has35green whole-file receipts at correctedhead, including newcontrol5/5 and unchanged C2files5/5. C1 whole scripted orchestration/census/tier and C4 updated12demo/14executor assertion audit verified; restoreC4claimantdone. C2/C3 await exact-head diff-selected taskdroplet compatibility/timing; Macmedians8.722demo/10.242executor support targets. Coordinator22f800df readiness2000ms retained. Cumulativediffcheck clean, typecheck/tierlint reportedgreen. No Reviewer edits/tests.

Criteria: C1 verified, C4 verified.
