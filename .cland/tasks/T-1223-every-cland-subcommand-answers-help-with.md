---
id: T-1223
kind: task
title: Every cland subcommand answers --help with its usage and exit 0
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: null
branch: null
created: 2026-10-24T09:45:41.634Z
updated: 2026-10-24T09:45:53.516Z
---

## Summary

Found by impl-783 in the T-783 docs pass (2026-10-24 09:41Z, topic-953). The docs promise `cland <command> --help` for every command, but in a scratch project `cland hub --help` exits 2 with `unknown hub command "--help"`, `cland task --help` exits 2, and `cland session --help` exits 1 with `no hub runs for this project`. T-1188 fixed `release`, `sync`, `publish`, `push` and `merge`; the rest still lack it. A newcomer's first move after install is `--help`.

## Acceptance criteria

- [ ] C1. Every top-level command and every command group (`hub`, `task`, `session`, `verify`, `topic`, `executor`, `web`, `role`, and the rest `cland --help` lists) answers `--help` and `-h` with its usage and exit 0, without a running hub and without touching the project, shown by one table-driven CLI test over the commands `cland --help` lists.
- [ ] C2. A command or group added later without help fails that test.
