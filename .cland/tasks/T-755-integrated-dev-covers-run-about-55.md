---
id: T-755
kind: task
title: Integrated dev covers run about 55% slower than task full runs of the same code
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T20:04:48.908Z
updated: 2026-10-17T20:04:48.908Z
---

## Summary

Two integrated covers at dev 1c766f2f/b5400af ran 2741 s and 2750 s (A-4709, A-4720), against 1759 s for cover a190eaf9 an hour earlier (A-4695). Per-file times rose 1.5–3×: inbox-workload "archive startup…" took 25 s, then 67 s and 73 s. Both went red on wall-bound remote-fixture waits (T-746). T-748's full task run 718eb39d of nearly the same tree (dev plus T-748's tripwire) ran 1669 s and green at the same time on another droplet. So this isn't the code alone, and it isn't region-wide noise. Peak 1-minute load stayed under 8.

## What to build

Find what makes an integrated cover slower than a task run of the same tree. Candidates: coverage capture (NODE_V8_COVERAGE) when the coverage map is refreshed, the integrated-cover worker or environment setup, the occasion or full-mode differences, or droplet CPU steal. Compare the two slow logs with a190eaf9 and 718eb39d phase by phase. Fix the cause, or make covers run like task runs.

## Acceptance criteria

- [ ] C1. The cause is named with evidence, and an integrated cover after the fix runs within 15% of a same-tree task full run.
