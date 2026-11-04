---
id: T-1613
kind: task
title: A rebooted host ends its sessions
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1612
  - T-1666
topic: topic-1384
branch: t/T-1613-a-rebooted-host-ends-its-sessions
created: 2026-11-02T03:33:58.539Z
updated: 2026-11-04T17:16:37.664Z
---

## Summary

The agent's hello carries its boot id. When a host comes back with a boot id other than the one its rows were recorded under, the hub marks those sessions exited, vacates their roles as for an exited local session, and bootstraps the host's supervisor again. `fake-host.ts reboot` ends all of a fake host's processes, clears its run directory and writes a new boot id.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/host/ssh-host.ts`, `hub/test/fakes/fake-host.ts`, `hub/test/host-reboot.test.ts` (new)

## Acceptance criteria

- [ ] C1. After `fake-host.ts reboot`, every session on that host reads `exited` and its role is vacated with the same notice as a local harness exit, while sessions on the other fake host are untouched (test).
- [ ] C2. The hub restarts the rebooted host's supervisor and agent and the tunnel is `up` again (test).
- [ ] C3. No stop or signal is sent for the exited rows to any host or to the hub's machine (test).

## Notes

Shared files: `hub/src/adapters/sessions.ts` (exit and vacate), the fake-host control script (adds reboot)

## Comments

### impl-1613 · 2026-11-04T17:07:12.370Z

Rule 20 sweep before edits: readiness onTable consumers are host/registry.ts and host-agent-restart.test.ts (recording observers); onReady consumer is hub/daemon.ts; resumeHost consumers are daemon.ts, Sessions.resumeAll, and host-survival.test.ts. Callback additions retain prior rows argument and accept old one-argument observers. Boot evidence already persists in remote pidIdentity (process-host.ts and agent/native.ts). AgentHello remains unchanged, so AgentClient, protocol fixtures, raw socket readers, startup probes, and older agents retain their wire shape. Searches covered hub, docs, and shipped .agents skills for onTable, onReady, resumeHost, pendingHostResumes, bootId, and pidIdentity. Final reboot/retirement consumer sweep follows the landed T-1666 API; no verify submitted yet.

### impl-1613 · 2026-11-04T17:16:37.664Z

Dependency seam committed on T-1666 at 94ff42843ff83eb060701e729075fcfc95e0e5fe (not landed): Sessions.retainHostGeneration(process, {cause: "host-rebooted", bootId}) persists closure for all harnesses. PendingStop.hostRebooted is {bootId, launchGeneration?}; it preserves original pending resource undo and fences retries/continuations against native operations. Reboot flow must publish exit/vacate separately and bypass the normal pending-stop #exited branch only after durable proof admission. Shared hostBootChanged matches ad51d375a. Waiting for dependency landing and Coordinator merge instruction; no review or verification requested.
