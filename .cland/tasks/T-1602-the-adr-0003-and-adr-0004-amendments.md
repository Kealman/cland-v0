---
id: T-1602
kind: task
title: The ADR 0003 and ADR 0004 amendments
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1591
  - T-1596
  - T-1597
topic: null
branch: null
created: 2026-11-02T03:33:55.945Z
updated: 2026-11-02T03:33:55.945Z
---

## Summary

ADR 0003 records the spoke edge on a Unix socket and the per-host git socket, which hosts reach only over the hub's own SSH connection, and the per-host secret's narrower authority; nothing new binds a network address. ADR 0004 records the territory served by `git daemon --inetd` through per-host sockets, pushes limited to task branches leased to the host's sessions, no deletion and no move of `dev` or `main`, and item branches created in the territory.

Hot files: `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, `docs/adr/0004-agents-work-on-a-local-git-territory.md`

## Acceptance criteria

- [ ] C1. ADR 0003 has a dated amendment naming `.cland/run/spoke.sock`, the per-host git socket, the per-host secret and its refusal of human authority, and stating that no new listener binds a network address.
- [ ] C2. ADR 0004 has a dated amendment naming `git daemon --inetd` per connection on per-host sockets, the per-host allow list with its revocation before merges, the refusal of deletions and of `dev` and `main`, and item branches created in the territory.
- [ ] C3. Both amendments link spec §3.2, §3.3 and §3.12, and use the glossary's Host, Host agent and Tunnel.

## Notes

Shared files: `docs/adr/0003-*.md`, `docs/adr/0004-*.md`
