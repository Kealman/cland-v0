---
id: T-253
kind: task
title: Fail fast on a serving-time tracker storage stall (T-103 follow-up)
state: open
status: review
size: S
criterion_seq: 3
labels:
  - hub
  - v0.1.2
  - ready-for-agent
assignee: null
parent: E-273
blocked_by: []
topic: topic-268
branch: t/T-253-fail-fast-on-a-serving-time-tracker
created: 2026-10-12T01:35:46.890Z
updated: 2026-10-15T03:52:30.138Z
---

## Parent

Follow-up to T-103 (v0.1.1). T-103 chose fail-fast over fencing tokens for a stalled tracker storage write. A native rename or link already handed to the OS can't be cancelled by an in-process token, so a late write could still publish. T-103 detects and reports stalls (`tracker-storage-stalled`, `hub status`) and bounds hub stop. It deliberately leaves out automatic termination during serving.

## What to build

When a tracker storage operation stalls past its deadline while the hub is serving, the hub fails fast. It logs the abandoned operation, tells sessions and the workbench, and exits non-zero, so a supervisor or the human restarts it, instead of queueing tracker work behind a write that may never finish.

## Acceptance criteria

- [x] C1. A held write past the fail-fast deadline during serving makes the hub exit with a clear error naming the operation and the item; a test proves it.
  - done: impl-253 · 2026-10-15T03:50:29.400Z
- [x] C2. No tracker mutation admitted after the stall commits before the exit.
  - done: impl-253 · 2026-10-15T03:50:31.308Z
- [x] C3. hub/README.md describes the behaviour and the restart path.
  - done: impl-253 · 2026-10-15T03:50:33.826Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-253-1 · 2026-10-15T03:52:30.138Z · commit b34ccb741d34cdb38daa018933951713a4f83b1e

## Comments

### impl-253 · 2026-10-15T03:47:58.337Z

Implementation freezes tracker admission/continuations synchronously at serving stall, logs a fatal diagnostic and broadcasts an Agents notice before shutdown. First real hub/spoke/CLI fail-fast regression passed; extending coverage per Coordinator decision to explicit outstanding-call rejection and both held/released native-write races. Acknowledged writes are checked through task.view after restart.

### rev-23 · 2026-10-15T03:52:30.138Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-253-1
commit: b34ccb741d34cdb38daa018933951713a4f83b1e
scope: full

Source clear at b34ccb741d34cdb38daa018933951713a4f83b1e. Standards and Spec: no high or medium findings. Fatal stop freezes admission and guarded native/index continuations synchronously before notification; active/queued callers receive operation/item stall errors and the real queue tail never advances on abandonment. Daemon publishes warning/Agents notice and stderr diagnostic, then closes; CLI bounds fatal cleanup and exits 1 even if the held operation returns. Already-issued native publication remains explicitly uncertain. New real foreground hub/UI/spoke/CLI regressions check both held and released native writes, exit/diagnostic, notifications, caller refusals, queued/late absence and acknowledged-write durability across restart. Ordinary bounded stop/detection coverage is retained. Reviewed against Coordinator c0d9b15c's completed/acknowledged versus outstanding-work interpretation. C3 README/restart path verified; C1/C2 remain run-dependent pending exact-head no-mode local verification. A-2666 records detailed review. Submit cland verify --executor local with no mode at this source-cleared head; no per-item QA required.

Criteria: C3 verified.
