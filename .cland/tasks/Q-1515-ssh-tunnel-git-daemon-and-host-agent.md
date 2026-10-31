---
id: Q-1515
kind: question
title: SSH tunnel, git daemon and host-agent transport facts
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:38.104Z
updated: 2026-10-31T14:35:56.016Z
---

## Question

Which transport facts fix the hub↔host channel of map M-1511 round-1 decision 3 and round-2 decisions 1–3: the hub (behind NAT on a Mac) connects to a host over SSH, keeps a reverse tunnel for the spoke WebSocket port and the hub Unix socket, and serves the territory over `git daemon` through it?

Primary sources: OpenSSH manuals (ssh, sshd_config, ssh_config: `-R` with Unix-domain sockets, `StreamLocalBindUnlink`, `ExitOnForwardFailure`, `ServerAliveInterval`/`CountMax`, `ControlMaster` multiplexing, limits on forwarded channels, `AllowStreamLocalForwarding`, `GatewayPorts`), autossh or equivalent reconnect patterns, Node's `child_process` handling of a long-lived ssh with forwards, git documentation (`git daemon` `--enable=receive-pack`, `--base-path`, `--listen=127.0.0.1`, `git://` through a forwarded port, `receive.denyCurrentBranch`, hooks in a bare repo, push on every commit from a post-commit hook, `git fetch` over the tunnel, bundle fallback), and the systemd docs for a detached host agent (`systemd-run`, user services, `Restart=`, `KillMode=process`, `tmpfs` via `RuntimeDirectory` or a mount).

Also cover the alternatives and when they beat SSH: WireGuard/Tailscale/Headscale meshes (userspace tsnet, cost, auth), an outbound WSS from the host agent to a hub that is reachable (shape B, or a relay), and Kubernetes `port-forward`/`exec` as the shape-B equivalent of the tunnel. Note what the harness adapters need on the host: Codex `app-server --listen unix://`, Claude `--bg` supervisor socket in `/tmp/cc-daemon-<uid>/`, OpenCode `serve` on 127.0.0.1, and how `claude attach` / `codex resume --remote` / `opencode --server` work through `ssh -t`.

Deliver docs/research/host-transport.md on branch research/host-transport with a recommended tunnel layout (one ssh per host with multiplexing, which forwards, keepalives, reconnect policy), the git-daemon layout and its risks, and "Rules for the spec".
