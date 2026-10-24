---
id: T-1188
kind: task
title: cland release --help exits 1 with Unknown option
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: null
branch: null
created: 2026-10-23T21:49:35.727Z
updated: 2026-10-24T06:46:55.507Z
---

## Summary

`cland release --help` exits 1 with `cland: Unknown option '--help'`, because `runRelease`'s parseArgs has no help option. `cland --help` works and documents release. impl-1185 found it at 9a587b59 on 2026-10-23.

## What to build

Give `cland release` a `--help` that prints its usage and exits 0, as the other subcommands do.

## Acceptance criteria

- [ ] C1. `cland release --help` prints the release usage and exits 0 (test).
