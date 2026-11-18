---
id: T-1970
kind: task
title: Droplet acquisition and preparation let a release or checkpoint rejection replace a non-readiness primary error
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
created: 2026-11-18T12:06:58.160Z
updated: 2026-11-18T12:06:58.160Z
---

## Summary

Found by impl-1643 while fixing T-1643 (2026-11-18), pre-existing. T-1643 makes the new typed readiness-deadline error survive prepareSnapshot wrapping and builder release or checkpoint rejection, with cleanup failures attached as secondary diagnostics. Other primary errors in the same acquisition and preparation paths still follow the older policy, where a later release or checkpoint rejection can replace the original error. That breaks rule 39: once an outcome is selected, a later ancillary failure only adds a secondary diagnostic.

## What to build

Apply T-1643's preservation to every primary error in droplet acquisition and preparation: keep the first error as the outcome, preserve wrapper causes, attach release and checkpoint failures as secondary diagnostics, and retain cleanup ownership when release fails.

## Acceptance criteria

- [ ] C1. For a non-readiness primary error (for example a provider create failure) followed by a rejected release or checkpoint, the reported outcome is the original error, with the cleanup failure attached secondarily and its retained records listed (test with fakes).
- [ ] C2. Every catch-and-release site in acquisition and preparation is listed with its disposition (rule 41).
