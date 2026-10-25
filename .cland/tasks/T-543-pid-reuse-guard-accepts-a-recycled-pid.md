---
id: T-543
kind: task
title: PID-reuse guard accepts a recycled PID that started within the same ps second
state: open
status: planned
size: M
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: E-1284
blocked_by: []
topic: null
branch: null
created: 2026-10-15T22:29:59.157Z
updated: 2026-10-25T09:53:57.611Z
---

## Summary
Found aside by impl-525 on T-525 (2026-10-15 22:29Z). `hub/src/hub/lock.ts:37-40` reads `ps -o lstart`, which has whole-second resolution, and `sameProcess` in `hub/src/adapters/processes.ts:27-32` accepts equal start stamps. If a managed PID exits and the OS recycles it to an unrelated process within the same second, the stop and cleanup guard accepts the replacement as the managed process and can SIGTERM or SIGKILL it. That's unlikely under ordinary PID allocation, more likely under heavy PID churn such as a loaded test suite. The consequence is termination of an unrelated process.

## Acceptance criteria
- [ ] C1. The identity check uses a start identity finer than one second where the platform offers one (for example `/proc/<pid>/stat` starttime on Linux, `proc_pidinfo` or `sysctl` kinfo on macOS), or adds a second discriminator (command, ppid or a nonce) so that two processes started in the same second never compare equal.
- [ ] C2. A test stages a same-second reused PID with a different identity and shows stop and cleanup refuse to signal it, while the real managed process is still signalled.
