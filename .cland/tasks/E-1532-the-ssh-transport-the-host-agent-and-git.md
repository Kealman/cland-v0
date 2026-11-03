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
updated: 2026-11-03T07:19:31.802Z
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
