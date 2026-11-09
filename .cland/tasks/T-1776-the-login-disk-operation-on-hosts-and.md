---
id: T-1776
kind: task
title: The login-disk operation on hosts and the `cland-auth` helper
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
topic: null
branch: null
created: 2026-11-09T12:44:09.085Z
updated: 2026-11-09T12:44:28.910Z
---

## Summary

The host agent gains one operation, `login-disk` (mount, unmount, freeze or thaw). It runs the `cland-auth` helper through `sudo -n` with a volume name and a `/cland/auth/<harness>-<login>` path only, so the agent itself stays unprivileged. The helper unmounts any other mount of the device before mounting and ends every process using the disk before unmounting. On a fake host, a fake helper with the same argument rules maps the path onto the attached fake volume's contents.

## What to build

The path from the hub to a mounted login disk, on both kinds of host:
- **Agent side.** The agent checks the helper's own argument patterns before running anything, refuses otherwise, and replies with typed codes: `bad-argument`, `busy`, `writers-remain` and `wrong-volume`.
- **Host interface.** `loginDisk({ op, volume, path })` on the ssh Host; the local Host refuses it.
- **Helper.** On mount, the helper lists the device's other mount points and unmounts each before mounting at the target, which covers DigitalOcean's `/mnt/<name>` automount. Its existing writer drain runs before every unmount.
- **Fake helper.** Only under the fake-host marker, the fake helper maps `/cland/auth/<x>` to the same path under the fake host's directory. It links that path to the volume's contents through T-1772's seam, and only while the volume is attached to this machine. On unmount it ends the fake host's processes whose working directory or open files lie on the disk, then unlinks.

## Acceptance criteria

- [ ] C1. The agent refuses a `login-disk` request whose path lies outside `/cland/auth/` or contains a symlink or `..`, or whose volume name breaks the helper's pattern, without running sudo or the helper (test).
- [ ] C2. On a fake host, mount makes the attached volume's contents readable and writable at the mapped path, and is refused for a volume attached to another machine or detached (test).
- [ ] C3. On a fake host, unmount ends a background process holding a file on the disk before it unlinks, and ends no process outside that disk (test).
- [ ] C4. In the stub fixture, the helper unmounts another mount of the same device before mounting at the target (test).
- [ ] C5. The ssh Host's `loginDisk` runs `sudo -n /usr/local/sbin/cland-auth <op> <volume> <path>` with exactly those arguments, and the local Host refuses `loginDisk` (test).
- [ ] C6. The existing `cland-auth.test.ts` and `host-prelude.test.ts` cases pass with no case edited.

## Blocked by

- T-1772

## Notes

- Hot files: `hub/src/host/agent/server.ts` (the operation), `hub/src/host/agent/login-disk.ts` (new), `hub/src/host/cland-auth.sh`, `hub/src/host/host.ts`, `hub/src/host/ssh-host.ts`, `hub/src/host/local.ts`, `docs/agents/host-agent.md` (a new section).
- Tests: `hub/test/cland-auth.test.ts` (T3 stub fixture, new cases only); new `hub/test/host-login-disk.test.ts` (T3, a fake host's agent and the fake provider).
- Serves epic C2 and the Contents bullet on the helper.
