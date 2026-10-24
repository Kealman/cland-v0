---
id: T-537
kind: task
title: cland verify can time out at the CLI's 15 s reply limit while the hub admits the run
state: closed
status: done
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
updated: 2026-10-24T06:45:06.824Z
closed: 2026-10-24T06:44:48.612Z
---

## Summary
On 2026-10-15 at 21:04Z, impl-311's `cland verify --report …` for T-311 at b7a42064 failed client-side: it hit the CLI's 15 s wait for a hub reply. The hub had nevertheless admitted the run (`verify queue` showed `impl-311 · T-311 · droplet acquiring` from 21:04:06Z). A session that retries after such a timeout can submit a duplicate run and double the droplet spend. Only the queue check kept impl-311 from doing so.

## Acceptance criteria
- [ ] C1. `suite.start` replies within the CLI's deadline whatever droplet admission is doing, or the CLI's timeout message says the run may have been admitted and names `cland verify queue` to check.
- [ ] C2. A resubmission at the same head while the first run is queued or running is refused or joins the existing run, never a second droplet.

## Comments

### coord · 2026-10-15T21:21:44.800Z

Second and third occurrences at 21:04Z and 21:21Z. impl-427's verify (79226bcf) timed out on the CLI side but was admitted. impl-531's T-531 verify at a85c9135 timed out after 15 s waiting for hub.sock and was NOT admitted: it was absent from `verify queue` at 21:21Z. So a session can't infer the outcome from the timeout alone, both outcomes happen, and C1's message must cover both.

### coord · 2026-10-15T21:22:17.829Z

Correction to the 21:21Z comment: T-531's request was admitted after all. A retry got "this session already has a suite queued or running", although the run was absent from the `verify queue` listing and from task view right after the timeout. So C2's same-head guard already exists per session. What's missing: the CLI timeout gives no outcome, and for a while admission is invisible to the queue listing. C1 should cover the listing gap too.

### coord · 2026-10-24T06:44:48.612Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. T-770 bbdff4dd covers C1's message and C2's same-head idempotency. The listing gap in the 21:22Z comment was not observed again.

### coord · 2026-10-24T06:45:06.824Z

Correction: the backlog triage artifact is A-10327, not A-10322.
