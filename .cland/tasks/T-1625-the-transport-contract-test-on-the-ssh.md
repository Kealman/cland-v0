---
id: T-1625
kind: task
title: The transport contract test on the ssh carrier and the fake transport
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1623
  - T-1595
  - T-1589
topic: null
branch: null
created: 2026-11-02T03:34:18.725Z
updated: 2026-11-02T03:34:18.725Z
---

## Summary

A shared contract suite names the four host-side sockets (`hub.sock`, `spoke.sock`, `git.sock`, `agent.sock`) as what a transport must carry. It runs against the `ssh` carrier, driven by E-1532's fake sshd stand-in, and against the fake transport, with stub endpoints on both sides. The suite proves relay, socket placement, no TCP and reconnect, so a 0.4.x `outbound` carrier can pass the same suite unchanged.

Hot files: new `hub/test/transport-contract.ts`, new `hub/test/transport-ssh-contract.test.ts`, new `hub/test/transport-fake-contract.test.ts`, new `docs/agents/tests/hub-test-transport-contract.md`; reads but never edits E-1532's transport, carrier and fake transport

## Acceptance criteria

- [ ] C1. The contract exports one list naming `hub.sock`, `spoke.sock`, `git.sock` and `agent.sock` as the transport's host-side endpoints, for a later carrier to import (test).
- [ ] C2. Once connected, each of the four is a Unix socket in the host's agent-owned run directory at mode 0700 (test).
- [ ] C3. Bytes cross each endpoint both ways: `hub.sock`, `spoke.sock` and `git.sock` from the host to stub listeners on the hub's side, and `agent.sock` from the hub's side to a stub host agent (test).
- [ ] C4. After the carrier drops and reconnects, all four endpoints answer again (test).
- [ ] C5. Neither side binds a TCP port for any of the four endpoints (test).
- [ ] C6. Each carrier reports its kind through the transport kind type of ticket 9 (test).
- [ ] C7. The suite passes on the `ssh` carrier with the fake sshd stand-in and on the fake transport, with no real network or remote machine (test).
- [ ] C8. The contract's guide states what a second carrier must pass to replace `ssh`, naming `outbound` (0.4.x) as the expected one.

## Notes

Shared files: see Hot files
