---
id: T-1779
kind: task
title: Release at host stop, and the kept volume re-attached on the next host
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1774
  - T-1778
topic: null
branch: null
created: 2026-11-09T12:44:09.676Z
updated: 2026-11-09T12:44:15.599Z
---

## Summary

Before a host is deleted, the hub releases its logins in parallel: it ends every process using each disk, unmounts and detaches it, and returns the login to `ready` with the same volume. The next bind attaches that volume on another host, so a login rotated on host A is read at its newer generation on host B. A host found gone frees its logins once the provider reports their volumes detached.

## What to build

A release step in the confirmed destroy path shared by `cland host stop`, idle stop, `cland host destroy`, the 15-minute lost-host teardown and boot-failure cleanup. For each bound login, in parallel, before the provider's release:
1. `loginDisk umount`, whose helper first ends every writer on the disk;
2. `detachVolume`;
3. the binding removed, and the login `ready`.

When the hub cannot reach the agent (a lost host, or one reported gone), there is no unmount. The machine is deleted, and each of its logins reads `ready` only after `listVolumes` reports the volume detached. An unmount refused because writers remain keeps the host and its binding, and the Coordinator gets one Agents line.

## Acceptance criteria

- [ ] C1. `cland host stop` on a host with a bound login unmounts and detaches the volume before the machine's deletion is requested, and the login reads `ready` with the same volume id (test).
- [ ] C2. With the fake harness, a login rotated over two turns on host A is read at that generation by the first turn on host B after A stops, from the same volume id (test).
- [ ] C3. A host holding two logins releases them concurrently: both unmounts are in flight before either detach completes (test).
- [ ] C4. A background process left holding the disk is ended before the unmount, and no other process on the host is signalled (test).
- [ ] C5. A host lost for 15 minutes or reported gone is deleted without an unmount, and its logins read `ready` only after the provider reports their volumes detached (test).
- [ ] C6. An unmount refused because writers remain keeps the host and its login bound, and the Coordinator gets one Agents line naming the host and the login (test).

## Blocked by

- T-1774
- T-1778

## Notes

- Hot files: `hub/src/host/login-binding.ts` (release), `hub/src/host/provision-host.ts` (`destroyHost`: release before the provider's release), `hub/src/host/settle.ts`, `hub/src/host/host-health.ts` (the lost-host path).
- Tests: new `hub/test/login-release.test.ts` (T2, fake clock); new `hub/test/login-write-back.test.ts` (T3: two fake hosts and the fake harness, for C2 and C4).
- Serves epic C2.
