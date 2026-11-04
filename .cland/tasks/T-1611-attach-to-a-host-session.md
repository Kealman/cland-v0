---
id: T-1611
kind: task
title: Attach to a host session
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1603
  - T-1606
  - T-1607
topic: null
branch: null
created: 2026-11-02T03:33:58.041Z
updated: 2026-11-04T14:51:40.483Z
---

## Summary

`cland session attach` on a host session prints its own `ssh -t` connection with `ControlPath=none`, `ClearAllForwardings=yes`, `-a -x` and the host's pinned `known_hosts`, which runs `cland host attach <session>` on the host. That command reads the session's attach record from the agent (written at launch, 0600), sets the harness environment and execs the harness's attach under `stty susp undef`.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/cli/host.ts`, `hub/test/host-attach.test.ts` (new)

## Acceptance criteria

- [ ] C1. For a session on a fake host, `cland session attach <name>` prints an `ssh -t` command with `ControlPath=none`, `ClearAllForwardings=yes`, `-a`, `-x`, `StrictHostKeyChecking=yes` and the host's `known_hosts`, running `cland host attach <name>`, and no secret appears in it (test).
- [ ] C2. On the host, `cland host attach <name>` execs each harness's attach with the session's environment under `stty susp undef`, and refuses a session that is not on that host (test).
- [ ] C3. Ending the attach process leaves the session running with the same identity (test).
- [ ] C4. The attach of a local session is unchanged, and the session-cli test file passes with no test edited.

## Notes

Shared files: `hub/src/adapters/sessions.ts` (attachCommand), the three adapters' attach records, `hub/src/cli/host.ts` (`attach`)
