---
id: T-1626
kind: task
title: The droplet executor and the host carrier share one ssh binary selector
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1884
blocked_by:
  - T-1589
topic: null
branch: null
created: 2026-11-02T05:50:22.553Z
updated: 2026-11-16T07:29:08.812Z
---

## Summary

The droplet executor (`executor/droplet/machine.ts`) honours `CLAND_SSH_BIN`/`CLAND_SCP_BIN` without any gate, while E-1532's host carrier selects its binaries through `sshBinaries(env)` (T-1589), which honours them only under the fake-hosts gate. Move the executor onto one selector so both paths share one rule.

## What to build

The executor resolves its `ssh`/`scp` through a shared selector. Its test override keeps working for the executor's own fixtures under an explicit executor-test gate (or the same gate, whichever the executor tests can adopt without editing their assertions), and production never honours the override outside a gate. The executor argv audit doc is updated.

Found by impl-1589 while building T-1589 (topic-1327, 2026-11-02 05:50Z); T-1589 keeps its gate to the new host carrier and leaves the executor unchanged.

## Acceptance criteria

- [ ] C1. The droplet executor and the host carrier resolve `ssh`/`scp` through one selector function.
- [ ] C2. Outside its test gate, the executor ignores `CLAND_SSH_BIN`/`CLAND_SCP_BIN` (test).
- [ ] C3. The executor-contract, executor-droplet, executor-prepare and remote-fixture tests pass with their assertions unchanged.
- [ ] C4. `docs/executor-argv-audit` names the selector and the gate.
