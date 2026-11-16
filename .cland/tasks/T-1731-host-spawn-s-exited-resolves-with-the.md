---
id: T-1731
kind: task
title: Host spawn's `exited` resolves with the raw `process-exited` event instead of `{code, signal}` when reconciliation wins the race after a dropped commit reply
state: open
status: planned
size: S
labels:
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: null
branch: null
created: 2026-11-06T23:09:27.734Z
updated: 2026-11-16T07:31:05.427Z
---

## Summary

impl-1670 found this aside while working T-1670. It ran a four-file Linux mix (`transport-forwards`, `transport-ssh`, `host-ssh-contract`, `remote-discovery-host`) in `docker run --init` at dev dd43ad65, plus T-1670's test-only diagnostics. `hub/test/host-ssh-contract.test.ts:158` "accepted spawn reconciles its durable token after the commit reply is dropped" failed its `assert.deepEqual(receipt, {code:7, signal:null})`.

The resolved value also carried `event: 'process-exited'`, `pid`, `identity`, `authority: 'closed'` and `ended: true`. So after a dropped commit reply, `child.exited` resolves with a different shape depending on which path settles it: the reply path gives `{code, signal}`, and the reconciliation path gives the raw native event. Callers that compare or destructure `exited` see an inconsistent contract. The test passes alone and in the merge batches.

## What to build

- Find where `exited` is settled on the reconciliation path, in the SSH Host spawn after a dropped commit reply (`hub/src/host/ssh-host.ts` and the reconcile or recovery path), and normalise it to the documented `{code, signal}` exit shape. Keep the native event as internal evidence only.
- A deterministic test forces the reconciliation path to win and asserts the exact `{code, signal}` shape, red before the fix.
- Rule 20 sweep of `exited` consumers.

## Acceptance criteria

- [ ] C1. With the commit reply dropped and reconciliation forced to settle first, `child.exited` resolves exactly `{code: 7, signal: null}` (test, red before the fix).
- [ ] C2. `host-ssh-contract.test.ts` passes 10/10 in the four-file parallel mix under a Linux `--init` container at load 8 or more (evidence).
