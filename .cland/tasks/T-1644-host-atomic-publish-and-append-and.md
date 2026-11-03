---
id: T-1644
kind: task
title: Host atomic publish and append, and OpenCode's shared ignore through the Host
state: open
status: backlog
size: S
criterion_seq: 4
labels: []
assignee: null
parent: E-1532
blocked_by:
  - T-1593
  - T-1601
topic: null
branch: null
created: 2026-11-02T23:42:20.637Z
updated: 2026-11-02T23:43:08.633Z
---

## Summary

T-1601 moves the adapters onto the launch Host's layout and files, but OpenCode's shared `.gitignore` preparation (`hub/src/adapters/opencode/server.ts`) uses an atomic no-clobber link, an append and staging cleanup. The Host contract (`hub/src/host/host.ts`) offers only an overwriting `writeFile` and `removePath`. By the Coordinator's decision of 2026-11-02 (topic-1352), T-1601 keeps that preparation in a local-host helper, exempted from the boundary lint by name, and refuses it on a nonlocal Host. This item closes that gap.

## What to build

Add atomic publish (create-if-absent) and append to the Host contract, implemented on the local Host and in the host agent (after T-1593). Then move OpenCode's shared-ignore preparation onto the launch Host and remove T-1601's exemption.

## Acceptance criteria

- [ ] C1. The Host contract has atomic no-clobber publish and append. The local Host and the agent implement them with the same semantics, including concurrent writers, against the fake hosts (test).
- [ ] C2. OpenCode's shared-ignore preparation goes through the launch Host. On `local` the result is byte-identical to today, and T-1601's lint exemption is removed (test).
- [ ] C3. An OpenCode launch on a fake nonlocal host prepares the shared ignore on that host (test).
- [ ] C4. The Host contract offers a stat with mode and size, so the launch-file rollback restores an overwritten file's mode on a nonlocal Host and T-1601's nonlocal overwrite refusal is removed (test)
