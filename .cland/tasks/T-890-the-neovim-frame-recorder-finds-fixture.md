---
id: T-890
kind: task
title: The Neovim frame recorder finds fixture consumers by a filename substring
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - needs-triage
assignee: impl-882
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-19T18:39:30.696Z
updated: 2026-10-19T18:39:35.265Z
---

## Summary

record-nvim-frames.ts finds non-T2 fixture consumers by searching each test file for the literal string 'stub-hub.ts'. A T4 consumer that imports its stub client through a helper is silently left out after a harmless header change. impl-882 found this on 2026-10-19 while working on T-888. T-888 works around it by naming stub-hub.ts in its T4 header.

## Acceptance criteria

- [ ] C1. The recorder discovers fixture consumers from explicit declarations or from the transitive import graph, not from a filename substring. A T1 test shows that a consumer reaching stub-hub.ts only through a helper is refreshed, and that a file which merely mentions the name in a comment is not.
