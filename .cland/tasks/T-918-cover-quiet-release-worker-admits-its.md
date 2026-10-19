---
id: T-918
kind: task
title: "cover-quiet 'release worker admits its cover lease…' fails on macOS: the nested scratch hub socket path exceeds 104 bytes (EINVAL)"
state: open
status: in progress
size: S
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-916
found_by: cover
topic: topic-667
branch: t/T-918-cover-quiet-release-worker-admits-its
created: 2026-10-19T23:27:26.190Z
updated: 2026-10-19T23:27:46.759Z
---

## Summary

T-916's new test `hub/test/cover-quiet.test.ts::release worker admits its cover lease before isolated scratch startup` fails 1/1, and 0/5 in the load gate, in stage cover #2's macOS run fb05a8ef at 15f9c308 (A-6795, around line 76849). The nested release.test.ts child fails with `cland: connect EINVAL /private/tmp/cland-suite-effa9041-…/cland-proj-En2kQK/cland-55d4605ca6e3d3ae.sock`. On macOS the nested suite temp root plus the scratch project makes the Unix socket path longer than the 104-byte sun_path limit. Linux allows 108 and passed.

## What to build

Keep the hub socket path of nested fixtures under the macOS limit. Either shorten the temp roots the test and helper create (for example a short `mkdtemp` under `/tmp`), or have socket placement fall back to a short directory when the project path is too long, whichever the code already supports. Check every fixture that nests a project inside a suite temp dir.

## Acceptance criteria

- [ ] C1. The cause is confirmed, with the computed socket path length on macOS.
- [ ] C2. The test passes on macOS when run inside a nested suite temp root as long as the integrated run's, either reproduced by setting TMPDIR to an equally long path or by a T2 check of the computed socket path, with the receipt in the report.
- [ ] C3. A mode-free verify at the reviewed head is green.
