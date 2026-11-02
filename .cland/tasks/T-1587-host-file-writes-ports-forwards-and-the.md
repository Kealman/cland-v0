---
id: T-1587
kind: task
title: Host file writes, ports, forwards and the launch layout on the local host
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:33:51.984Z
updated: 2026-11-02T03:34:39.246Z
---

## Summary

Add to the Host the members a remote launch needs: write a file with a mode, make a directory, remove a path, reserve a loopback port, forward a session's endpoint to the hub and cancel it, and a launch layout (the session run and log directories, the discovery file, node, the CLI and spoke entries). The `local` host implements each as today, with forwarding as the identity. `LaunchFiles` writes and undoes session-side files through its Host.

Hot files: `hub/src/host/host.ts`, `hub/src/host/local.ts`, `hub/src/host/test-host.ts`, `hub/test/host-contract.ts`, `hub/test/host-local-contract.test.ts`, `hub/src/adapters/launch-files.ts`

## Acceptance criteria

- [ ] C1. The `Host` interface gains writeFile (bytes and mode), makeDirectory, removePath, freePort, forward, unforward and a read-only `layout`, and the `local` and test hosts implement each; the test host refuses the writes and forwards by name.
- [ ] C2. The contract suite has a case per new member, and the `local` host passes it: a written file has its exact bytes and mode, removePath never follows a symlink out of the given path, and freePort returns a free loopback port (test).
- [ ] C3. On the `local` host forward returns the endpoint it was given (a Unix socket path or a loopback port) and unforward is a no-op, and its `layout` returns today's paths derived from the discovery file, node, CLI and spoke entries (test).
- [ ] C4. `LaunchFiles` creates, writes and rolls back session-side files and directories only through its Host, while its undo metadata stays a hub-local read, and a pending-stop record written before this change is still recovered (test).
- [ ] C5. `host-contract-coverage.test.ts` fails for a new member without a case, and the launch-files, session-launch and session-stop-races test files pass with no test edited.

## Notes

Shared files: the Host interface and its contract suite (sole owner in E-1532); `launch-files.ts`
