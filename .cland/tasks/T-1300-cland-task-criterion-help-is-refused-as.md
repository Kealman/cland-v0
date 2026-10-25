---
id: T-1300
kind: task
title: cland task criterion --help is refused as an unknown option instead of printing its usage
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
topic: null
branch: null
created: 2026-10-25T11:31:06.724Z
updated: 2026-10-25T11:31:13.196Z
---

## Summary

`cland task criterion --help` exits 2 with "Unknown option '--help'" and prints the whole task usage, while docs/agents/issue-tracker.md says every command and group answers an immediate `--help`. Found aside by impl-1041 during T-1041 (2026-10-25), read-only.

## Acceptance criteria

- C1. `cland task criterion --help` (and every `task` subcommand) prints that subcommand's usage and exits 0, matching the documented contract; a test covers each `task` subcommand.
