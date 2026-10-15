---
id: T-537
kind: task
title: cland verify can time out at the CLI's 15 s reply limit while the hub admits the run
state: open
status: backlog
size: S
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T21:04:49.883Z
updated: 2026-10-15T21:04:49.883Z
---

## Summary
On 2026-10-15 at 21:04Z, impl-311's `cland verify --report …` for T-311 at b7a42064 failed client-side: it hit the CLI's 15 s wait for a hub reply. The hub had nevertheless admitted the run (`verify queue` showed `impl-311 · T-311 · droplet acquiring` from 21:04:06Z). A session that retries after such a timeout can submit a duplicate run and double the droplet spend. Only the queue check kept impl-311 from doing so.

## Acceptance criteria
- [ ] C1. `suite.start` replies within the CLI's deadline whatever droplet admission is doing, or the CLI's timeout message says the run may have been admitted and names `cland verify queue` to check.
- [ ] C2. A resubmission at the same head while the first run is queued or running is refused or joins the existing run, never a second droplet.
