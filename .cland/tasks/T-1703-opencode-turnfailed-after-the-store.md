---
id: T-1703
kind: task
title: OpenCode turnFailed after the store closes throws "database is not open" in the pending-permission adapter test
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1881
blocked_by: []
regression_of: T-1696
found_by: droplet
topic: topic-1540
branch: t/T-1703-opencode-turnfailed-after-the-store
created: 2026-11-06T05:22:20.125Z
updated: 2026-11-16T07:38:20.364Z
---

## Summary

T-1702's merge batch 927d727f (A-17026, Linux x64 droplet, peak load 6.4) failed `hub/test/opencode-adapter.test.ts:516` "a pending permission is waiting for approval within one event, and the reply brings the turn back; a form is waiting for human" (3.24 s). The error was `Error: database is not open` (ERR_INVALID_STATE) at `ProcessTable.bySessionId` (hub/src/adapters/processes.ts:293). The call chain was `Sessions.#turnFailed` (sessions.ts:2306), then `turnFailed` (sessions.ts:740), then generation-adapter.ts:76, then opencode.ts:595. An OpenCode turn-failure callback reached Sessions after the test's store had closed, which suggests a teardown race: the adapter callback isn't drained or fenced before the store closes. T-1702 doesn't touch the adapters, so this one is unrelated to it.

## What to build

Make OpenCode adapter callbacks such as turnFailed, arriving after Sessions or its store has closed, settle as a named no-op or be drained before the close, so a late callback never throws into the event loop. If the cause is in the test, make the test drain the adapter before closing its store. Never weaken an assertion.

## Acceptance criteria

- [ ] C1. A deterministic test delivers an OpenCode turnFailed after the store closes and shows it red before the fix and green after.
- [ ] C2. opencode-adapter.test.ts passes 10/10 on Linux under load (evidence).

## Comments

### impl-1703 · 2026-11-16T07:38:20.364Z

C1 deterministic red/green captured in A-19832. Captured OpenCode AdapterHost.turnFailed after awaited hub shutdown and positive closed-store control fails with database is not open before the two-line Sessions fence; full scripted T2 file passes 33/33 after. No shared reply, schema, or wire contract changes. Linux Docker load run in progress under exclusive slot.
