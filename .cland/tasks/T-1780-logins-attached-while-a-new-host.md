---
id: T-1780
kind: task
title: Logins attached while a new host provisions
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
topic: null
branch: null
created: 2026-11-09T12:44:09.916Z
updated: 2026-11-09T12:44:16.009Z
---

## Summary

When a host is created for a waiting launch, the hub picks a free login for the launch's harness and attaches its volume as soon as the provider reports the machine ready, while the hub is still connecting and cloning. It mounts the disk once the agent answers, before the host reads `ready`. A cold host's logins add no wait to its boot, and the launch placed on it finds its binding in place.

## What to build

A hook at the `connecting` checkpoint of the create path, which the pool runtime arms with the harnesses of the launches the host was created for. The choice of login is T-1778's (region and account). An attached login reads `in-use <host>`. A host that fails to boot releases its logins through T-1779's path.

## Acceptance criteria

- [ ] C1. A launch that starts a fake host gets its login attached before the host reads `ready`, and is then placed with no further attach (test).
- [ ] C2. On the hub clock, the host's time from create to `ready` is the same with and without the login bind (test).
- [ ] C3. A host that fails to boot after its login was attached leaves the login `ready` and detached, with the same volume (test).
- [ ] C4. Two launches of different harnesses that start one host get one login each attached during provisioning (test).

## Blocked by

- T-1779

## Notes

- Hot files: `hub/src/host/provision-host.ts` (the checkpoint hook), `hub/src/host/pool-runtime.ts` (passes the harnesses), `hub/src/host/login-binding.ts`.
- Tests: new `hub/test/login-provision-bind.test.ts` (T2, the injected create seam and fake clock).
- Serves epic C2. Its lane orders it after T-1779, because both edit `provision-host.ts`.
