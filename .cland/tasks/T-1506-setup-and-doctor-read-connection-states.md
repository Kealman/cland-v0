---
id: T-1506
kind: task
title: Setup and doctor read connection states through a bounded readiness wait
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1270
branch: t/T-1506-setup-and-doctor-read-connection-states
created: 2026-10-31T08:18:54.524Z
updated: 2026-10-31T14:50:14.220Z
---

## Summary

T-1502 found that `cland setup` read a paired remote's connection state as a single sample and reported `open` while the gateway was reconnecting. Audit setup and doctor for any other status read as a single sample, and give each one a bounded readiness wait. Rule batch 5 (A-14855) C3, accepted by the human on 2026-10-31.

## Acceptance criteria

- [x] C1. The item lists every setup and doctor step that reports a connection, pairing, process or service state, and records for each one whether it reads a single sample.
  - done: impl-1506 · 2026-10-31T14:50:14.126Z
- [x] C2. Each single-sample read that can see a transient state polls through the shared readiness helper from T-1502, within a bound. A test on fake clocks covers one transient-then-ready case and one past-the-bound case for each changed step.
  - done: impl-1506 · 2026-10-31T14:50:14.220Z

## Comments

### impl-1506 · 2026-10-31T14:46:03.708Z

C1 audit: setup project/harness install/favourite/trust/accounts/speech inspect persisted config/files/completed commands, not connecting services. Logins and doctor toolchain/keys inspect completed command/auth results. Setup hub running() samples discovery and authenticated hub.status; startProjectHub already polls startup for 10s. Aide samples running/exited/stopped (no starting status); launch/resume return action receipts. Telegram/Discord loaded disconnected rows are transient: paired reruns and Discord post-reload already wait; Telegram post-reload and unpaired initial reads do not. Pairing samples pending inbox after a human pause with one optional human wait; approval returns durable identity, no connecting state. Doctor project discovery/lock/PID identity and orphans are point-in-time OS diagnostics; hub.status is a bounded socket response and web unavailable is a final bind result. Doctor remotes samples transient disconnected rows (both messengers); pairing is stored identity in the reply. Web bundle/network/Git checks inspect installed/configuration facts. Changes planned: all loaded setup remote reads, Telegram post-reload and doctor remote connections use shared T-1502 waitForRemote. Disabled/missing-token/missing-row/old-hub diagnostics remain immediate. Consumer search: waitForRemote/remote.status/remotes/connection across hub/src, hub/test all tiers, web/nvim/shared, .agents/skills, docs/agents, qa. No wire change; projections/platforms unaffected; setup and doctor/readiness tests/docs/help/implement guidance affected. Existing public setup steps/local doctor frames are the approved seams.
