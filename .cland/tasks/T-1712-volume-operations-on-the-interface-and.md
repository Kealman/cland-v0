---
id: T-1712
kind: task
title: Volume operations on the interface and the fake host provider
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1707
topic: null
branch: null
created: 2026-11-06T10:48:15.245Z
updated: 2026-11-06T10:49:14.833Z
---

## Summary

The provider interface gains the login-disk volume operations: create, attach, detach, snapshot, delete and list, with deletion confirmed by a read. The fake provider models a provider's volume rules: one attachment at a time, a volume bound to its region, and a snapshot rate limit with a retry time. Logins (E-1535) build on these; nothing here mounts or reads a volume.

Hot files: `hub/src/host/provider/provider.ts`, `hub/src/host/provider/fake.ts`, `hub/test/host-provider-contract.ts`, `hub/test/host-provider-volumes.test.ts` (new)

## What to build

Volume operations and their typed outcomes (`attached`, `refused: attached elsewhere`, `refused: rate limited until <t>`, `deleted` only after a confirming read), the fake's configurable snapshot window, and volume cases in the contract suite.

Notes: the contract suite is shared; the DigitalOcean volumes ticket runs its volume cases against DigitalOcean.

## Acceptance criteria

- [ ] C1. On the fake provider, a volume attaches to one machine, and a second attach elsewhere is refused while the first holds it (test).
- [ ] C2. A second snapshot inside the configured window is refused with its retry time, and one after the window succeeds (test).
- [ ] C3. Attaching a volume to a machine in another region is refused (test).
- [ ] C4. Volume deletion reports `deleted` only after a read finds it gone, and the volume cases of the contract suite pass on the fake provider (test).
