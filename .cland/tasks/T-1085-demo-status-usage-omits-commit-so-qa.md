---
id: T-1085
kind: task
title: demo status usage omits --commit, so qa lint rejects the documented freshness command
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-21T22:38:59.689Z
updated: 2026-10-21T22:38:59.689Z
---

## Summary

`cland demo status --commit <sha>` works (hub/src/cli/demo.ts accepts it), and the qa skill tells QA to use it, but the `demo status` row in hub/src/cli/usage.ts omits `--commit`. So `cland qa lint` rejects a brief that writes the documented command. Found while drafting the E-1006 epic brief (2026-10-21), which had to work around it.

## Acceptance criteria

- [ ] C1. The `demo status` usage row lists `--commit <sha>`, and `cland qa lint` accepts a brief line `cland demo status E-1 --commit <sha> --json` (test).
