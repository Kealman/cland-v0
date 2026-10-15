---
id: T-449
kind: task
title: session-stop-races Codex forced-stop test reads probe.json before it is written (ENOENT under load)
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T01:25:43.927Z
updated: 2026-10-15T01:25:43.927Z
---

## Summary

`hub/test/session-stop-races.test.ts:147` ('Codex: manual forced stop succeeds when a captured descendant exits before its final identity probe') failed in integrated cover 4b6c160f at a3c8098a (A-2633), with ENOENT on the test project's probe.json, at peak load 17.7. Alone it passed 5/5 at the same head (2026-10-15 01:35Z). The test reads the probe file before the fake has written it. Wait for the file, or for the probe event, before reading.

## Acceptance criteria

- [ ] C1. The read waits on the probe being written, and the file passes 5/5 beside a local full run.
