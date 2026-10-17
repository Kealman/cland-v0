---
id: T-755
kind: task
title: Integrated dev covers run about 55% slower than task full runs of the same code
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: topic-458
branch: t/T-755-integrated-dev-covers-run-about-55
created: 2026-10-17T20:04:48.908Z
updated: 2026-10-17T20:08:44.751Z
---

## Summary

Two integrated covers at dev 1c766f2f/b5400af ran 2741 s and 2750 s (A-4709, A-4720), against 1759 s for cover a190eaf9 an hour earlier (A-4695). Per-file times rose 1.5–3×: inbox-workload "archive startup…" took 25 s, then 67 s and 73 s. Both went red on wall-bound remote-fixture waits (T-746). T-748's full task run 718eb39d of nearly the same tree (dev plus T-748's tripwire) ran 1669 s and green at the same time on another droplet. So this isn't the code alone, and it isn't region-wide noise. Peak 1-minute load stayed under 8.

## What to build

Find what makes an integrated cover slower than a task run of the same tree. Candidates: coverage capture (NODE_V8_COVERAGE) when the coverage map is refreshed, the integrated-cover worker or environment setup, the occasion or full-mode differences, or droplet CPU steal. Compare the two slow logs with a190eaf9 and 718eb39d phase by phase. Fix the cause, or make covers run like task runs.

## Acceptance criteria

- [ ] C1. The cause is named with evidence, and an integrated cover after the fix runs within 15% of a same-tree task full run.
- [ ] C2. C2. Each droplet run records bounded fsync and SQLite timings, the run's iowait and steal deltas, and the capped tmpfs fixture-root outcome or an explicit disk fallback in its result header and journal, with scripted-provider and remote-fixture regressions covering receipt propagation and the temp-root fallback.

## Comments

### impl-755 · 2026-10-17T20:07:56.716Z

Investigation evidence in A-4721 (topic-458): all four runs compared phase by phase and 320 file rows. Slowdown localizes to disk-backed persistence: unchanged store migration 10–13x slower, in-memory siblings ~1.3x. Identical cover launch script/policy, same slow-cover candidate tree, fast cover also captures coverage; local capture differential does not recreate disk signature. Exact device/sync mechanism is unmeasured; requested Coordinator decision before a nontrivial executor probe/tmpfs change. C1 not done: fresh same-tree post-fix comparison still needed.
