---
id: T-2002
kind: task
title: Coverage-download failures keep only the latest error; earlier attempts leave no durable diagnostic
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-19T10:01:10.786Z
updated: 2026-11-24T09:00:12.882Z
---

## Summary

Coverage downloads (`Machine.get` from `collectCoverage` in Suites) keep only the latest failure in `job.error`, which later attempts overwrite or clear. Earlier failed attempts leave no durable diagnostic. T-1729 (2026-11-19) made delivery uploads keep durable per-attempt diagnostics but scoped downloads out.

## What to build

Persist each failed coverage-download attempt's bounded stderr tail and exit or signal in the run's durable diagnostic, as T-1729 does for uploads. A later success or retry must not erase an earlier failure (rule 40).

## Acceptance criteria

- [ ] C1. Two failed coverage-download attempts followed by a success leave both failures in the run's durable diagnostic with their transport facts (test with a fake Machine.get).
