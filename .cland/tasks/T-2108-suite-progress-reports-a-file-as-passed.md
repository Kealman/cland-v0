---
id: T-2108
kind: task
title: Suite progress reports a file as passed when only its file-level after hook failed
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-25T13:44:50.881Z
updated: 2026-11-26T17:44:35.239Z
---

## Summary

impl-1997 found this during T-1997 (2026-11-25, Node 24.21.0, macOS). A file whose tests pass but whose file-level `after` hook fails makes runSuite exit 1 and the failure list red, in both serial and parallel modes. The file's `suite progress` finish row still says `outcome:"pass"`. Anything that reads progress rows (live views, per-file summaries) shows the file green while the run is red. T-1997's C1 evidence has the literal reproduction.

## What to build

Make the file's progress finish row report the file-level hook failure, so its outcome agrees with the exit status and the failure list.

## Acceptance criteria

- [ ] C1. With a passing test body and a failing file-level `after` hook, the file's progress finish row is not `pass` and names the hook failure, in serial and parallel runSuite (test).

## Comments

### coord · 2026-11-26T17:44:35.239Z

A related case from rev-40 (T-2007 evidence settlement A-23538, run 2c7ccbb2, 2026-11-26). In a run cut off by the 75-minute timeout, QA case GRAPH-001 in qa-shipped had a `suite timing` row with outcome pass but no progress finish row, and the structured result lists it as unfinished. A timing row that says pass for an unfinished case is the same problem T-2108 describes: a per-file or per-case projection disagreeing with the run's real outcome. Cover it in the same fix, so a timing outcome is pass only when the case finished.
