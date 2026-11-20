---
id: T-2037
kind: task
title: Verify admission takes 90–150 s under a crew-sized load (CLI exits 75) while the hub runs at 70–94 % CPU and the workbench polls events.list 200–400 times a minute
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-20T17:55:35.281Z
updated: 2026-11-20T17:55:35.281Z
---

## Summary

On 2026-11-20 between 17:46Z and 17:56Z, with eight implementers and two reviewers live and one merge batch running, droplet verify admission took about 90–150 s per submission. impl-1655 submitted at 17:48:08 and was admitted at 17:49:35. impl-1638 submitted at about 17:52 and was admitted at 17:53:43; its CLI had already exited 75. impl-1865 was still unadmitted after more than 2.5 minutes. One submission was refused with "droplet API reachability probe failed: DigitalOcean 0 deadline: request deadline reached", and the next one 90 s later was admitted. Meanwhile the hub ran at 70–94 % CPU. The open web workbench polled `events.list` with limit 200 at 200–400 calls a minute, and hub.log holds over 408,000 such audit lines and many slow-request events (send 366–596 ms, events.list 268–649 ms, budget 250 ms).

## What to build

Find what dominates admission time under this load (provider probe, tree bundle, scheduler or hub event-loop saturation) and bring admission well inside the CLI's 90 s reply wait. Also check whether the workbench's events.list polling rate is intended, and reduce it if not, for example to a push or longer interval.

## Acceptance criteria

- [ ] C1. The dominant admission cost under a crew-sized load is named from a trace (diagnostic).
- [ ] C2. Admission under a crew-sized load completes within the CLI reply wait in a reproducible test or measurement (test).
- [ ] C3. The workbench's events.list request rate while idle is bounded and documented (test).
