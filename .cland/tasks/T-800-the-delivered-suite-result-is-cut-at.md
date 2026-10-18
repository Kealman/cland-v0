---
id: T-800
kind: task
title: The delivered suite result is cut at about 8 KiB by per-file test-lint tier lines, so the per-tier and tier-share lines never reach the reader
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
regression_of: T-684
topic: null
branch: null
created: 2026-10-18T12:11:23.483Z
updated: 2026-10-18T12:11:23.483Z
---

## Summary

Found by qa-676 in E-676's demo (run qa-2026-10-18-1, criterion C2). Task run 01a2956c's log A-5256 has every report line. The suite result message delivered to the requester stops at about 8 KiB, in the middle of `test lint tie…`. It carries zero `tier T1…T4` lines and zero `tier share` lines, because a few hundred per-file `test lint tier: <file>: Tn; qualifies Tm` lines and the per-finding lint lines come first. Every suite result delivered today is cut the same way.

## Acceptance criteria

- [ ] C1. A delivered suite result puts the run summary, the per-tier lines, the tier-share line, the test-lint summary and the budget would-fail lines before any per-file or per-finding detail, and stays within the delivery limit. A T2 report test with a repository-sized manifest and findings proves it, and fails before the fix.
- [ ] C2. Per-file `test lint tier` lines and individual lint findings appear only in the log artifact, with one summary line in the message (counts plus the artifact id). Findings that refuse a run are still named in full.
- [ ] C3. A dry-run and an integrated run at the fixed head show the same ordering.
