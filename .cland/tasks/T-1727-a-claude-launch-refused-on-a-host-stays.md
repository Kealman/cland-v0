---
id: T-1727
kind: task
title: A Claude launch refused on a host stays "still supervised; cleanup is pending" with no generation receipt, blocking a relaunch of that name
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: E-1533
blocked_by: []
regression_of: T-1607
found_by: qa
topic: null
branch: null
created: 2026-11-06T16:38:40.126Z
updated: 2026-11-06T17:00:28.723Z
---

## Summary

qa-678 hit this in E-1532's Definition-of-done run at dev 6f0cf6ae (row E1532D-21, CLI-started scratch hub, fake host f2). A Claude Code launch was refused by the account-root fence: `Claude account config root must be an agent-owned directory with mode 0700`. The fence is correct; the scratch root was 0755. The same refusal then reported `spawned process cleanup failed: cleanup-incomplete on host f2: Error: Claude generation receipt missing; cleanup is pending and the failed launch remains supervised`.
- The session list, the host's processes.json and launches, and the process census showed no cc.
- After the root was fixed to 0700, a relaunch of the same name was refused with `failed launch of "cc" is still supervised; cleanup is pending`.
So a refusal that happens before any Claude process starts leaves a supervised failed generation that waits for a receipt which can never arrive, and it blocks the name.

## What to build

A launch refused before spawn, or a spawn whose generation never produced a process, settles its supervision with a named terminal outcome: no receipt is expected when no process was started. A relaunch of the same name is then admitted. A genuinely unknown spawn outcome stays fenced, as today. Find where the failed-launch supervision waits for the generation receipt (the Claude stop owner and receipt path from T-1607/T-1673/T-1683).

## Acceptance criteria

- [ ] C1. A Claude launch on a host refused by the account-root fence before spawn leaves no supervised failed launch, and an immediate relaunch of the same name is admitted (test, red before the fix).
- [ ] C2. A launch whose spawn outcome is genuinely unknown stays fenced with its existing message (test).

## Comments

### coord · 2026-11-06T16:40:47.750Z

The effect is host-wide (coord, from qa-678's DoD run and a read-only source reading). After the refused cc launch, a fresh launch under a new name, cc2, on the same host was refused with `host f2: tunnel outcome unknown for claude-adopt:17b2477e-…; storage remains fenced`. In hub/src/host/ssh-host.ts, a failed `adopt-claude` adds `claude-adopt:<generation>` to the host's `unknown` set, and `check()` then fences later storage operations on that host. So one Claude launch refused before spawn leaves the whole host fenced for Claude operations, not just the session name. Scratch evidence (hub log, f2's agent log, the harness_pending_stops row) is retained in qa-678's run. The fix should settle the pre-spawn refusal without leaving an unknown admission. Add a test where a second session is launched on the same host after a refused one.

### coord · 2026-11-06T16:41:38.726Z

Confirmed by qa-678, read-only. cc's failed generation 17b2477e-1d3d-4f2e-8f14-fdc80e2b2be0 is exactly cc2's fence token. The failed launch stayed in phase launching with pid null, pending 354 s at the last observation, and its harness_pending_stops row reads stopped:true, rowRemoved:false, roleRolledBack:false. Source path:
- sessions.ts:934 hides pending rows from the list;
- :1087–1091 retries the cleanup every 5 s;
- :1344 fences the name;
- claude-code.ts:574–579 requires adoption before settlement;
- ssh-host.ts:201–214 keeps the host-wide unknown token.
The hub log repeats missing-receipt cleanup failures, and f2's agent output has no per-adopt diagnostic. So a launch refused before spawn retries forever, fences the host, and is invisible in the session list.
