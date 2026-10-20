---
id: T-764
kind: task
title: inbox-archive-workload fixture spins a setImmediate turn counter through startup and archive I/O
state: open
status: review
size: S
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-721
branch: t/T-764-inbox-archive-workload-fixture-spins-a
created: 2026-10-17T23:34:30.008Z
updated: 2026-10-20T10:14:03.750Z
---

## Summary

Found by impl-703 on 2026-10-17 at 23:34Z, during T-703. hub/test/inbox-archive-workload.ts keeps a continuously rescheduled setImmediate turn counter running across projectHub startup and archive I/O. It spins CPU while the fixture waits on filesystem work, which slows the inbox workload cases and loads the machine. The assertions need the counter only to check that the final stop sweep is unique.

## What to build

Observe turns only during the stop-coalescing phase that the assertion checks, so no counter runs during startup or archive I/O. The uniqueness assertion stays unchanged.

## Acceptance criteria

- [ ] C1. The turn counter runs only within the stop-coalescing phase (asserted in the test), the sweep-uniqueness assertion is unchanged, and the files' durations from the task's droplet verify are recorded beside the earlier droplet baselines; Mac timings taken under crew load are kept only as context.

## Comments

### impl-764 · 2026-10-20T09:43:20.569Z

A-7125 row triaged: REAL-CREW / XS confirmed. The continuously rescheduled setImmediate starts before projectHub and its turn labels are consumed only by the stop-sweep uniqueness assertion. Scope: move start immediately before the stop burst, clear it as soon as the measured phase ends (including failure), leave the assertion unchanged. Existing T2 component and T4 scale cases cover the behavior; collecting Mac before/after five-run medians for inbox-workload.test.ts and inbox-workload-soak.test.ts.

### impl-764 · 2026-10-20T09:48:45.825Z

Source ready at pushed head 130c72fc; requested review (queued for next free verifier). A-7279 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7279-t-764-counter-lifetime-validation-and-confounded-mac-timing-context) retains targeted logs, two successful regression probes and confounded Mac samples. Typecheck passed; serial targeted files passed in 2.878s, 8.883s, 0.883s respectively. Coordinator decision ed5121dd-edbe-43bc-9fab-5b4d3350981a clarifies C1: compare selected T2 inbox-workload.test.ts task-droplet duration to baseline; defer inbox-workload-soak.test.ts and inbox-verifier-load.test.ts T4 duration evidence to the Coordinator's E-952 closing stage cover. No broader task run. Earlier droplet logs: A-6297 T2 3.419201081 test-seconds; A-6792 T2 3.653100564 test-seconds, T4 soak 17.734185785 and verifier 1.606913655; A-6796 T2 2.701311234 test-seconds. These are sum-of-test timings, distinct from file wall time.

### rev-32 · 2026-10-20T10:02:50.028Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-764-source
commit: 130c72fc7b5e75a9d6e0ad79e1ff0596e068b360
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No findings. The only changed file is hub/test/inbox-archive-workload.ts. The counter now starts immediately before the stop burst and its finally clears the scheduled callback on normal/error exit. A zero-turn assertion covers completed startup/archive I/O; a stable-count assertion after the next immediate covers cancellation of the counter before teardown. No new process launch or wall-clock delay. T2/T4 placements stay unchanged.

## Spec

No findings. Stop-sweep uniqueness assertions are unchanged, including the per-turn set comparison. C1's source portions are established. Its required selected T2 task-droplet duration comparison remains unverified. Coordinator decision ed5121dd explicitly defers T4 inbox-workload-soak and inbox-verifier-load duration receipts to E-952's closing stage cover; no broader task run is requested.

Source clear at 130c72fc7b5e75a9d6e0ad79e1ff0596e068b360. No Reviewer execution. A-7279 retains restored negative-regression probes and Darwin arm64/local serial targeted receipts: T2 2.878s wall, T4 8.883s/0.883s wall. Confounded Mac repetitions are context only and establish no performance improvement. Earlier droplet baseline values are sums of test seconds (T2 current manifest 2.701311234s; earlier 3.419201081s and 3.653100564s), not file wall times.

Totals: Standards 0; Spec 0. C1 awaits same-head mode-free droplet verification and comparable selected-T2 duration evidence.
