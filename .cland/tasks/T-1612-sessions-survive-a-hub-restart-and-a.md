---
id: T-1612
kind: task
title: Sessions survive a hub restart and a tunnel loss
state: open
status: in progress
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
topic: topic-1381
branch: t/T-1612-sessions-survive-a-hub-restart-and-a
created: 2026-11-02T03:33:58.350Z
updated: 2026-11-04T15:10:04.989Z
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

## Comments

### impl-1612 · 2026-11-04T14:55:26.560Z

Consumer sweep before edits: Host members/wire operations remain unchanged. Existing onTable callback consumers are sshHost tests host-agent-restart, host-ssh-contract and host-ssh.test; registry callers: daemon, host-ssh-contract, host-ssh-registry, host-clone-integration, host-records, remote-discovery-host. Registry will gain an optional ready notification; existing callers unaffected. Sessions resumeAll/observation consumers include session-resume, session-async-processes, launch-recovery, native-boundary, remote cleanup/adoption tests and fake adapters. Recording/spread Hosts, hostControl fakes, held receipt helpers and nvim callers need no Host/frame changes. Recovery continues through adapter Host.alive with persisted PID+birth and generation adoption; no PID-only re-find, no new native signals. Found gap: startup resume can fail while SSH is down, with no Sessions retry when host later publishes its table. Will reconnect that ready receipt to per-host resume, coalesced and drained.

### impl-1612 · 2026-11-04T15:10:04.989Z

Working-tree local macOS arm64 Node24.21.0: npm run check exit0 (full root typechecks, web build, static/test lint; existing report-only diagnostics, no lint refusals). Additional unchanged component files pass host-ssh-registry2/2 and session-host-routing16/16; session-resume2/2 and session-async-processes3/3 remain unedited/pass. Native fixture corrected from roleless to Implementer rows after locating the existing no-role refusal. Heavy native rerun awaits Coordinator's exclusive preservation lock; no native survival/coverage pass claimed. A-16585 records initial consumer/component evidence.
