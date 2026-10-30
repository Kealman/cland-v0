---
id: T-1460
kind: task
title: Every suite log ends with one provenance footer
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:57.980Z
updated: 2026-10-30T05:44:57.980Z
---

## Summary

Every suite log, local and droplet, ends with one provenance footer: head, verification tree, executor and platform, occasion, browser binary and version; a platform skip without a reason fails the run. The macOS cover log A-14135 omitted the occasion and the browser version (qa-677, E-1444 audit). Sources: qa-677, T-1318. Rule batch 4 C8 (A-14151).

## Acceptance criteria

- [ ] C1. Local and droplet logs carry the same footer fields, checked by one test on each executor.
