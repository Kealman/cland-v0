---
id: T-1839
kind: task
title: A native fake-host tunnel drop reaches the hosts.state outage alert, and QA can trigger it
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1819
topic: null
branch: null
created: 2026-11-12T14:10:23.892Z
updated: 2026-11-12T18:07:57.581Z
---

## Summary

The Hosts row's red state for an unreachable host is proven today only by component tests that drive `HostHealth.transition` directly; no native test drops a fake host's tunnel and reads the pushed `hosts.state` outage alert, and QA has no way to make a fake host unreachable on a CLI-started scratch hub. This item adds that native proof and a QA-usable way to trigger it, so the epic's Definition of done ("the row turning red when a host is made unreachable") can be shown natively.

## What to build

A native fake-host case in which a real tunnel loss (the fake host's agent or its SSH transport going away while the fake provider still reports the machine running) reaches the hub's host-health path and the pushed `hosts.state` frame carries the pool's outage alert for that host within a named bound, and the alert clears when the tunnel returns. A documented, fakes-only way for QA to cause that tunnel loss on a CLI-started scratch hub with the fake host provider (for example a fake-provider or fake-SSH control the QA brief can call by literal path), never a real host, never a signal to a process the scratch project does not own.

## Acceptance criteria

- [ ] C1. A native fake-host test drops a running fake host's tunnel and reads a `hosts.state` frame whose pool alert is `{kind: 'outage', host}` for that host within a named bound, then restores the tunnel and reads the alert cleared (test).
- [ ] C2. A fakes-only control lets a scratch project's QA run make one fake host unreachable and reachable again on a CLI-started hub, documented in the fake host provider's per-test docs with the exact command (test).
- [ ] C3. The control refuses outside a fake-provider pool and never signals a process the scratch project does not own (test).
