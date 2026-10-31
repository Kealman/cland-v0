---
id: Q-1515
kind: question
title: SSH tunnel, git daemon and host-agent transport facts
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:38.104Z
updated: 2026-10-31T14:50:03.588Z
closed: 2026-10-31T14:50:03.588Z
---

## Question

Which transport facts fix the hub↔host channel of map M-1511 round-1 decision 3 and round-2 decisions 1–3: the hub (behind NAT on a Mac) connects to a host over SSH, keeps a reverse tunnel for the spoke WebSocket port and the hub Unix socket, and serves the territory over `git daemon` through it?

Primary sources: OpenSSH manuals (ssh, sshd_config, ssh_config: `-R` with Unix-domain sockets, `StreamLocalBindUnlink`, `ExitOnForwardFailure`, `ServerAliveInterval`/`CountMax`, `ControlMaster` multiplexing, limits on forwarded channels, `AllowStreamLocalForwarding`, `GatewayPorts`), autossh or equivalent reconnect patterns, Node's `child_process` handling of a long-lived ssh with forwards, git documentation (`git daemon` `--enable=receive-pack`, `--base-path`, `--listen=127.0.0.1`, `git://` through a forwarded port, `receive.denyCurrentBranch`, hooks in a bare repo, push on every commit from a post-commit hook, `git fetch` over the tunnel, bundle fallback), and the systemd docs for a detached host agent (`systemd-run`, user services, `Restart=`, `KillMode=process`, `tmpfs` via `RuntimeDirectory` or a mount).

Also cover the alternatives and when they beat SSH: WireGuard/Tailscale/Headscale meshes (userspace tsnet, cost, auth), an outbound WSS from the host agent to a hub that is reachable (shape B, or a relay), and Kubernetes `port-forward`/`exec` as the shape-B equivalent of the tunnel. Note what the harness adapters need on the host: Codex `app-server --listen unix://`, Claude `--bg` supervisor socket in `/tmp/cc-daemon-<uid>/`, OpenCode `serve` on 127.0.0.1, and how `claude attach` / `codex resume --remote` / `opencode --server` work through `ssh -t`.

Deliver docs/research/host-transport.md on branch research/host-transport with a recommended tunnel layout (one ssh per host with multiplexing, which forwards, keepalives, reconnect policy), the git-daemon layout and its risks, and "Rules for the spec".

## Comments

### human · 2026-10-31T14:50:03.425Z

## Resolution

Research note: docs/research/host-transport.md on branch research/host-transport (final 9aac93c0, pushed to origin only). Fifteen rules for the spec; "Not found" items go to the host prototype (Q-1517).

1. One SSH connection per host, owned by the hub, as a ControlMaster (`-N`, BatchMode, IdentitiesOnly, pinned known_hosts, ExitOnForwardFailure, ServerAlive 15×4); the hub runs its own reconnect loop (backoff 1–30 s with jitter, `-O exit` before each start, end-to-end probe every 30 s), no autossh.
2. Every host-side endpoint is a Unix socket under /run/user/<uid>/cland, 0600 by sshd, with `StreamLocalBindUnlink yes` in the image so a reconnect takes the path over at once. No TCP forwards: a dead TCP reverse forward stays bound until ClientAlive, and the hub's spoke port changes every start.
3. Forwards: `-R hub.sock` (CLI, hooks, mod bridge, host agent), `-R spoke.sock` (a new hub spoke edge over a Unix socket; spokes use ws+unix, the host's hub.json never changes), `-R git.sock` (git daemon `--inetd` spawned by the hub per connection, per-host socket, no git TCP port anywhere), `-L agent.sock` (hub→host-agent RPC); per-session `-O forward -L` for the Codex app-server socket or the OpenCode port, re-added after every reconnect.
4. The git-daemon spawn strips CLAND_TERRITORY_WRITE (the main/dev guard holds over the daemon only through inherited env), sets CLAND_PUSH_HOST as the host identity, and sets fsck, autogc=false and denyDeletes through GIT_CONFIG_COUNT; the update hook keeps a per-host allow list of refs. Risks: anonymous push (contained by 0600 sockets, one socket per host, allow list), push lag, races with merge (revoke the host's lease under the territory lock first), first-clone bandwidth (52 MB territory: bundle over scp for the first clone and as fallback).
5. The host clone uses GIT_PROXY_COMMAND to git.sock; the host agent pushes on every ref move (ref and reflog watch, not a post-commit hook); verify and ready flush first.
6. Host processes: the host agent is a user unit with lingering, RuntimeDirectory preserved, no PrivateTmp; harnesses must not live in the host agent's cgroup (default KillMode=control-group would kill them on restart; KillMode=process is discouraged), so each harness server gets its own `systemd-run --user` transient unit; Claude gets one supervisor per account. Host sshd: StreamLocalBindUnlink yes, ClientAlive 15×4, MaxSessions 32.
7. Attach is its own `ssh -t` with ControlPath=none and ClearAllForwardings running `cland host attach <session>`, which sets the harness env on the host.
8. Tailscale and other meshes win only when the host is also behind NAT; outbound WSS from the host agent is the carrier for shape B; `kubectl port-forward` is TCP only, ends with the pod, and serves human access only.

Not found, for the prototype: the Claude supervisor socket on Linux and `claude daemon run` under systemd; Ctrl+Z in `claude attach` over `ssh -t`; distro OpenSSH and KillUserProcesses defaults; fsck and inetd cost.
