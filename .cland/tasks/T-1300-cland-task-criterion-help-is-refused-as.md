---
id: T-1300
kind: task
title: cland task criterion --help is refused as an unknown option instead of printing its usage
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1283
blocked_by: []
topic: topic-1050
branch: t/T-1300-cland-task-criterion-help-is-refused-as
created: 2026-10-25T11:31:06.724Z
updated: 2026-10-25T11:59:08.780Z
---

## Summary

`cland task criterion --help` exits 2 with "Unknown option '--help'" and prints the whole task usage, while docs/agents/issue-tracker.md says every command and group answers an immediate `--help`. Found aside by impl-1041 during T-1041 (2026-10-25), read-only.

## Acceptance criteria

- [x] C1. `cland task criterion --help` (and every `task` subcommand) prints that subcommand's usage and exits 0, matching the documented contract; a test covers each `task` subcommand.
  - done: impl-1300 · 2026-10-25T11:58:50.381Z

## Comments

### impl-1300 · 2026-10-25T11:56:34.625Z

Clean inherited tree. Proposed/brief-authorized seams: existing T1 commandHelp pure entry table covers every advertised task subcommand and both immediate flags; T2 sealed executable regression for task criterion proves exit 0/stdout/empty stderr without a hub or writes. CLI help-only repair, no shared reply/schema/admission contract changes. A-11669 predates this found-aside item; current defect is help.ts commandHelp's one-argument restriction, followed by task.ts strict parser.
