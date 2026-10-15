---
id: T-498
kind: task
title: "doctor-isolation test: rm of the other fixture hits ENOTEMPTY while its hub is still live (Linux, under load)"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T14:03:16.446Z
updated: 2026-10-15T14:03:16.446Z
---

## Problem

`hub/test/doctor-isolation.test.ts:16`, 'doctor --fix under one fixture root preserves another deleted-project hub', failed on Linux in T-458's droplet verify 903d684f (A-3044). The test's `rm(other, {recursive: true})` hit ENOTEMPTY while the other fixture's hub was still live and writing to its `.cland/run`. T-458 doesn't touch the file, and the file passes alone in about 2 s on the Mac.

## Acceptance criteria

- [ ] C1. The test stops the other fixture's hub and observes it gone before removing its directory. Alternatively, the removal tolerates and retries the live-writer race within a bounded wait. Every assertion stays, and the root cause is recorded in the commit.
- [ ] C2. doctor-isolation.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
