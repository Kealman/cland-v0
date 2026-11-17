---
id: T-1808
kind: task
title: A shared evidence-publish helper that calls artifact.create only after a clean secret scan with a positive control
state: open
status: planned
size: M
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: null
branch: null
created: 2026-11-11T00:11:39.952Z
updated: 2026-11-17T23:14:18.688Z
---

## Summary

Three times on 2026-11-10, an implementer's ad-hoc export script published evidence after its secret scan had exited 1: A-18360 (impl-1778), A-18454 (impl-1780) and A-18526 (impl-1788). Each was archived, and each match turned out to be a false positive (a test title, a test path, a tracked filename). But a gate that depends on each session's own orchestration fails repeatedly. A shared helper should own the scan and the publication together, so a non-zero scan, a missing exit code or a missing positive control can never reach `artifact.create`.

## Context

- Rule-batch proposal P-coord-publishgate.
- Rule 15 requires that nothing is published until a secret scan finds no matches.
- False positives are redacted in the export (an id plus a hash). The scanner itself changes only through its own reviewed item.

## Acceptance criteria

- [ ] C1. One shared helper (CLI or library) scans every file of an evidence folder or file with the repo's scanner and a planted positive control, and publishes only when the scan exits 0 with the positive control matched (test).
- [ ] C2. A non-zero exit, a missing exit code, a missing or unmatched positive control, or a scan of the wrong path refuses publication and prints the file and position of each match without the matched value (test).
- [ ] C3. The implement skill and the QA kit point to the helper for evidence publication (test: docs reference check).
