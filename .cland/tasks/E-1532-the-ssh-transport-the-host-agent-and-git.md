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
topic: null
branch: null
created: 2026-10-31T18:22:03.352Z
updated: 2026-10-31T18:22:54.988Z
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
