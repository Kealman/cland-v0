---
id: T-1151
kind: task
title: hub.stop never reaches stopped while a droplet create is in flight, and SIGTERM is ignored
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-864
branch: t/T-1151-hub-stop-never-reaches-stopped-while-a
created: 2026-10-22T18:04:51.275Z
updated: 2026-10-22T20:01:55.456Z
---

## Summary

At hub restart #46 (2026-10-22 18:01Z, dev fe32111d, cland-impl), stop-requested arrived at 18:01:58.56Z, followed by "stopping". During the stop, the culprit-search droplet create completed: executor-lease-active for lease 310e2a8e (run 44563eb7) at 18:01:59.4Z. No "stopped" line followed. The CLI's SIGTERM at 18:02:08.6Z was ignored, and the recipe had to SIGKILL the hub at 18:02:24Z, 26 s after the stop. T-1060/T-1062 covered a stopped hub whose process lingers; here the hub never reaches stopped. The bridge gap reached 46.7 s of the 60 s mod-bridge grace, and the killed hub left droplet cland-v0-310e2a8e active with no owning run.

## What to build

hub.stop aborts or detaches in-flight executor provisioning within a bounded time. It records the lease for the next hub's reconciliation, still logs "stopped", and exits. SIGTERM always leads to exit.

## Acceptance criteria

- [x] C1. A hub stopped while a fake droplet create is in flight logs "stopped" and exits within 3 s, and its lease is recorded for reconciliation (test).
  - done: impl-1151 · 2026-10-22T19:48:11.942Z
  - verified: rev-26 [reviewer] · run rev-20261022-1151-final-1 · 2026-10-22T20:01:55.367Z · commit ab354a67f67862eec5ac14eae9556cd0ca598f05
- [x] C2. SIGTERM to a hub blocked in executor provisioning exits within 3 s (test).
  - done: impl-1151 · 2026-10-22T19:48:12.000Z
  - verified: rev-26 [reviewer] · run rev-20261022-1151-final-1 · 2026-10-22T20:01:55.367Z · commit ab354a67f67862eec5ac14eae9556cd0ca598f05

## Comments

### impl-1151 · 2026-10-22T19:46:55.392Z

Test-first reproduction: held fake POST /droplets caused daemon C1 `hub stop did not reap provisioning hub within three seconds` on macOS/local. A second red case held native socket close during SIGTERM and also exceeded three seconds. Cancellation now detaches provider waiters while retaining durable creating/releasing leases, suite shutdown closes its executor and avoids fallback, and SIGTERM/SIGINT have a two-second exit fallback. Targeted process and scripted ownership tests now green; checking regression files and docs before source review.

### rev-26 · 2026-10-22T19:51:55.439Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1151-source-1
commit: ab354a67f67862eec5ac14eae9556cd0ca598f05
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-9431 records both axes. Provider abort/detachment and polling cancellation preserve unresolved mutation ownership, Suites closes its executor before draining launch work and avoids shutdown fallback, and signals retain a non-resetting2s exit fallback. New tests retain stopped/OS-reaped/late-reconciliation/foreign-resource assertions at appropriate T1/T2/T3 seams. Matching help/docs/skill provenance present; no findings in the change. C1/C2 remain unverified pending attributable exact-head native daemon T3 receipt plus configured mode-free same-head verification. Existing pre-create reservation-lock cancellation gap reported separately as Bugs/S follow-up, not a failure of these held-provider-create criteria.

### rev-26 · 2026-10-22T20:01:55.367Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1151-final-1
commit: ab354a67f67862eec5ac14eae9556cd0ca598f05
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-9439 settles same-head375711e8/A-9438:2529/2529 ordinary passes, Linux c-8 lon1 T1/allT2/Web, hostT0 gate not repeated. Three owned T1/T2 identities have actual distinct5/5 load passes. A-9432 is exact-head/tree macOS native daemon T3 evidence18/18, preserving durable stopped/OS exit within asserted unscaled3s, signal deadline exit1, retained lease/late-create reconciliation and foreign-resource protection. Printed whole-test durations are not shutdown latency samples. Report-only budget warnings retained, including Web51.63s>40s; no Linux/fullT3/T4/QA claim. No findings in reviewed scope; existing pre-create lock gap separately reported as follow-up. No merge performed.

Criteria: C1 verified, C2 verified.
