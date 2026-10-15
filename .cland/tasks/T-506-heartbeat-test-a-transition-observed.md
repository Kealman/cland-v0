---
id: T-506
kind: task
title: "heartbeat test: a transition observed during the test is aged from the fixture's old updated date (Linux)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-454
topic: topic-304
branch: t/T-506-heartbeat-test-a-transition-observed
created: 2026-10-15T15:16:16.009Z
updated: 2026-10-15T16:28:56.293Z
---

## Problem

`hub/test/heartbeat.test.ts:260` failed on Linux in T-495's droplet verify d6e75622 (A-3101): expected 0 heartbeats, got 1. The watched review→ready transition took a newly observed stale state as already aged, because the item carried an old `updated` date. This is T-454's test, so it's rework of T-454.

## Acceptance criteria

- [x] C1. The case controls the item's `updated` time, or the clock it's aged against, so a transition observed during the test is never aged from a fixture date. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-506 · 2026-10-15T15:32:35.295Z
  - verified: rev-30 [reviewer] · run rev-20261015-506-source · 2026-10-15T15:34:03.268Z · commit 704b85f32b03632eff127bad6d9f229a67ec4215
  - verified: rev-30 [reviewer] · run rev-20261015-506-delta · 2026-10-15T16:20:33.779Z · commit edc3cda4d526922a3d6d870501d174bcbd39d223
- [ ] C2. heartbeat.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-506 · 2026-10-15T15:19:10.326Z

Baseline targeted case passed once (1.65 s). The case currently uses real 200 ms age while serially awaiting two watched file edits; scheduler delay can mature the first transition before the first assertion. Plan: retain real tracker watcher and assertions, use existing in-process HubOptions.now seam to pin observation/firing time and advance the clock explicitly. No production behavior change.

### rev-30 · 2026-10-15T15:34:03.268Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-506-source
commit: 704b85f32b03632eff127bad6d9f229a67ec4215
scope: full

Source review clear at 704b85f32b03632eff127bad6d9f229a67ec4215, compared against pre-task base 02d5b91c. No high, medium or low source findings.

Standards: existing in-process HubOptions.now and Tracker.now seams share one clock; real watcher, CrewFile, WebSocket UI and spoke remain active. Clock movement is explicit and commented; no production edits, relaxed assertions or expanded timeout. Existing fixture style and observed positive waits are retained. Shared heartbeat duration entry is correctly inside allow with measured 5.113-second A-3109 provenance. Diff whitespace check passes; implementer reports typecheck green.

Spec: C1 verified. The clock freezes after the initial heartbeat, advances 250 ms while paused to make the schedule overdue, remains fixed through both real watched old-updated transitions, then advances exactly one 200 ms interval after asserting stale=0. Hub transition observation and heartbeat digest use the same now seam; stale=2 is still required after the interval. Both old updated-date equality assertions remain. Commit body records why real scheduler time previously matured otherwise valid transitions. A-3112 documents exact-assertion failure after a temporary 250 ms staging delay; that probe is absent from final source.

Runtime evidence A-3125 is incomplete: four quiet whole-file runs pass 9/9 (36/36); fifth changed case passes but separate run-digest case fails and runner was still alive without terminal counts. This is not 5/5 whole-file evidence. C2 stays unverified pending resolved local evidence and Linux verification. Aside for lead: Bugs/S, heartbeat.test.ts:174 run-digest case failed and the fifth file did not exit; A-3125 lacks the terminal error/stack, so classification remains with the lead, as already requested by implementer.

Both axes reviewed directly under no-delegation role. No Reviewer tests or edits. Source clearance does not override Coordinator e6ea9694 restart/cover hold: no new verify until restart notice; no local tests while cover owns local slot.

Criteria: C1 verified.

### impl-506 · 2026-10-15T15:34:18.147Z

Source clear by rev-30 at 704b85f3; C1 verified. Quiet serial Mac runs 1–4 green (9/9, 21.8/17.8/16.8/16.8 s). Fifth changed case green (0.77 s) but separate run-digest case failed with ENOTEMPTY during scratch directory teardown; runner hung, terminated own node --test PID with Coordinator authorization. Both requested leftover PID checks empty. Per Coordinator decision a649495a, C2 requires five fresh whole-file passes after restart; no new local tests or verifies while cover/restart hold is active.

### rev-30 · 2026-10-15T16:20:33.779Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-506-delta
commit: edc3cda4d526922a3d6d870501d174bcbd39d223
scope: delta

Delta source review clear at edc3cda4d526922a3d6d870501d174bcbd39d223, compared with 704b85f32b03632eff127bad6d9f229a67ec4215. No high, medium or low findings.

Standards: parsed semantic comparison confirms all prior manifest fields and allowances preserved. New rule-sessions clause/brief allowance is correctly under allow, 5.043 seconds with real-launch rationale and A-3139 provenance, exactly shared bdf418e6. No production change or budget-wide bypass. Diff whitespace check passes.

Spec/evidence: Only four manifest lines changed. Heartbeat task file is byte-identical to source-clear 704b85f3: shared frozen clock, real watched old-updated transitions, overdue schedule and stale=0/full-interval stale=2 assertions retained. C1 reverified. C2 requires the five fresh whole-file Mac passes directed after the T-508 unrelated teardown failure, plus Linux task verification; claimant reports fresh sequence in progress. No prior incomplete fifth run is counted as green.

Both review axes performed directly under no-delegation role. No Reviewer tests or edits. Coordinator 6c0d565f lifts the restart hold: finish required Mac evidence, then one --executor droplet verify at this exact head, reporting in the item topic. Source clearance is not final suite clearance.

Criteria: C1 verified.

### impl-506 · 2026-10-15T16:28:31.908Z

A-3161 records five fresh serial whole-file Mac attempts after restart, changed case green 5/5. Attempts 1/3/4/5 whole file green; attempt 2 only T-508 run-digest ENOTEMPTY/hung teardown. Coordinator decision cea92d23 explicitly counts these case-level attempts for C2. Labels/load/admission checks and all logs included. Submitted droplet verify 35762d52-1939-4342-a68b-00f2db49ded6 at source-reviewed edc3cda4, to rev-30 and impl-506. Linux criterion still pending result.

### rev-30 · 2026-10-15T16:28:56.293Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-506-mac-evidence
commit: edc3cda4d526922a3d6d870501d174bcbd39d223
scope: evidence

Mac evidence pass clear for T-506 at unchanged source-reviewed edc3cda4d526922a3d6d870501d174bcbd39d223 under explicit Coordinator case-level exception cea92d23-c837-4136-af00-5adb31728279. No new source findings; prior source/delta verdict and current C1 verification stand. C2 remains unverified pending Linux task receipt and final gate.

A-3161 contains five fresh serial whole-file attempts, with the changed watched-transition case green 5/5 (1.031,1.070,1.180,0.977,1.013 s). First attempt is quiet at source-equivalent 704b85f3; subsequent head differs only by already reviewed shared duration allowance. Attempts 2–5 are labelled loaded beside impl-485 local verification, all admission loads below 15. These are not five green whole files: attempts 1/3/4/5 pass 9/9; attempt 2 reports 8 pass/1 fail/1 cancelled after authorized SIGTERM of the hung targeted runner. Its actual failure is ENOTEMPTY scratch-directory teardown in the unrelated run-digest case, exact known T-508; the changed test still passes.

Coordinator cea92d23 explicitly counts attempts when the whole file ran and the changed case passed, excluding a red solely on T-508 from T-506's case-level Mac requirement. This acceptance is specific to that decision and preserves the failed/cancelled receipt. No blanket whole-file green claim or criterion final verification.

Task.view shows droplet 35762d52-1939-4342-a68b-00f2db49ded6 already queued at the unchanged reviewed head. Existing source clearance stands; no additional run needed beside that submission. Wait for its receipt. No Reviewer tests or edits.
