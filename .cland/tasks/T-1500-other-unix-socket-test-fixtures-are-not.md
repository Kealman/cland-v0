---
id: T-1500
kind: task
title: Other Unix-socket test fixtures are not safe under a deep TMPDIR on macOS
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
created: 2026-10-31T04:21:28.348Z
updated: 2026-10-31T04:21:28.348Z
---

## Summary

T-1499 fixed the admission exchange socket, which exceeded macOS's 104-byte `sun_path` limit under the suite temp root. Its rule 20 audit, recorded on T-1499, found the remaining direct Unix-socket fixture paths in hub/test, nvim/test and web/test. They fit today's suite root but are not safe under a deeper TMPDIR. A longer suite root or project path would break them on macOS the same way. Follow-up of T-1499 (0.3.1).

## Acceptance criteria

- [ ] C1. Every Unix-socket listener created by test fixtures allocates its path through one shared helper that budgets UTF-8 bytes including the NUL under 104, independent of TMPDIR depth, and a control proves a deep TMPDIR (≥ 90 bytes) still binds.
