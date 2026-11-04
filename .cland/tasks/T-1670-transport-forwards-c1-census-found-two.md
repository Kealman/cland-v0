---
id: T-1670
kind: task
title: transport-forwards C1 census found two unexplained 127.0.0.1 TCP listeners once on a Linux droplet and names no owner
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-04T02:14:08.309Z
updated: 2026-11-04T02:14:08.309Z
---

## Summary

In batch 3fb8c70b (T-1604 alone, tree ce24cf47, log A-16451, Linux c-8 lon1), `hub/test/transport-forwards.test.ts` "C1 Unix and host-loopback forwards answer with no hub TCP listener; C2 cancellation removes both" failed at line 81. Its `lsof -a -p <pid> -iTCP -sTCP:LISTEN` returned `MainThrea 183789 runner … TCP 127.0.0.1:40351 (LISTEN)` and `… 127.0.0.1:39111 (LISTEN)` where it expected nothing.

The test passed on dev in A-16427, A-16430 and A-16443. It also passed unchanged on macOS (6/6) and in an isolated Linux container, and listen instrumentation there showed only the test's own positive control binding TCP (impl-1604, A-16452). The failure output does not say whether PID 183789 was the test worker or a process selected through `lsof -t <control socket>`, nor what its command was, so the failure cannot be attributed.

## What to build

On a census mismatch, the test reports each censused PID's command line and native start identity, and the source of each PID: the worker, or the control-socket holder. Find and remove the cause if it reproduces.

## Acceptance criteria

- [ ] C1. A census failure in this file names each offending PID's command and start identity and the reason it was censused (test with a planted listener).
- [ ] C2. The C1 case passes 20/20 on a Linux droplet under the load gate, or the cause is identified and fixed with its own regression test.
