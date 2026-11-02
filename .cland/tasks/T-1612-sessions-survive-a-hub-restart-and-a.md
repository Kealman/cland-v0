---
id: T-1612
kind: task
title: Sessions survive a hub restart and a tunnel loss
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1603
  - T-1605
  - T-1606
  - T-1607
topic: null
branch: null
created: 2026-11-02T03:33:58.350Z
updated: 2026-11-02T03:33:58.350Z
---

## Summary

After a hub start, the hub re-opens each host record's tunnel and re-reads the agent's table. It re-finds running rows by Linux identity, re-adds their per-session forwards from the rows, and lets spokes reconnect by re-reading the host's `hub.json`. Injects resume. A tunnel loss with the hub up keeps every row running while the reconnect loop runs.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/hub/daemon.ts`, `hub/src/host/ssh-host.ts`, `hub/test/host-survival.test.ts` (new)

## Acceptance criteria

- [ ] C1. With an OpenCode, a Codex and a Claude Code session on two fake hosts, a 20 s hub stop and start leave every row running with its identity, its forwards back and its spoke welcomed again, and a delivery sent after the restart is injected into each (test).
- [ ] C2. During the stop nothing on the hosts is signalled, and the hub's start probes no remote pid on its own machine (test).
- [ ] C3. A master killed while sessions run leaves every row running, and its forwards and spokes are back after the reconnect (test).
- [ ] C4. A row whose identity the agent no longer reports is marked exited at the re-read, and the session-resume and session-async-processes test files pass with no test edited.

## Notes

Shared files: `hub/src/adapters/sessions.ts` (startup re-find), `hub/src/hub/daemon.ts`, `hub/src/host/ssh-host.ts`
