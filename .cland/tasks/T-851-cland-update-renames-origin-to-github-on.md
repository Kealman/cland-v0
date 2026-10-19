---
id: T-851
kind: task
title: cland update renames origin to github on a v0.1.3 project initialised under a symlinked path (macOS /tmp)
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-19T07:35:48.835Z
updated: 2026-10-19T07:35:48.835Z
---

## Summary

A project initialised by v0.1.3 as `cland init /tmp/x` on macOS gets its `origin` remote renamed to `github`, and a new `origin` added, when the current `cland update` runs. v0.1.3 stored the unresolved path (`/tmp/x`); the current code resolves it to `/private/tmp/x`, sees a different territory and treats the existing origin as a foreign remote.

## Evidence

Found aside while rehearsing the E-615 QA brief on 2026-10-19 at dev 87b626ed (Coordinator sub-agent). It reproduced on the first rehearsal and disappears when the project path is already resolved. The E-615 brief avoids it with resolved paths and checks `origin renamed: 0`.

## Acceptance criteria

- [ ] C1. `cland update` on a project whose recorded territory or origin path differs from the current one only by symlink resolution recognises it as the same territory: no remote is renamed or added. A regression test sets up a v0.1.3-style project under a symlinked parent.
