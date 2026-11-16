---
id: T-1848
kind: task
title: The suite command's process observer drops inspection failures without a receipt
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-14T02:03:07.406Z
updated: 2026-11-16T07:31:12.142Z
---

## Summary

The suite command's periodic process observation drops every inspection failure without a trace. `hub/src/suite-command.ts:45` runs `capture().catch(() => { /* failed inspection establishes no new ownership */ })` and retries after 1 s while the command stays open. A probe that keeps failing leaves the command's descendants unobserved until stall teardown or the census, and nothing records that observation was failing. Found aside by T-1846 while diagnosing the suite-timeouts fast-exit hang (A-19248). That diagnosis remains inferred, because the fixture contents were disposed.

## What to build

A failed process inspection in the suite command's observer leaves one bounded, deduplicated diagnostic receipt in the run log, naming the failure and how many consecutive attempts failed, and the run's result says when ancestry went unobserved for longer than a named bound. Ownership semantics stay as today: a failed inspection still establishes no new ownership and retains earlier proofs.

## Acceptance criteria

- [ ] C1. A fake inspector that fails N times then succeeds produces one deduplicated failure receipt with the count, and observation resumes on success without new ownership from failed rounds (test).
- [ ] C2. A run whose inspection never succeeds reports, in its result, that descendants went unobserved past the named bound (test).
