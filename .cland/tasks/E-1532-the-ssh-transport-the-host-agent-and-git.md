---
id: E-1532
kind: epic
title: The SSH transport, the host agent and git through the tunnel
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1531
follows:
  - E-1531
topic: topic-1362
branch: null
created: 2026-10-31T18:22:03.352Z
updated: 2026-11-05T17:20:51.793Z
---

## Goal

A session can run on a remote Linux host and behave as a local one does. The hub keeps one SSH connection per host, the tunnel, with its own reconnect loop, and forwards four Unix sockets over it: the hub's socket, a new spoke edge on a Unix socket, a per-host git socket and the host agent's socket. On the host, the host agent `cland host serve` spawns the harnesses detached, keeps the process table, reads files for artifacts, adds worktrees from a clone of the territory, and pushes every commit back through `git daemon`. Sessions survive a hub restart, a tunnel loss and a host-agent restart. `cland session attach` reaches a host session over `ssh -t`. The epic builds the `ssh` Host of "The Host interface and the local host" against a fake transport in the suite: hosts are local processes with their own directories and sockets. A real machine comes with "Host providers, images and DigitalOcean". The host prototype ran this whole path on a real droplet (Q-1517).

## Contents

- **The transport layer and the `ssh` carrier** (spec §3.2). A transport carries the hub's traffic to a host agent, separate from the provider that made the machine. The `ssh` carrier is one hub-owned `ControlMaster` per host with `-N`, `-a -x`, `-F /dev/null`, `BatchMode=yes`, `IdentitiesOnly=yes`, `ExitOnForwardFailure=yes` and `ServerAlive` 15×4, pinned host keys with `StrictHostKeyChecking=yes` against a per-lease `known_hosts`, and the hub's own reconnect loop: backoff from 1 s to 30 s with jitter, reset after 30 s up, a retry on wake, `-O exit` and stale-control-socket removal before each start, and an end-to-end probe through `agent.sock` every 30 s. Demo: a fake transport host's master killed with SIGKILL is back with its forwards, and the probe reports liveness.
- **The forwards and the sockets** (§3.2). Host-side sockets in the agent-owned `~/.cland-host/run` at 0700: `-R hub.sock`, `-R spoke.sock`, `-R git.sock`, `-L agent.sock`; per-session `-O forward -L` for a Codex app-server socket or an OpenCode port, re-added from the process table after a reconnect with a short retry. No TCP forward. Demo: after a reconnect every per-session forward is back.
- **The spoke edge on a Unix socket and the remote `hub.json`** (§3.2). The hub listens for spokes on `.cland/run/spoke.sock` beside its loopback port. A host's `hub.json` is a remote kind with `ws+unix:` and a per-host secret the hub can revoke; the CLI and doctor never pid-check it; a host spoke carries its launch credential and needs a role. Demo: a spoke on a fake host connects through `spoke.sock`, and a revoked host secret is refused.
- **The host agent** (§3.2). `cland host serve`, Node built-ins only: JSON-lines operations on `agent.sock` for every Host operation, detached spawns in their own session and process group, a process table with Linux birth identities, RSS and CPU per tree, file reads for artifacts, commands, worktree add and remove. Its protocol: request `{id, op, args}`, reply `{id, ok, result}` or an error, events (`process-exited`, `ref-moved`, `memory`), a hello with the per-host secret and the agent's version, and on a version mismatch the hub delivers its code and restarts the agent (assumed in the spec). A `setsid nohup` supervisor restarts it within about 2 s; no systemd dependency. Demo: a killed host agent is restarted and its sessions are untouched.
- **Remote spawn in the adapters** (§3.1, §3.2). Claude Code, Codex and OpenCode launch on a host through its agent: the Claude worker found once with `claude agents --json`, its hooks and mod bridge through `hub.sock`; Codex's app-server and OpenCode's server reached through per-session forwards; Codex sandbox roots from the host's realpath. Demo: a session of each harness on a fake host receives a delivery and reports its state.
- **Survival and reconnect** (§3.2). After a hub restart the hub re-establishes each tunnel, re-reads the host agent's table and re-finds its rows; spokes reconnect by re-reading the host's `hub.json`. A rebooted host makes its sessions exited and vacates their roles. Demo: a 20 s hub stop with sessions on two fake hosts; rows re-found, spokes back, injects resume.
- **Attach** (§3.2). `cland session attach` on a host session opens its own `ssh -t` with `ControlPath=none` and `ClearAllForwardings=yes` and runs `cland host attach <session>`, which sets the harness environment and runs the attach under `stty susp undef`. Demo: on a fake host the attach command line and environment are as specified, and closing it leaves the session running.
- **Git through the tunnel** (§3.3). `git daemon --inetd` spawned by the hub per connection on a per-host socket at 0600, with half-open sockets on both ends; an explicit environment without `CLAND_TERRITORY_WRITE`, with `CLAND_PUSH_HOST=<host>` and the `receive.*` settings through `GIT_CONFIG_COUNT`; the territory's `update` hook with a per-host allow list of leased task branches, revoked under the territory lock before a merge reads the branch. The host's clone uses `core.gitProxy` on `git.sock`; the first clone goes through the daemon, a bundle over `scp` is the fallback. Demo: a fake host clones, fetches and pushes its task branch; a push to `dev`, to another host's branch, or a deletion is refused.
- **Push on every ref move** (§3.3). The host agent watches the task branch's ref and reflog, debounced, and pushes; `cland verify` and `ready` from a host session flush first, and the hub compares the territory head with the reported head. The Implementer's and Lead's clauses say that commits are pushed for the session, within the clauses' byte reserve. Demo: a commit on a fake host reaches the territory within seconds, and `ready` waits for the flush.
- **A task stays on its host** (§3.3). A relaunch on the same host while it lives; otherwise a fetch of the pushed branch and a new worktree elsewhere. Demo: a relaunch after the fake host is gone recreates the worktree on another fake host from the pushed branch.
- **The slim Linux spoke** (§3.4). The spoke's resident size on Linux reduced from 105 to 125 MB toward its macOS size, measured on a Linux droplet run. Demo: the measured RSS before and after, in the task's evidence.
- **The fake transport** (§3.13). Hosts as processes on the same machine, each with its own home, sockets and a fake sshd stand-in, run by the same transport code paths where possible. Demo: the contract suite of the Host interface passes on a fake host.
- **The ADR 0003 and 0004 amendments** (§3.12). 0003: the spoke edge on a Unix socket and the per-host git socket, reached only over the hub's own SSH connection; nothing new binds a network address. 0004: the territory served to hosts through per-host sockets, pushes limited to leased task branches, item branches created in the territory.

Not in this epic: creating real machines, images and the host prelude ("Host providers, images and DigitalOcean"); pools, placement, leases and failures ("Pools, placement and the scheduler"); logins and harness homes on hosts ("Logins").

## Order

1. **The tunnel on a fake host.** The transport layer, the master, the forwards, the reconnect loop and the probe. Demo: a SIGKILLed master is back with its forwards.
2. **The host agent and one OpenCode session.** The agent, its supervisor and protocol, the spoke edge on a Unix socket and the remote `hub.json`, one OpenCode session end to end. Demo: an OpenCode session on a fake host answers a delivery.
3. **Git through the tunnel.** The daemon, its environment and the allow list, the clone, push on ref move and the flush. Demo: a commit on the fake host reaches the territory, and forbidden pushes are refused.
4. **Claude Code and Codex on a host, attach.** Remote spawn paths, per-session forwards, sandbox roots, attach. Demo: one session of each harness on a fake host.
5. **Survival.** Hub restart, tunnel loss, agent restart, host reboot, relaunch elsewhere. Demo: the 20 s hub stop above.
6. **The slim spoke and the ADR amendments.** Demo: the RSS evidence; both amendments on `dev`.

## Definition of done

QA runs the demo below on `dev` through the hub's frame protocol and the `cland` CLI, with two fake hosts on the fake transport in the suite, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real provider, droplet or key is involved.

In a scratch project QA starts two fake hosts and launches an OpenCode, a Codex and a Claude Code session on them, one an item session. It sends each a delivery and reads its state, commits on the item session's host and reads the branch in the territory, and tries a push to `dev`, a push to the other host's branch and a branch deletion through that host's git socket. It runs `ready` from the host session and reads the flush. It kills a host's SSH master, then its host agent, then stops the hub for 20 seconds, and after each reads that every session survived and its forwards are back. It revokes a host secret and reads the spoke's refusal. It reads the attach command for a host session. It "reboots" a fake host and reads its sessions as exited and their roles vacated. It reads the slim spoke's evidence and both ADR amendments.

- [ ] C1. Each remote host has one hub-owned SSH master with the specified options, pinned host keys and the hub's own reconnect loop, and a killed master comes back with every forward.
- [ ] C2. Every host-side endpoint is a Unix socket in the agent-owned run directory, and no TCP forward exists.
- [ ] C3. Spokes on hosts connect through the hub's Unix-socket spoke edge with a per-host secret in a remote `hub.json`, and a revoked secret is refused.
- [ ] C4. The host agent runs every Host operation over `agent.sock`, is restarted by its supervisor within seconds, and sessions survive its restart.
- [ ] C5. Sessions of all three harnesses run on a host, and survive a hub restart and a tunnel loss with their rows re-found.
- [ ] C6. A host clones, fetches and pushes only through `git daemon --inetd` on its own socket, and a push to `dev`, to another host's branch or a deletion is refused.
- [ ] C7. A commit on a host reaches the territory without the session pushing, and `verify` and `ready` flush first.
- [ ] C8. `cland session attach` on a host session opens its own `ssh -t` running `cland host attach` with `stty susp undef`.
- [ ] C9. A rebooted host makes its sessions exited and vacates their roles, and a relaunch elsewhere recreates the worktree from the pushed branch.
- [ ] C10. ADR 0003 and ADR 0004 carry the amendments of spec §3.12.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch in its worktree, push it to `origin`, and reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items are written through `cland task`, never by hand.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig, no enums, namespaces or parameter properties. No new runtime dependency: the host agent uses Node built-ins only.
- **Tests.** Test first (`tdd`) on the fake transport. No test opens SSH to a real machine or creates a real droplet; the suite runs on droplets as it is. A real `ssh` binary against a local sshd is allowed only where the fake cannot stand in, and never leaves the machine.
- **Secrets.** The project secret never goes to a host; a host gets only its per-host secret. A secret never appears in argv, a frame, a log line or an artifact. `DIGITALOCEAN_TOKEN` and the remotes' tokens stay on the sessions' deny-list on every host.
- **The territory guard.** The daemon's environment never carries `CLAND_TERRITORY_WRITE`; `dev` and `main` move only through the hub.
- **No systemd dependency.** The host agent and harnesses must work with no init system beyond the supervisor loop.
- **ADRs.** 0003 and 0004, amended by this epic; 0001: a host spoke still needs a role.
- **The prototype.** `prototype/agent-host` at 7f7ecb0f is never merged; read `hub/src/host/agent.ts`, `supervisor.sh`, `git-proxy.ts`, `hosts.ts` and `cli.ts`, take what fits, follow the spec.
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Second in the hub lane, after "The Host interface and the local host". "Host providers, images and DigitalOcean" follows it.

## References

- Spec: `docs/spec/v0.4.md` §3.2 (the transport, the tunnel and the host agent), §3.3 (git through the tunnel), §3.4 (the slim spoke), §3.12 (the ADR amendments), §3.13 and §4.
- Items: R-1530; the map M-1511, round 1 decisions 3, 4 and 10, round 2 decisions 2 and 3, round 3 decision 3; Q-1515; Q-1517 (decisions 1 to 7, 12, 13, 16 and the attach finding); Q-1519 §8 and §9.
- Research: `docs/research/host-transport.md` on `research/host-transport` (9aac93c0), sections 10 (rules) and 11 (not found). Where it says `/run/user/<uid>` and systemd user units, the prototype's decisions 1 and 2 replace it.
- Prototype, on `prototype/agent-host` at 7f7ecb0f: `hub/src/host/README.md` (survival table, Linux facts, decisions), `agent.ts`, `supervisor.sh`, `git-proxy.ts`, `hosts.ts`, `cli.ts`; the spoke edge and `spokeSocket` changes marked `PROTOTYPE (Q-1517)`.
- Code: `hub/src/spoke/spoke.ts`, `hub/src/hub/socket.ts`, `hub/src/hub/daemon.ts`, `hub/src/project.ts`, `shared/project-discovery.ts`, `hub/src/territory.ts`, `hub/src/adapters/{claude-code,codex,opencode}.ts`, `hub/src/executor/droplet/machine.ts` (the existing SSH use); `docs/adr/0003-*.md`, `docs/adr/0004-*.md`.
- GLOSSARY: Host, Host agent, Tunnel (added for v0.4); Spoke, Territory, Task branch.

## Plan

```yaml
stages:
  - name: foundations
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1587
      - - T-1588
      - - T-1589
      - - T-1590
      - - T-1591
      - - T-1592
  - name: the tunnel
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1593
        - T-1594
        - T-1595
      - - T-1596
      - - T-1597
      - - T-1601
  - name: the ssh Host and the remote spoke
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1598
        - T-1599
        - T-1600
      - - T-1602
      - - T-1657
  - name: harnesses and git on hosts
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1603
      - - T-1606
      - - T-1607
      - - T-1604
        - T-1605
      - - T-1608
      - - T-1644
      - - T-1674
  - name: push, attach and survival
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1609
        - T-1610
      - - T-1611
      - - T-1612
        - T-1613
      - - T-1666
      - - T-1678
      - - T-1673
        - T-1683
      - - T-1684
      - - T-1685
      - - T-1686
      - - T-1687
      - - T-1690
      - - T-1691
      - - T-1692
  - name: relaunch elsewhere
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-1614
```

## Comments

### qa-678 · 2026-11-03T07:19:31.802Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-tunnel2-2026-11-03-qa678-1
commit: 722f1ce57917ac800aa365088f3050776b60490c
stage: the tunnel
stage_hash: 5d02a60496d93983864d0d18a7770b8b2252c66bd529f745f9a87abde28c8e15
findings: [{"severity":"medium","text":"Found aside: T-1659 (S, Bugs), 18 test-owned agents survived six passing supervisor test invocations. Coordinator 771c7fda classified this fixture cleanup defect as separate from the scoped stage. PID/birth/argv/cwd evidence and identity-checked drain are in A-16202; all 18 now gone.","file":"hub/test/host-supervisor.test.ts","line":65}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| S0 | hub-api · local macOS | PASS | [S0-runtime.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/S0-runtime.txt), [S0-env.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/S0-env.txt), [S0-hook.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/S0-hook.txt), [S0-probe.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/S0-probe.txt), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrections.md) |
| E1532S2-00 | hub-api · local macOS | PASS | [E1532S2-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-00.txt), [E1532S2-00-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-00-plan.json), [T-1595-landing.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/T-1595-landing.txt), [T-1653-landing.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/T-1653-landing.txt), [T-1654-landing.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/T-1654-landing.txt) |
| E1532S2-01 | hub-api · local macOS | PASS | [E1532S2-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-01.txt) |
| E1532S2-02 | hub-api · local macOS | PASS | [E1532S2-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-02.txt), [E1532S2-02-typecheck.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-02-typecheck.log) |
| E1532S2-03 | hub-api · local macOS | PASS | [E1532S2-03.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-03.log), [required-tests.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/required-tests.json) |
| E1532S2-04 | hub-api · local macOS | PASS | [E1532S2-04.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-04.log), [assertion-source.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/assertion-source.txt), [timing-diagnostic.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/timing-diagnostic.txt), [timing-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/timing-queue.json) |
| E1532S2-05 | hub-api · local macOS | PASS | [E1532S2-05.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-05.log), [E1532S2-05.root](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-05.root), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrections.md) |
| E1532S2-06 | hub-api · local macOS | PASS | [E1532S2-06.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-06.log), [assertion-source.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/assertion-source.txt), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/generated-required.json) |
| E1532S2-07 | hub-api · local macOS | PASS | [E1532S2-07.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-07.log), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/generated-required.json), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrections.md) |
| E1532S2-08 | hub-api · local macOS | PASS | [E1532S2-08.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-08.log), [assertion-source.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/assertion-source.txt), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/generated-required.json) |
| E1532S2-09 | hub-api · local macOS | PASS | [E1532S2-09.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-09.log), [E1532S2-09-label-note.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-09-label-note.txt) |
| E1532S2-10 | hub-api · local macOS | PASS | [E1532S2-10.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-10.log), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/generated-required.json) |
| E1532S2-11 | hub-api · local macOS | PASS | [E1532S2-11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-11.txt), [E1532S2-11-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-11-init.txt), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrections.md) |
| E1532S2-12 | hub-api · local macOS | PASS | [E1532S2-12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-12.txt), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrections.md), [corrected-functions.sh](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrected-functions.sh) |
| E1532S2-13 | hub-api · local macOS | PASS | [E1532S2-13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-13.txt) |
| E1532S2-14 | hub-api · local macOS | PASS | [E1532S2-14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-14.txt) |
| E1532S2-15 | hub-api · local macOS | PASS | [E1532S2-15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-15.txt), [E1532S2-15-original.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-15-original.txt), [E1532S2-15-supervisor-original.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-15-supervisor-original.txt), [E1532S2-15-process-inspection.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-15-process-inspection.txt) |
| E1532S2-16 | hub-api · local macOS | PASS | [E1532S2-16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-16.txt) |
| E1532S2-17 | hub-api · local macOS | PASS | [E1532S2-17.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-17.txt), [supervisor-test-orphans.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/supervisor-test-orphans.txt), [supervisor-test-orphans-cleanup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/supervisor-test-orphans-cleanup.txt) |
| E1532S2-18 | hub-api · local macOS | PASS | [E1532S2-18.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-18.txt), [E1532S2-18-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-18-correction.txt) |

Clear: all 20 scoped cases pass (S0 and E1532S2-00–18). No in-scope product findings. Found aside: T-1659 test-fixture cleanup defect (medium severity, S, Bugs), detailed below.

Stage **the tunnel**, build `722f1ce57917ac800aa365088f3050776b60490c`, run `qa-tunnel2-2026-11-03-qa678-1`. Brief `qa/briefs/E-1532-stage-2.md` at that build. Fresh detached worktree, HEAD and dev matched before and after. All six members and fixes T-1653/T-1654 have landings; source and preserved-file checks passed. No epic criterion marks.

Local macOS arm64, Node v24.21.0; no browser or real SSH binary was used. All transport traffic used fake stand-ins; scratch records have no production carrier at this stage. Local cost and droplet lifetime are not applicable. The workspace typecheck passed. 713 passing test executions across 64 file executions (49 distinct files); counts include the brief repetitions. The contention pattern ran only its named identity five times; filtered cases are unexecuted, not passes. Required literal and 33 generated names were checked against source and TAP facts. See [test summary](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/test-summary.json), [required names](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/required-tests.json), [generated names](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/generated-required.json) and [assertion source](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/assertion-source.txt).

Targeted execution only: 9 T1, 25 T2 and 30 T3 file invocations, not complete tiers. No full suites, T0, T4/soak, browser/Web or remote-host execution in this QA pass. Quiet admission and load <=10 enforced before named files; timing-sensitive cases retain queue and CPU-idle samples. T-1655 per-test budget enforcement is out of scope; Node test durations are not evidence of meeting that budget. Supervisor restart timing measures kill to first answering hello, excluding prep/admission. No overall wall-time claim.

- E1532S2-03: 58 tests across 8 file invocations.
- E1532S2-04: 24 tests across 5 file invocations.
- E1532S2-05: 58 tests across 10 file invocations.
- E1532S2-06: 32 tests across 8 file invocations.
- E1532S2-07: 179 tests across 7 file invocations.
- E1532S2-08: 177 tests across 8 file invocations.
- E1532S2-09: 5 tests across 5 file invocations.
- E1532S2-10: 180 tests across 13 file invocations.

The long-root case used a 61-byte temp root, passed all three supervisor identities on five repetitions, reported no EINVAL and left zero entries. The scratch push checks exercise the shipped hook with synthetic host identity; the daemon settings/receive lock/cap are evidenced by the named files, not those local pushes.

Coordinator-authorised run-copy corrections: shared environment sealing in svstart, hubstart, hpush and ntl (5db69e0d); m12 moves the existing second commit earlier and asserts a real ref move before each refusal (905aef97). Expected results are unchanged. Exported prose/test names have only the two explicitly authorised presentation redactions (cedb288f); exact execution copies and original captures remain private. See [corrections](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrections.md), [original brief](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/brief-original.md), [corrected functions](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/corrected-functions.sh), [sealed launcher](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/launch.mjs) and [shared environment composition](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/seal.mjs). No product source was changed.

Fifth brief correction (macOS fake-host precondition), coord-authorised d8b3262c: m15 originally BLOCKED at first hello because native.ts:9 requires CLAND_FAKE_HOSTS and CLAND_HOST_BOOT_ID_FILE on macOS. Kept original BLOCKED receipt/capture/log; final PASS receipt uses the authorised sealed fake-host overlay, existing secret and run directory. Restart measured 1166 ms. The table shows effective results; receipts.jsonl preserves the earlier BLOCKED attempt. This does not establish support for real macOS hosts.

Sixth brief correction (root census precondition), coord-authorised 846bd2c7: original root non-tracker count 0 became 1 under sealed Git. Excluding only pre-existing harness-local .claude/settings.local.json restores 0. Its Oct12 mtime predates this run; contents were not read or changed. The candidate remained clean and HEAD/dev matched. See E1532S2-18 and its correction capture.

Row09 helper labels repeat run1 because ld overwrites ntc’s shell i. Five complete TAP segments each contain exactly one required passing identity and exit0. Original labels are retained; no test rerun or altered assertion. See [label note](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/E1532S2-09-label-note.txt).

The plan records the external Coordinator-owned cover pair at tree `3430949b85b69fc0dbaf5d258d2dce431acde577`: Linux droplet `34e1ffe9-a3f5-416e-ab3a-29f914668623`, macOS local `4d7cdfe8-16c5-4a25-a578-0eef1dae71bc`, missing platforms `[]`. These were not launched or timed here; remote lifetime/cost not collected by this QA session.

Found aside — **T-1659 (medium; S, Bugs)**: 18 test-owned cland host serve processes remained after six supervisor test invocations (rows04/05). Actual ps/lsof captures establish PIDs, births and cwd; TAP passes and directory leftovers=0 did not establish process cleanup. Source attribution to host-supervisor.test.ts cleanup and process-cleanup.ts seed selection is an inference, not an instrumented parent trace. Coordinator decision 771c7fda classifies this as a separate fixture follow-up, not a stage blocker. All 18 were rechecked against recorded PID/birth/argv/cwd, SIGTERM’d individually and observed gone. Row17’s Q census was taken **before** that separate drain and was zero. See [orphan evidence](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/supervisor-test-orphans.txt) and [drain](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/supervisor-test-orphans-cleanup.txt).

Fixture secret scan, publication scan, process cleanup and final pinned-build checks are retained. Export contains declared captures and helper text only, no HOME, environment exports, secret store, raw database, key, cookie or one-use link. See [final checks](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/final-checks.txt).


Evidence: A-16202, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16202-e-1532-the-tunnel-qa-at-722f1ce5/report.md.

### qa-678 · 2026-11-03T22:00:56.718Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-s3-2026-11-03-qa678-1
commit: 8c9f569cf77719706bd02fb43b829b55c66b77f1
stage: the ssh Host and the remote spoke
stage_hash: cd09d1d17cc53901c6af6f34d1a27cb3d025073f1a63d1369d6732c6fa4f4f87
findings: [{"severity":"medium","text":"S3-07 found aside: T-1659 (S, Bugs), three test-owned agents survived the passing supervisor file. Identity-checked PID/birth/argv/cwd evidence and SIGTERM drain are in A-16347; all three and all manual fixture processes are now gone. Known test-fixture cleanup issue, separate from the requested stage behavior.","file":"hub/test/host-supervisor.test.ts","line":65}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Surface | Result | Command / observation | Evidence |
| --- | --- | --- | --- | --- |
| S0 | hub-api | PASS | Sealed setup, supported Node and pinned Neovim | [S0-env.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S0-env.txt), [brief-digests.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/brief-digests.txt) |
| E1532S3-00 | hub-api | PASS | Build, stage eligibility and landed files | [E1532S3-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-00.txt), [E1532S3-00-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-00-plan.json), [T-1600-landing.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/T-1600-landing.txt), [T-1600-fixture-landing.diff](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/T-1600-fixture-landing.diff) |
| E1532S3-01 | hub-api | PASS | Source invariants; approved quoting correction | [E1532S3-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-01.txt), [S3-01-grep-trace.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-01-grep-trace.txt), [S3-01-quoting-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-01-quoting-correction.txt), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/corrections.md) |
| E1532S3-02 | hub-api | PASS | Workspace typecheck | [E1532S3-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-02.txt), [E1532S3-02-typecheck.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-02-typecheck.log) |
| E1532S3-03 | hub-api | PASS | Transport forwards and contracts: 15 tests / 5 files | [E1532S3-03.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-03.txt), [E1532S3-03.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-03.log), [E1532S3-03-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-03-validation.json) |
| E1532S3-04 | hub-api | PASS | SSH Host and prepared operations: 58 tests / 6 files | [E1532S3-04.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-04.txt), [E1532S3-04.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-04.log), [E1532S3-04-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-04-validation.json) |
| E1532S3-05 | hub-api | PASS | Agent, local Host and adapters: 147 tests / 13 files | [E1532S3-05.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-05.txt), [E1532S3-05.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-05.log), [E1532S3-05-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-05-validation.json) |
| E1532S3-06 | hub-api | PASS | Remote discovery, CLI, spoke and admission: 71 tests / 10 files | [E1532S3-06.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-06.txt), [E1532S3-06.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-06.log), [E1532S3-06-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-06-validation.json), [tap-validator-note.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/tap-validator-note.md), [presentation-omissions.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/presentation-omissions.json) |
| E1532S3-07 | hub-api | PASS | Host records, fake SSH, sockets, supervisor: 26 tests / 4 files | [E1532S3-07.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-07.txt), [E1532S3-07.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-07.log), [E1532S3-07-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-07-validation.json), [agents-after-initial-files.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-after-initial-files.json), [agents-drain.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-drain.txt), [agents-after-drain.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-after-drain.json) |
| E1532S3-08 | hub-api | PASS | ADR links and amendments: 4 tests / 1 file | [E1532S3-08.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-08.txt), [E1532S3-08.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-08.log), [E1532S3-08-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-08-validation.json) |
| E1532S3-09 | hub-api | PASS | Three serial repeat groups: 105 tests / 8 file invocations | [E1532S3-09.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-09.txt), [E1532S3-09.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-09.log), [E1532S3-09-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-09-validation.json) |
| E1532S3-10 | hub-api | PASS | Two fake hosts, private discovery and differing-file refusal; corrected census | [E1532S3-10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-10.txt), [S3-10-process-baseline.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-10-process-baseline.txt), [S3-10-census-correction.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-10-census-correction.json) |
| E1532S3-11 | hub-api | PASS | Forwarded admission and host-side CLI; corrected doctor setup | [E1532S3-11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-11.txt), [S3-11-doctor-environment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-11-doctor-environment.json), [S3-11-doctor-corrected.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-11-doctor-corrected.txt) |
| E1532S3-12 | hub-api | PASS | Cleanup-incomplete reason rendering only | [E1532S3-12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-12.txt) |
| E1532S3-13 | hub-api | PASS | Hub restart preserves discovery bytes, mtime and inode | [E1532S3-13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-13.txt) |
| E1532S3-14 | hub-api | PASS | Revoked host refused; other host still admitted | [E1532S3-14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-14.txt) |
| E1532S3-15 | hub-api | PASS | Known-secret and publication scans with positive controls | [E1532S3-15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-15.txt) |
| E1532S3-16 | hub-api | PASS | Identity-checked cleanup, zero owned processes, alias removed | [E1532S3-16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-16.txt), [manual-cleanup-precondition.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/manual-cleanup-precondition.txt), [agents-final.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-final.json) |
| E1532S3-17 | hub-api | PASS | Final SHA/cleanliness; authorised runtime-residue cleanup | [E1532S3-17.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/E1532S3-17.txt), [S3-17-leftovers.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-17-leftovers.json), [S3-17-corrected.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/S3-17-corrected.txt) |

QA clear for **E-1532 stage `the ssh Host and the remote spoke`**, tested commit **8c9f569cf77719706bd02fb43b829b55c66b77f1**, run **qa-s3-2026-11-03-qa678-1**. All 19 setup/case rows pass, including the labelled corrections below. This is a stage verdict; no epic criterion marks are written.

Medium finding, found aside — **T-1659 (S, Bugs)**: after `node --test hub/test/host-supervisor.test.ts` passed in row07, three test-owned agents remained (PIDs 24054, 25038, 25221). Baseline before host files and after contract files was zero. The ownership census retained PID, birth, argv and cwd; identity-checked SIGTERM drained all three. This is the known test-fixture cleanup defect, separate from the shipped-supervisor behavior under the stage request. See [original census](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-after-initial-files.json), [drain](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-drain.txt), [post-drain census](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-after-drain.json) and [final census](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/agents-final.json). Source context: hub/test/host-supervisor.test.ts:65. No scoped product failure remains.

Execution was local on macOS 27.0.1 arm64, Node 24.21.0, pinned Neovim 0.12.5 (version precondition only); browser binary: none. Whole-workspace typecheck passed. The named files ran serially: **321 tests in 39 distinct initial files**, then **105 tests in eight repeat invocations**, totaling **426 executed tests across 47 file invocations**. These counts come from TAP summaries, not drafting-time title counts. Required literal and generated names, including nested shared Host cases, were compared with the final build and checked against passing TAP points; validators also required zero failures, cancellations, skips and todos. The exact per-row names and facts are in the validation JSON files and required-test-names.json, subject only to the three labelled presentation omissions. Helpers were exercised through their entry files, never counted as standalone tests. The tests used fresh executions, not cached results.

No full suite, T4 soak, real SSH, real host/provider/droplet, browser, GUI, or real harness session was run by this QA pass. Local executor lifetime/cost is not applicable. The Coordinator's existing stage covers are separate evidence: tree 80cb301d08971d7a7641b0993140f8f2beb58acb, Linux c3650e0a-038d-46e6-9baa-af4d45e7eee3 (A-16339), macOS df0411ac-e585-42d3-b5bb-d3df93bb064e (A-16337). The hub reports both covers present. Their durations/costs are not measurements from this run.

Cover-quiet and one-minute load <=10 admission were enforced before the targeted work; load and free-space observations are retained. The short CPU sample is diagnostic only. Injected 10 ms schedules in timing-sensitive tests are not production latency measurements; no wall-time or performance criterion is claimed.

The scratch hub used fake SSH and two directory-backed fake hosts with real local Unix sockets. The previously inferred CLI-started fake-host route succeeded: f1 became up, while f2 retained its planted private discovery file and reported `host discovery differs; atomic replacement required`. QA started the shipped supervisors using the brief's sealed off-Linux boot-id setup; this does not prove real remote bootstrap. Discovery mode 600, canonical contents and secret separation passed. Restart preserved digest, mtime and inode. A per-host revocation refused both forwarded interfaces while f2 remained admitted. Row12 only renders a substituted cleanup-incomplete reason in a live status reply; the named row06 test proves that state. Remote OpenCode atomic preparation remains an intentional refusal (T-1644); no real host harness launch is claimed.

Corrections, all retained separately from product observations:

1. **Brief probe-quoting correction**, coord 9623c387: two shell searches were corrupted by brace expansion. The original output and trace stay unchanged. Read-only Node exact-string checks each found one match: hub/src/host/command-environment.ts:7 and hub/src/cli/hub.ts:81. No test reran.
2. **Presentation-only title omissions**, coord 71407a93 and 0b08771b: three English test titles triggered the unchanged publication scanner. Exact originals and validation remain private. Exported plan has 2 occurrences omitted, row06 TAP has 6, row06 validation has 5. See presentation-omissions.json. Execution and assertions are unchanged; T-1665 tracks the scanner/title follow-up.
3. **Supplemental TAP-parser correction**, coord 0b08771b: decode Node TAP's escaped hash in a test name before exact-name comparison. The initial parser misread is documented in tap-validator-note.md; original TAP was unchanged and nothing reran.
4. **Brief supervisor-census correction**, coord 5bcb050f: original row10 count was 2 because the fake-ssh master's forward argv also contains the run directory. The read-only exact supervisor.sh/run-argument check found one supervisor, PID82383, equal to starter and lock. Full argv and original count are retained.
5. **Brief hostcli setup correction**, coord bddc5cb6: first row11 doctor lacked the three fake binary overrides and reached installed version/auth probes. It resolved `/Users/evgeniyivanov/.opencode/bin/opencode`; HOME, config/state/cache and account paths were sealed to scratch. Doctor's explicit OpenCode database was in scratch; accountEnvironment removes XDG_DATA_HOME when that explicit database is set, retaining scratch HOME. This is proven from the unchanged launcher/environment and source, with the original doctor's scratch database observation; it is not a retrospective OS file-access trace. There is no evidence of human account-store access. Only doctor was repeated after adding the three overrides through seal; the corrected capture resolves all fake binaries. The original failed OpenCode auth-list probe and its residue are disclosed, not described as fake-only execution. No login or harness session was started.
6. **Brief final-census precondition correction**, coord 871e26dd: original row17 found Node's compile cache plus an empty opencode directory and Bun extraction from the first doctor. Zero runtime residue was too strict for the compile cache. Names, sizes and mtimes were retained, only those three literal owned paths were removed, and read-only s17 then showed zero leftovers. Other row17 assertions remained exact.

Full correction details and launcher versions are in [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/corrections.md). T-1600's extra landing delta in ssh-host-fixture.ts is allowed by the brief: startTransport defaults true, while discoveryFixture passes false for its own configured transport. See T-1600-fixture-landing.diff. No product source, expected behavior or test assertion was changed by QA.

Final cleanup: scratch hub stopped; four manually started supervisor/agent identities checked against PID, birth, argv and cwd before termination; all gone. Scratch/alias process census is zero, alias removed, test-owned agents zero. Machine-wide external socket directories were counted (865) and not removed. The tested worktree stayed clean at the requested SHA, root non-tracker count stayed zero (the brief's pre-existing .claude/settings.local.json exclusion applies), and owned TMPDIR is empty after the authorised residue cleanup. Scratch directories and detached worktree are removed after publication/verdict.

Secret scans detected their planted positive controls before checking output. All three known secrets were absent outside declared holders across 757 files; the publication scanner refused only its positive control. Final export scanning is recorded separately. The evidence folder contains only declared reports, captures, validations and helper source; no HOME, environment export, auth store or secret file is published.


Evidence: A-16347, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16347-e-1532-stage-3-qa-at-8c9f569c/report.md.

### qa-678 · 2026-11-04T14:51:39.037Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-s4-2026-11-04-qa678-1
commit: eb1fe370f93f193b8d96b1b0e97d5d346a3f6b78
stage: harnesses and git on hosts
stage_hash: 89c79b3eb78c91ee0bebeba807d7cf5346677ea41ea1547ffa3a5fe7343f95b8
findings: [{"severity":"low","text":"Found aside, Bugs/S, T-1676: E1532S4-16 original census15 entries; isolated current/stage3 runs reproduce fallback endpoints, regular Codex placeholders and receipts after owned roots are removed, with no live listeners or owners. Coordinator classified this as pre-existing; authorised literal cleanup and corrected census pass.","file":"hub/test/harness.ts","line":956},{"severity":"low","text":"Found aside, Bugs/S, T-1677: supplemental current/stage3 runs with70-byte TMPDIR both failed literal hub.sock expectation (actual hashed fallback); original61-byte length gives6/6 on both. Original scoped row08 passed. Both failing diagnostic captures retained.","file":"hub/test/scenarios/hub-lifecycle.test.ts","line":21}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Surface | Result | Observation / evidence |
| --- | --- | --- | --- |
| S0 | hub-api | PASS | Sealed environment and exact pinned Neovim PATH; [S0-env-corrected.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/S0-env-corrected.txt) |
| E1532S4-00 | hub-api | PASS | Build, dev, stage eligibility and landed heads; [E1532S4-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-00.txt) |
| E1532S4-01 | hub-api | PASS | Source boundaries and allowed landing deltas; [E1532S4-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-01.txt) |
| E1532S4-02 | hub-api | PASS | Workspace typecheck; [E1532S4-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-02.txt) |
| E1532S4-03 | hub-api | PASS | OpenCode: 69 tests / 5 files; [E1532S4-03.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-03.txt) |
| E1532S4-04 | hub-api | PASS | Codex: 106 tests / 11 files; [E1532S4-04.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-04.txt) |
| E1532S4-05 | hub-api | PASS | Claude: 185 tests / 12 files; [E1532S4-05.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-05.txt) |
| E1532S4-06 | hub-api | PASS | Clone, worktrees and CLI: 41 tests / 7 files; [E1532S4-06.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-06.txt) |
| E1532S4-07 | hub-api | PASS | Agent restart/version/closure: 65 tests / 10 files; [E1532S4-07.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-07.txt) |
| E1532S4-08 | hub-api | PASS | Spoke regressions: 41 tests / 11 files; [E1532S4-08.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-08.txt) |
| E1532S4-09 | hub-api | PASS | Atomic files/rollback/contracts: 204 tests / 12 files; [E1532S4-09.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-09.txt) |
| E1532S4-10 | hub-api | PASS | Repetitions: 212 tests / 23 invocations; [E1532S4-10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-10.txt) |
| E1532S4-11 | hub-api | PASS | Two fake hosts: startup, restore and discovery; [E1532S4-11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-11.txt) |
| E1532S4-12 | hub-api | PASS | Agent kill/restart and discovery stability; [E1532S4-12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-12.txt) |
| E1532S4-13 | hub-api | PASS | Hub restart and host restore; [E1532S4-13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-13.txt) |
| E1532S4-14 | hub-api | PASS | Secret and publication scans with positive controls; [E1532S4-14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-14.txt) |
| E1532S4-15 | hub-api | PASS | Owned fixture processes and alias cleanup; [E1532S4-15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-15.txt) |
| E1532S4-16 | hub-api | PASS | Final head/tree and scratch residue; [E1532S4-16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/E1532S4-16.txt) |

**QA clear**: all18 final scoped cases/checks PASS, including the labelled row16 precondition correction. No stage findings.

Build `eb1fe370f93f193b8d96b1b0e97d5d346a3f6b78`; run `qa-s4-2026-11-04-qa678-1`; stage `harnesses and git on hosts`. The committed brief is `qa/briefs/E-1532-stage-4.md`. Request `8f676bae-020b-45e2-b2ae-c16f8e965ca2` from the Coordinator; 8/8 stage items landed, three previous stages closed. No epic criterion marks are made for this stage run.

Executed locally on macOS 27.0.1 arm64, Node v24.21.0, pinned Neovim v0.12.5. No browser binary was used. No full suite, droplet, real SSH, real harness account or provider was launched by this QA run. Local droplet cost/lifetime: not applicable.

Scoped named execution: 923 passing tests across 91 serial invocations of 66 distinct files: 711 in the initial 68 invocations and 212 across 23 repetitions. Exact generated case names, plan/counter facts and exit status were checked independently. All scoped files have zero failures, skipped, cancelled and TODO results. The supplemental cleanup diagnosis is recorded separately and does not inflate these totals. Typecheck passed. See per-row `.validation.json`, TAP/check captures, `nested-contract-validation.json` and `replay-names-validation.json`.

The load gate enforced one-minute load ≤10 before each targeted file; quiet admission required no verify holder. No deliberate load or suite ran. TAP durations are captured diagnostics, not a suite wall-time measurement. The brief’s per-file allowances were not Node runner timeout enforcement; explicit bounded assertions inside the tests remained enforced.

Coordinator cover evidence (not executed by this QA run): tree `3dc33087e571d306384d0c9b1d2e8c00e61168fd`, Linux run `b60e169b-b1ee-4f10-9239-9963a442b237` / A-16574 and macOS run `a113176f-6fb0-46b0-9f3b-acb527261f17` / A-16578. Task-view cover facts were checked before the run. Coordinator reported 6987 and 6995 passing tests respectively. Droplet lifetime/cost was not measured here; these cover counts are not added to QA’s 923.

Scratch observations: both fake hosts reached up with private canonical discovery and three expected capabilities. Changed f2 discovery was atomically replaced at mode0600. Agent kill/restart replaced only f1’s agent (1219ms observed), retained its supervisor and discovery, and delivered a complete restored host state. Hub restart preserved discovery bytes/mtime/inode and restored both hosts. No task sessions were created in this scratch exercise; host harness launch, clone presence, lease retention/prune and versions were proven by the named tests. Scratch managed-territory absence of a task worktree produced no host clone; unmanaged-territory exclusion was source-checked only. TCP checks retained a positive control and observed zero TCP sockets for the checked host-side processes; hub listener counts were descriptive.

Spoke RSS was one macOS diagnostic sample: 122699776 bytes after 10000ms idle, excluding hub/test runner and with no tools/list or tools/call before sampling. No RSS threshold or Linux parity claim is made. No later-stage attach/push/survival work is covered.

Corrections and record integrity:

Coord-authorised brief corrections, execution copy only; assertions unchanged except the exact pinned-path exemption:

1. 2181f1a9: move every overlay inside fixtureEnvironment(Q, base, overlays), then scratchGitEnvironment; remove the post-builder Object.assign and copied credential filter. Original seal and corrected seal retained.
2. becd55d8: GH_PAGER is a harmless inherited pager variable counted by the prefix assertion. Pass GH_PAGER: undefined through the shared builder overlay, retaining the zero-count assertion. Original name-only capture retained.
3. becd55d8: the PATH assertion accidentally counted the required pinned Neovim directory under real HOME. Compare paths by realpath and exempt exactly the build-resolved pinned NV directory alongside Node; no other real-HOME path allowed. Original count1 and corrected count0 retained.

4. Brief-authorised T-1665 presentation-only omissions: original row05 and row08 TAP logs are preserved privately. The unchanged scanner refused only three known English test titles. Export replaces two occurrences in row05 and four in row08 with labelled omissions; exact names were validated before replacement. Check files did not require omissions. Assertions, execution and the scanner are unchanged. Original refusal and per-title counts are in presentation-omissions.json; this handling occurs before publication/recorder references, so the later export scan sees the labelled copies.

5. QA supplemental parser/recorder correction (reported to Coordinator): local Host contract registrations are top-level TAP points; SSH registrations are nested. The first supplemental parser required indentation. A shell chain then wrongly recorded row09 PASS at 14:24:55Z despite the parser error and a missing supplemental capture. An explicit INCONCLUSIVE correction and a replacement PASS were both recorded at 14:25:41Z after the read-only parser accepted either depth and required all14 exact names independently per entry. All original test outcomes were already CLEAN; no tests reran. See row09-recorder-correction.md, row09-original-parser-output.txt, nested-contract-validation.json and the complete recorder lines. This is a QA record correction, not a product finding or changed expectation.

6. Row16 precondition correction, coord-authorised by 26cef074-12d4-403f-9a8c-dd6a6aa1a0b1. Original `T leftovers other than node-compile-cache 15` is retained. A-16582's isolated comparisons reproduce every residue class on stage3 and current builds with no live owner or listener. T-1676 tracks the pre-existing cleanup bug; T-1677 tracks lifecycle's literal hub.sock expectation under a9-byte-longer TMPDIR. The15 original entries were removed only by the literal paths in S4-16-removal-list.sh. Repeated read-only census is zero; exact head/dev and both clean-tree counts remain unchanged. This is a labelled brief precondition correction, not a rewritten original pass. Supplemental comparisons are16 invocations:256pass2fail (the two longer-path lifecycle failures); corrected61-byte path runs pass6/6 on both heads. Original scoped tests did not rerun.


The complete [recorder history](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/recorder-lines.jsonl) retains row09’s three lines: 14:24:55Z premature PASS; 14:25:41Z explicit INCONCLUSIVE correction; 14:25:41Z replacement PASS after the read-only parser check. Latest row09 is PASS; the earlier record error is not suppressed.

Cleanup and classification: see `S4-16-leftovers.json`, `S4-16-child-mtimes.json`, `S4-16-root-mapping.json`, `S4-16-owner-records.json`, `S4-16-open-sockets.txt`, and supplemental comparison captures. Original row16 reads `T leftovers other than node-compile-cache 15`; it was retained, attributed, and followed by an authorised literal-path removal and repeated zero census; see `E1532S4-16-corrected.txt`.

Rule proposal sent in the item topic: extend brief lint to reject ordinary environment overlays after the shared fixture builder, preventing the repeated rule15 regression. See `rule-proposal.md`.

Found aside (low severity, Bugs; classified separately by Coordinator):

- **T-1676, size S — test cleanup residue.** E1532S4-16 / `s16` originally printed `T leftovers other than node-compile-cache 15`. The13 root Unix endpoints,15 Codex Unix endpoints,4 regular Codex placeholder files and13 fixture receipts survive removal of the owned test roots; all receipt PIDs are gone and no endpoint has a live listener. Six serial per-file comparisons reproduce the same residue classes on stage3 and the candidate; five files are byte-identical and the changed boundary file has the same Codex placeholder behavior. See A-16582, inventories, source observations and both comparison JSONs. No claimed runtime parent-stack trace; attribution uses isolated file execution plus source.
- **T-1677, size S — lifecycle test assumes a short TMPDIR.** Supplemental `node --test hub/test/scenarios/hub-lifecycle.test.ts` with70-byte TMPDIR failed on both heads: actual `<TMPDIR>/cland-<hash>.sock`, expected `<TMPDIR>/cland-proj-<suffix>/.cland/hub.sock`, at line21. Restoring the original61-byte TMPDIR length yielded6pass0fail on both heads. Both original failed TAP captures remain; this was not a failure in the original scoped run.

Supplemental diagnosis:16 serial file invocations,256pass2fail, no skip/cancel. These are **separate** from the923 scoped passes. Build comparison used the fresh detached stage3 head `8c9f569cf77719706bd02fb43b829b55c66b77f1` and the exact candidate head. The first comparison setup failed before launching any test because scratchGitEnvironment lacked its required config argument; this was corrected in the diagnosis driver, with no product or assertion change. The longer-path first setup and its two observed failures are retained. Exact61-byte comparisons establish the relevant path-precondition result.

The original nt helper did not record per-invocation wall timestamps. `S4-16-estimated-invocation-windows.json` is an approximate reconstruction from TAP durations and log mtimes, excluding gaps and vulnerable to the mtimes of presentation copies. It is not measured start/end evidence and is not the basis of exact creator attribution; fresh per-file inventories establish that. Original child mtimes and receipt/socket hashes are preserved separately.

All scoped cleanup passed after the approved correction. The machine-wide1238 external host-socket directory count was descriptive only; other sessions' files were untouched. No epic criteria were marked. Stage closure is the only closure this verdict requests.

Diagnostic disposal is complete. The first supplemental removal script stopped on an already-absent HOME root (the exact-length setup had not needed to create it). Its error is retained; the eight remaining literal roots and the baseline worktree were then removed successfully. Final existence checks confirm every listed diagnostic root and the baseline worktree are gone. The original15-entry cleanup and repeated row16 census were unaffected.

Durable evidence: A-16583, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16583-e-1532-stage-4-qa-eb1fe370-clear/report.md. Residue attribution: A-16582. Final publication scan: positive controls passed, three known scratch secrets checked, zero findings across115 files.
