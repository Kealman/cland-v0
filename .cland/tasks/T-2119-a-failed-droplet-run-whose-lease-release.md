---
id: T-2119
kind: task
title: A failed droplet run whose lease release stays unconfirmed past the accounting wait is marked cleaned and leaves the active set, freeing a Coordinator cap slot while its machine may still run
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-27T09:59:03.507Z
updated: 2026-11-27T09:59:03.507Z
---

## Summary

Found in T-2003's delta source review (A-23786, M2; rev-35 and impl-2003, 2026-11-27). In hub/src/hub/suites.ts (around lines 641 and 2147–2176), once ACCOUNTING_WAIT_MS passes, a failed acquired run whose lease release is still unconfirmed can become accountingPending and cleaned, and then leave `#active`. That frees a Coordinator key-cap slot (`coordinator_suites`) without a positive receipt that the machine was released, so a further suite can start while the earlier droplet may still be running and spending. The behaviour is identical on the base 4464147fe; T-2003 did not introduce it.

## What to build

Keep a run counted against the Coordinator cap, and its spend reserved, until a positive release or deletion receipt arrives. The accounting timeout may mark the run accountingPending for reporting, but must not drop it from the active key count. Bound the wait, and surface an unconfirmed release as a visible notice rather than a silent free slot.

## Acceptance criteria

- [ ] C1. With lease release refused beyond ACCOUNTING_WAIT_MS, the failed run keeps its Coordinator cap slot and spend reservation, and a further matching key is refused until a positive release receipt arrives (test with fakes and a fake clock).
- [ ] C2. The unconfirmed release is reported once as a visible notice naming the run and machine (test).
