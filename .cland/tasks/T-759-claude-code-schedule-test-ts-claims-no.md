---
id: T-759
kind: task
title: "processStartedAsync's ps probe (doctor/report.ts → hub/lock.ts) is reachable from T2 tests: claude-code-schedule and tracker-levels"
state: open
status: review
size: S
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-481
branch: t/T-759-claude-code-schedule-test-ts-claims-no
created: 2026-10-17T22:05:24.636Z
updated: 2026-10-18T06:32:34.591Z
---

## Summary

Found by impl-750 on 2026-10-17 at 22:04Z, under T-750's enforced tripwire. claude-code-schedule.test.ts mocks child_process.execFile and claims to start no native processes. However, its known-PID adapter resume calls processStartedAsync → doctor.run → spawn(ps), so an enforce pass trips and stalls. Raw runs pass 5/5, with a median of 1.33 s.

## What to build

Inject the process-start fact into the adapter resume path that this test exercises, as T-750 and T-751 do for their files. Production keeps the native reader. Keep every assertion.

## Acceptance criteria

- [ ] C1. claude-code-schedule.test.ts and tracker-levels.test.ts each pass 5/5 under the enforced runtime tripwire with no child_process trip, and a droplet run's trip report lists neither, with their assertions unchanged.

## Comments

### coord · 2026-10-18T05:43:27.786Z

Second case (coord, 2026-10-18 05:43Z): T-772's droplet run f3c91a4b (A-4997) shows the same report-only T2 child_process.spawn trip in tracker-levels.test.ts, "reserved or malformed configured levels produce a notice and keep the default ladder", through doctor/report.ts → hub/lock.ts processStartedAsync. The Mac run with the tripwire enforced was clean, so the trip is environment-dependent. Fix the root: inject the process-start fact at the lock and doctor seam for fixtures, the way T-751 did for the droplet and spend locks, so no T2 test reaches it. C1 covers both files.

### impl-759 · 2026-10-18T06:29:48.046Z

Implemented a ClaudeCodeAdapter processStarted reader (native by default) for launch/resume identities. projectHub fake probes now include empty compatibility-slot observations, preventing malformed config from restoring shared machine ps probes. All existing assertions retained. Pre-fix enforced Claude receipt reproduced child_process.spawn and timeout; typecheck, test:tiers and test:lint pass; serial 5/5 acceptance repetitions in progress.

### impl-759 · 2026-10-18T06:30:43.898Z

Source ready at 6bb5eff2, pushed to origin; review requested from reviewer in topic-481. A-5022 records both acceptance files 5/5 serially with enforced T2 tripwire, zero trips, load 5.81–6.80. A-5023 holds implementation/assertion audit. Typecheck, test:tiers and test:lint pass. C1 remains pending exact-reviewed-head droplet trip report.

### rev-31 · 2026-10-18T06:32:34.591Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-759-source
commit: 6bb5eff2248d6bcaed0921cf7789c125b4c9e8b6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-759 source review — clear

Commit:6bb5eff2248d6bcaed0921cf7789c125b4c9e8b6.
Fixed point:222e880b5f9fb5873a20f0a6488dac30cc3bdc45 (pre-implementation integration).
Scope:full; read-only review, no Reviewer execution or edits.

## Standards

No findings. ClaudeCodeOptions adds one optional asynchronous processStarted fact. Both launch PID capture and resume identity validation use it; the default calls the same native reader with the same pid, continuation and environment as before. Existing pidAlive/identity comparison logic is unchanged. No production fallback, timeout, scheduling or permission behavior changes.

projectHub's fake-probe preset now supplies empty compatibility holder/occupied observations. This prevents invalid configuration from restoring global native machine-owner probes inside component fixtures. Explicit options retain precedence through the existing spread order; probes:native/nativeProjectHub and serveProject production defaults remain native. The fixture change does not relax the tier tripwire.

The schedule fixture replaces its ineffective execFile(ps) branch with the injected fixture-start fact. All its assertion lines are identical before/after; tracker-levels is byte-identical. No test title, skip, assertion, tier, allowance or budget is changed.

## Spec and evidence

C1 source portion established. The two reported native call paths are addressed: launch/resume use the process-start fact, and malformed tracker configuration cannot make fake-probe projectHub consult unrelated global native compatibility holders. This corresponds to the shared doctor/report.ts → lock.ts spawn seen in A-4993/A-4997; production native readers remain intact.

Independently read A-5022's ten raw whole-file summaries: schedule3 cases×5 and tracker-levels15 cases×5,90 passes total, zero failures/skips/cancellations/todo. Every annotated invocation records enforced T2 tripwire and exit0; no tier-mismatch or late asynchronous diagnostic appears. Admission load5.81–6.80. Schedule wall0.613–1.446s, tracker5.778–6.219s. A-5023 discloses the prior enforced schedule red/timeout, the tracker issue's environment-dependent Linux occurrence, and typecheck/tiers/report-only lint validation.

C1 final verification remains pending the exact-reviewed-head droplet report: both owned files must execute positively and neither may appear in its resource-trip report. Preserve this head and submit the ordinary mode-free diff-selected droplet verification after source clearance; no full task run or extra QA requested.

## Verdict

Source clear. No criterion is marked fully verified yet because the sole criterion includes Linux execution. Source assertion equivalence and Mac5/5 portion are established above.
Standards:0 findings. Spec:0 source gaps; C1 runtime pending.

Durable review:A-5026.
