---
id: T-561
kind: task
title: A verify that fell back to local keeps waiting for the local slot after remote slots free up
state: open
status: planned
size: S
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-16T01:25:55.841Z
updated: 2026-10-20T09:41:43.746Z
---

## Summary
On 2026-10-16 at about 01:24Z, `cland verify queue` showed T-523's and T-548's verifies as waiters 1 and 2, each waiting about 1,780 s. Both had been answered "remote budget full; running locally" at submission (00:11Z and 01:02Z). The local slot was held by T-488's suite from 01:04Z, while 3 of 6 remote slots were free. A no-flag verify that falls back to local at admission stays bound to the local slot for its whole wait, so free droplets sit idle while task verifies queue behind one Mac suite. The workaround was to cancel the waiter and resubmit with `--executor droplet --fresh`.

## Acceptance criteria
- [ ] C1. A no-flag verify waiting for the local slot is re-evaluated when a remote slot frees and moves to the droplet, keeping its queue order and reporting the change. An explicit `--executor local` stays local.
- [ ] C2. A test fills the remote budget, submits a no-flag verify (local fallback, waiting behind a local holder), then frees one remote slot, and sees the verify admitted remotely.
