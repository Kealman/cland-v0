---
id: T-1700
kind: task
title: Bound retained transport and generation ownership receipts
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-05T20:18:31.073Z
updated: 2026-11-05T20:18:31.073Z
---

## Summary

Non-blocking follow-up from rev-35's fourth source review of T-1696 at 3c30df86 (review-loop bar; recorded by coord). Exact finding text:

"stoppedOwners retains every successful transport-stop owner and its forward-id set for the module lifetime, without retirement. Sessions.#localForwardOwners and the generation facade's scope/identity indexes also retain old entries. Define bounded retention tied to outstanding current/retained generation obligations, preserving idempotent release and refusing unknown proof."

This is resource retention and maintainability only. No C1–C3 or T-1614 main-path failure was demonstrated.

## What to build

Retire entries from the transport stop-owner receipts, `Sessions.#localForwardOwners` and the generation facade's scope and identity indexes once no current or retained generation obligation refers to them. Repeated release must stay idempotent while an obligation exists, and a release with unknown or retired proof must still be refused.

## Acceptance criteria

- [ ] C1. After a generation's obligations settle, its stop-owner receipt, local-forward owner and facade scope or identity entries are gone, and the maps stay bounded across many relaunch cycles (test).
- [ ] C2. Release stays idempotent while an obligation is outstanding, and a release presenting unknown or retired proof is refused (test).
