---
id: T-1541
kind: task
title: Failed coverage-recording suite runs leak their raw V8 coverage directories (130 GB filled the disk)
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-31T23:04:19.659Z
updated: 2026-10-31T23:04:19.659Z
---

## Summary

`hub/test/run-suite.ts` removes a run's raw V8 coverage directory (`<output>.raw`, set as `NODE_V8_COVERAGE`) only after a successful reduction. A failed, red or interrupted coverage-recording run returns early and leaves the directory behind. Over three weeks 59 such directories under `.cland/run/suites/<id>/coverage-map.json.raw` (2–5.7 GB each, 130 GB in all, oldest 2026-10-16) filled the Mac's disk.

Found 2026-10-31 23:00Z: the macOS release cover 69067e3d for R-1523 (A-15095) went red in T3 with `tee: … No space left on device` (642 MB free). Its 39 test failures in suite-selection and suite-runner were the disk, not the code; the Linux cover 342615fa at the same head was green. The Coordinator removed the 59 leaked directories by literal path (no suite running, none open), which freed 130 GB, and resubmitted the macOS cover as 7bb74c39.

## Acceptance criteria

- [ ] C1. A coverage-recording run that fails, goes red or is interrupted removes its raw coverage directory before it exits, proven by a test that drives each of the three exits and checks the directory is gone.
- [ ] C2. A sweep removes raw coverage directories left by earlier runs whose suite is no longer active, at hub start or at the next suite admission, and never touches an active run's directory; a test plants both.
- [ ] C3. The suite log names the bytes removed when a sweep removes a leftover raw coverage directory.
