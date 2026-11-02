---
id: T-1589
kind: task
title: The fake ssh stand-in and fake hosts
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
created: 2026-11-02T03:33:52.717Z
updated: 2026-11-02T03:34:39.987Z
---

## Summary

A test-only Node stand-in for `ssh` and `scp`, selected by `CLAND_SSH_BIN` and `CLAND_SCP_BIN`, serves fake hosts that are directories on the same machine, each with its own `HOME`, run directory, boot-id file and host key. It honours the subset the carrier uses (a `ControlMaster` with `-N` and Unix-socket `-R`/`-L` forwards, `-O check|exit|forward|cancel` on the control path, a one-shot command with stdin, `-t`, and `scp` to the host) and refuses what the spec forbids.

Hot files: `hub/test/fakes/fake-ssh.ts` (new), `hub/test/fakes/fake-scp.ts` (new), `hub/test/fakes/fake-host.ts` (new: create, kill-master, gone), `hub/test/fake-ssh.test.ts` (new)

## Acceptance criteria

- [ ] C1. A master started with the spec's options holds its `-R` and `-L` Unix forwards until it exits, and its exit (including SIGKILL) closes every forward and leaves its control socket file behind, as a real master does (test).
- [ ] C2. The stand-in refuses a connection without `StrictHostKeyChecking=yes` and a `UserKnownHostsFile` holding the fake host's pinned key, and refuses `ExitOnForwardFailure=yes` forwards it cannot bind (test).
- [ ] C3. It refuses any TCP listen forward (`-L` or `-R` with a port on the listening side), while a Unix-socket listener forwarding to a host loopback port is allowed (test).
- [ ] C4. `-O forward` and `-O cancel` add and remove a forward on a live master, and `-O exit` ends it (test).
- [ ] C5. A one-shot command runs as a process of the fake host, with that host's `HOME`, reading the given stdin. `scp` writes the file into the fake host's tree (test).
- [ ] C6. `fake-host.ts kill-master <host>` SIGKILLs that host's live master and `gone <host>` makes later connections fail as an unreachable host would; nothing in the stand-in opens a network socket (test).

## Notes

Shared files: the fake-host control script (created here; 08 adds kill-agent, 27 adds reboot)
