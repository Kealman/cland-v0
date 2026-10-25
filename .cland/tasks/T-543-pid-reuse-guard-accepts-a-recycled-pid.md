---
id: T-543
kind: task
title: PID-reuse guard accepts a recycled PID that started within the same ps second
state: open
status: in progress
size: M
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: E-1284
blocked_by: []
topic: topic-1038
branch: t/T-543-pid-reuse-guard-accepts-a-recycled-pid
created: 2026-10-15T22:29:59.157Z
updated: 2026-10-25T10:45:47.814Z
---

## Summary
Found aside by impl-525 on T-525 (2026-10-15 22:29Z). `hub/src/hub/lock.ts:37-40` reads `ps -o lstart`, which has whole-second resolution, and `sameProcess` in `hub/src/adapters/processes.ts:27-32` accepts equal start stamps. If a managed PID exits and the OS recycles it to an unrelated process within the same second, the stop and cleanup guard accepts the replacement as the managed process and can SIGTERM or SIGKILL it. That's unlikely under ordinary PID allocation, more likely under heavy PID churn such as a loaded test suite. The consequence is termination of an unrelated process.

## Acceptance criteria
- [ ] C1. The identity check uses a start identity finer than one second where the platform offers one (for example `/proc/<pid>/stat` starttime on Linux, `proc_pidinfo` or `sysctl` kinfo on macOS), or adds a second discriminator (command, ppid or a nonce) so that two processes started in the same second never compare equal.
- [ ] C2. A test stages a same-second reused PID with a different identity and shows stop and cleanup refuse to signal it, while the real managed process is still signalled.

## Comments

### impl-543 · 2026-10-25T10:45:47.814Z

Consumer inventory (rule 20, before edits): native lstart APIs/lock ownership in hub/src/hub/lock.ts; persisted harness rows/pending stops in adapters/processes.ts, contract.ts, sessions.ts, launch-files.ts; capture/resume/stop in claude-code.ts, codex.ts, opencode.ts; process-table.ts/system-processes.ts and orphan/fixture-processes.ts; suite-lock, suite-worker, executor/local, droplet lease/watchdog and doctor/project lstart readers. Tests across tiers: process-started, system-processes, process-cleanup, pid-identity (T3), lifecycle-serialization, launch-recovery, adapter-native-boundary, session-resume-component, session-events, name-reservation, request-guard, sqlite-contention, claude-code-schedule; orphan/fixture-orphan/territory-lock/executor-lock and suite runner tests. Shipped implement skill, docs/agents/tests.md and hub README describe identity; QA T-386/E-579 and historical docs/evidence/T-698 mention pidStarted as opaque or whole-second identity. nvim/web/shared have no identity comparison consumers. Plan additive birth identity fields, preserving lstart fields and old wire decoding. Existing lstart-only managed rows remain visible/liveness-conservative but do not authorize destructive signals. Lock-only legacy ownership stays conservative. New native identity is Linux boot-id + proc start ticks, macOS kinfo_proc start timeval; unknown/malformed identity refuses signals. Test seams: pure native-format parsers (T1), existing synthetic system-process signal/cleanup boundary (T3), existing old-wire shape regression. No key/browser changes; QA policy none.
