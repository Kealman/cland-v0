---
id: T-1589
kind: task
title: The fake ssh stand-in and fake hosts
state: open
status: in progress
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1327
branch: t/T-1589-the-fake-ssh-stand-in-and-fake-hosts
created: 2026-11-02T03:33:52.717Z
updated: 2026-11-02T05:58:01.598Z
---

## Summary

A test-only Node stand-in for `ssh` and `scp`, selected by `CLAND_SSH_BIN` and `CLAND_SCP_BIN`, serves fake hosts that are directories on the same machine, each with its own `HOME`, run directory, boot-id file and host key. It honours the subset the carrier uses (a `ControlMaster` with `-N` and Unix-socket `-R`/`-L` forwards, `-O check|exit|forward|cancel` on the control path, a one-shot command with stdin, `-t`, and `scp` to the host) and refuses what the spec forbids.

Hot files: `hub/test/fakes/fake-ssh.ts` (new), `hub/test/fakes/fake-scp.ts` (new), `hub/test/fakes/fake-host.ts` (new: create, kill-master, gone), `hub/test/fake-ssh.test.ts` (new)

## Acceptance criteria

- [x] C1. A master started with the spec's options holds its `-R` and `-L` Unix forwards until it exits, and its exit (including SIGKILL) closes every forward and leaves its control socket file behind, as a real master does (test).
  - done: impl-1589 · 2026-11-02T05:51:57.714Z
- [x] C2. The stand-in refuses a connection without `StrictHostKeyChecking=yes` and a `UserKnownHostsFile` holding the fake host's pinned key, and refuses `ExitOnForwardFailure=yes` forwards it cannot bind (test).
  - done: impl-1589 · 2026-11-02T05:52:00.692Z
- [x] C3. It refuses any TCP listen forward (`-L` or `-R` with a port on the listening side), while a Unix-socket listener forwarding to a host loopback port is allowed (test).
  - done: impl-1589 · 2026-11-02T05:52:03.936Z
- [x] C4. `-O forward` and `-O cancel` add and remove a forward on a live master, and `-O exit` ends it (test).
  - done: impl-1589 · 2026-11-02T05:52:06.852Z
- [x] C5. A one-shot command runs as a process of the fake host, with that host's `HOME`, reading the given stdin. `scp` writes the file into the fake host's tree (test).
  - done: impl-1589 · 2026-11-02T05:52:10.352Z
- [ ] C6. `fake-host.ts kill-master <host>` SIGKILLs that host's live master and `gone <host>` makes later connections fail as an unreachable host would; nothing in the stand-in opens a network socket (test).
  - failed: rev-35 [reviewer] · 2026-11-02T05:58:01.598Z · note kill-master follows an unverified stored control path and can terminate a different fake host's live master.

## Notes

Shared files: the fake-host control script (created here; 08 adds kill-agent, 27 adds reboot)

## Comments

### impl-1589 · 2026-11-02T05:44:15.928Z

Rule 20 inventory: new sshBinaries(env) in hub/src/host/ssh-binaries.ts returns {ssh, scp}; overrides only with nonempty CLAND_FAKE_HOSTS. New consumers: T-1595 real SSH carrier and T-1625 contract fixture (Coordinator notified); no existing selector/importers found (rg transport/CLAND_SSH_BIN/CLAND_SCP_BIN). Fake layout: CLAND_FAKE_HOSTS absolute directory, <id>/{home,boot-id,host-key.pub,client-key}; run at home/.cland-host/run. No wire/storage contract changed. Fake subprocess CLI is the agreed test seam. Loopback destination ports resolve through explicit fake host Unix-socket mappings; stand-ins never create TCP sockets.

### impl-1589 · 2026-11-02T05:46:11.460Z

Correction to earlier rule-20 layout note per Coordinator: CLAND_FAKE_HOSTS is comma-separated names; CLAND_FAKE_HOST_ROOT is absolute root. sshBinaries(env) honors overrides only with BOTH set. createFakeHost(root,name) returns directory/home/run/knownHosts/bootId/key. Stand-ins authenticate pinned key and listed name before operations. kill-master contacts the live Unix control endpoint to self-SIGKILL rather than trusting stored PIDs.

### impl-1589 · 2026-11-02T05:50:09.655Z

Expanded consumer inventory: existing executor/droplet/machine.ts directly honors CLAND_SSH_BIN/SCP_BIN; executor-contract.test.ts, executor-droplet.test.ts, executor-prepare.test.ts, remote-fixture.ts, fake digitalocean scripts, docs/executor-argv-audit.md consume that executor-specific seam. This predates the new Host carrier. Asked Coordinator whether its gate directive includes migrating executor behavior; holding that change pending decision.

### impl-1589 · 2026-11-02T05:50:42.501Z

Coordinator decision 7c473a2c: gate applies ONLY to new Host selector/carrier. Existing executor/droplet/machine.ts intentionally remains ungated for executor fixtures, with no executor consumer changed here. T-1626 owns its migration. README, skill and per-file guide explicitly distinguish the two.

### rev-35 · 2026-11-02T05:58:01.598Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1589-source-1
commit: 5942fece061d4d1aeb0e39d57c9035546e43bdff
scope: full
findings: [{"severity":"medium","text":"kill-master treats serialized master-control as authority without verifying the endpoint's host/boot identity. With two live fake hosts, copying B's control path into A's record makes kill-master A SIGKILL B. fake-ssh.ts also publishes this record before bind succeeds (75–76), so a failed launch can replace the live owner's record. Bind requests to the named live owner, publish only after readiness, and add fresh-owner plus copied/stale-record refusal controls.","file":"hub/test/fakes/fake-host.ts","line":51},{"severity":"medium","text":"The one-shot and SCP tests spawn children without a registered lifetime owner or cancellation cleanup and await unbounded close promises (22,40). A test timeout does not terminate those subprocesses; they can retain fixture writers/handles after cancellation. Register cleanup immediately on launch, stop/join the owned process tree with a bound before root removal, and exercise a held-command cancellation path.","file":"hub/test/fake-ssh.test.ts","line":18},{"severity":"low","text":"openStream asserts the full 'still live' value on the first data event. Unix sockets carry a byte stream and may split a write; accumulate until the expected byte length before the final equality assertion so valid partial chunks do not fail the control.","file":"hub/test/fake-ssh.test.ts","line":108}]
finding_counts: {"high":0,"medium":2,"low":1}

Not clear. Medium: fake-host.ts:51–52 accepts a copied/stale master-control path as termination authority; Control has no live host/boot identity check, and fake-ssh.ts:75 publishes that record before successful bind. Medium: fake-ssh.test.ts:18/38 one-shot/SCP children have no cancellation cleanup owner and unbounded close waits, allowing subprocesses to survive test timeout. Low: openStream:108 assumes one socket data event contains the entire write. Detailed standards/spec review and concrete two-host counterexample in A-15603 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15603-t-1589-source-review-at-5942fece0.md). C6 failed, C1–C5 unverified. Reverse-path unlink is allowed by explicit StreamLocalBindUnlink image policy, not a finding. Host-only binary gate matches Coordinator decision; executor excluded under T-1626. Reviewer ran no tests/browser; local reported six T3 passes/typecheck/lint are not queued verification. Fresh source review required after fixes and before verification.

Criteria: C6 failed (kill-master follows an unverified stored control path and can terminate a different fake host's live master.).
