---
id: T-2116
kind: task
title: claude-code-remote 'late SessionEnd after the recovery snapshot never grants an adopted closed receipt' fails with 'process authority unknown; stop requires host reboot or recycling' under Linux batch load
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
created: 2026-11-27T00:29:03.616Z
updated: 2026-11-27T00:29:03.616Z
---

## Summary

Merge batch b8983412 (T-2114 alone, run 68e9a39a, A-23669/A-23672 line 30367, 2026-11-27) failed `hub/test/claude-code-remote.test.ts::late SessionEnd after the recovery snapshot never grants an adopted closed receipt` in its base run and its load repetitions with `Error: process authority unknown; stop requires host reboot or recycling` (hub/src/host/agent-client.ts:27). impl-2114 showed that the host-agent stop path (AgentPrepared.prepare → AgentProcesses.captureForStop/#capture → its own ps group) does not import hub/src/system-processes.ts, so the T-2114 change is unrelated. The error originates at processes.ts:341/369 when retained process authority is unknown. The case passed 5/5 locally, and it passed in every earlier Linux run checked (A-23653, A-23657, A-23658, A-23661, A-23662).

## What to build

Find why the host agent's retained authority becomes unknown under Linux load in this case (a capture timing out, or a process group not observed) and make the stop resolve it, or report a named cause, rather than requiring a host reboot in a fake-backed test.

## Acceptance criteria

- [ ] C1. The cause of "process authority unknown" in this case is named with a deterministic reproducer that fails first (test).
- [ ] C2. The case passes in the item's Linux droplet verify (test).
