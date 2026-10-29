---
id: T-1087
kind: task
title: FrameClient ownership accounting runs ps for the in-process fixture's synthetic pids
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1216
branch: t/T-1087-frameclient-ownership-accounting-runs-ps
created: 2026-10-21T23:17:06.345Z
updated: 2026-10-29T19:09:00.002Z
---

## Summary

In the in-process Claude fixture, FrameClient's result-ownership accounting calls `execFileSync`/`ps` for the synthetic positive pids the fixture invents. That makes report-only T2 resource warnings in T2 runs (seen in A-8786, T-1034's run 4437665a). The fixture's process facts are synthetic, so native cleanup accounting has nothing to check.

## Acceptance criteria

- [ ] C1. Synthetic process facts from the in-process fixture skip native ps/execFile accounting, and the T2 run reports no child_process warnings from FrameClient ownership accounting (test).
- [ ] C2. Native fixtures that start real processes keep their ownership accounting and cleanup checks unchanged (test).

## Comments

### impl-1087 · 2026-10-29T19:09:00.002Z

Scope/seams: Claude scheduling component's production frame client and scripted native CLI; native FrameClient default plus process cleanup. Existing observeProcesses argument allows fixture-local opt-out; no shared wire/schema/production contract changes. Consumers searched: FrameClient, connectUi/dispatcherUi/connectWsUi and rememberResultProcesses call sites throughout hub/test; only claude-code-schedule component reports invented positive PIDs through the default observer. session-resume-component already supplies its synthetic observer; generic fakeHarness uses null PIDs; native lifecycle/CLI fixtures retain the default.
