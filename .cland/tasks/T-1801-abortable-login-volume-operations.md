---
id: T-1801
kind: task
title: "Abortable login-volume operations: AbortSignal through Host.loginDisk and the provider volume methods"
state: open
status: backlog
size: M
labels:
  - needs-triage
  - deferred-0.4.2
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-10T05:24:32.407Z
updated: 2026-11-24T08:58:57.371Z
---

## Summary

`LoginBinder.close` (T-1778) joins in-flight attach, list and `loginDisk` calls but cannot cancel them, because `Host.loginDisk` and the `HostProvider` volume methods take no `AbortSignal`. Shutdown therefore waits for each operation's own deadline. Additive signal propagation through `provider.ts`, `digitalocean.ts`, `ssh-host.ts` and the agent request owner would let close cancel the producers, with receipts proving the outcome.

## Context

Raised by T-1778's source review, 2026-11-10. The Coordinator kept T-1778 to join-only shutdown: a held bind keeps its pending fence and is reconciled by T-1793. The capability was too wide for that lane, and it crossed T-1782's provider files.

## Acceptance criteria

- [ ] C1. `Host.loginDisk` and the provider volume methods accept an optional signal, and existing callers are unchanged (test).
- [ ] C2. `LoginBinder.close` aborts an in-flight attach or mount; the outcome is a positive receipt or a retained pending fence, never a timeout race (test).
- [ ] C3. A rule-20 consumer sweep lists every provider and Host implementation and test (test).

## Comments

### coord · 2026-11-10T08:10:13.438Z

Overlap note (coord, 2026-11-10): T-1781 is adding an optional pre-send `authorize` callback to `HostProvider.snapshotVolume` options, in both fake and DigitalOcean, called right before the native send; a refusal sends nothing. When T-1801 adds signal propagation to the volume methods, build on that seam and keep both: authorize decides whether to send, and the signal cancels an in-flight operation.

### coord · 2026-11-10T14:00:17.159Z

Candidate scope from T-1779 (coord, 2026-11-10). T-1779 accepts concurrent hub-side `loginDisk` calls (both unmount requests outstanding before either detach completes, C3) while execution is serialized below: the agent server chains requests per connection, `sshHost.loginDisk` reuses one connected stream, and `cland-auth.sh` takes a global `/cland/auth/.operation.lock`. Parallel `loginDisk` request streams belong here, if wanted, with pinned agent identity, owned closure and cancellation. T-1779 made no transport or helper change.

### coord · 2026-11-24T08:58:57.371Z

Deferred out of 0.4.1 to 0.4.2 or later. The reason is in the deferral table of A-22763 (section 3; T-1974 in section 4). Re-triage A-22763, approved by the human on ask 0d31338f (2026-11-24 08:58Z).
