---
id: T-1622
kind: task
title: ps is a declared dependency of the hub
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:34:17.939Z
updated: 2026-11-02T03:34:47.072Z
---

## Summary

The hub lock relies on `ps -o lstart=` for pid-reuse detection, and slim Linux images lack it. `cland doctor` reports a missing `ps` as a failure that names `procps`, and the install docs list it as a Linux requirement.

Hot files: `hub/src/doctor/toolchain.ts`, `site/src/content/docs/docs/install.md`

## Acceptance criteria

- [ ] C1. `cland doctor` fails a `ps` row, with a fix naming `procps`, when `ps -o lstart=` cannot report its own process's start time (test).
- [ ] C2. The install docs list `procps` among the Linux requirements, as the lock's dependency.

## Notes

Shared files: see Hot files
