---
id: T-1677
kind: task
title: hub-lifecycle test expects a literal hub.sock path and fails when TMPDIR is longer
state: open
status: planned
size: XS
labels:
  - qa-found
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-04T14:47:20.577Z
updated: 2026-11-16T07:31:09.218Z
---

## Summary

During E-1532 stage-4 QA (qa-678, A-16582), running `hub/test/hub-lifecycle.test.ts` with a TMPDIR 9 bytes longer than the original 61-byte one failed an assertion that expects a literal `hub.sock`. The hub legitimately used its fallback socket path because the full path exceeded the Unix socket limit. It reproduces on the stage-3 and stage-4 heads alike, and passes at the original length.

## What to build

The test reads the actual socket path the hub publishes (discovery file or status) instead of assuming `hub.sock`, and covers the fallback-path case explicitly.

## Acceptance criteria

- [ ] C1. hub-lifecycle passes with a TMPDIR long enough to force the fallback socket path (test).
- [ ] C2. A case asserts the hub publishes and uses the fallback path when the primary would exceed the limit (test).
