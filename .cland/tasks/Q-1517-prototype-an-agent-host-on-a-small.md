---
id: Q-1517
kind: question
title: "Prototype: an agent host on a small droplet with the hub tunnelled in"
state: closed
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-1511
blocked_by:
  - Q-1513
  - Q-1515
topic: null
branch: null
created: 2026-10-31T14:35:39.029Z
updated: 2026-10-31T17:02:50.027Z
closed: 2026-10-31T17:02:50.027Z
---

## Question

How does an agent host feel in practice (map M-1511 round-2 decisions 1–4, round-3 decisions 1–4), and how many sessions fit on a small machine? A throwaway prototype on the sandbox project: a small DigitalOcean droplet from the existing provision recipe, a `cland host serve` host agent started by systemd, the hub connecting over SSH with a reverse tunnel for the spoke port and the hub socket, `git daemon` over the territory through the tunnel, a Codex session and a Claude Code session launched on the host into worktrees fetched from the territory, pushes back on commit, an artifact by path uploaded through `artifact.upload`, `cland` CLI from inside the session through the tunnel, attach through `ssh -t`, hub restart and tunnel loss with the sessions surviving, and a second host joining the pool with dense packing.

Measure on the host: RSS, CPU and disk per session for Codex, Claude Code and OpenCode at idle and during a turn, how many sessions a 2 vCPU / 4 GB and a 4 vCPU / 8 GB machine hold before swap or model-turn latency suffers, boot-to-ready time, and the cost of a host-hour. Record the frictions (trust, sockets, paths, `claude agents --json` on the host, Codex sandbox roots) and the decisions the prototype settles for the spec. Credentials on the prototype host come from a one-off login on that host; the credential store is the subject of the other prototype.

## Comments

### human · 2026-10-31T17:02:49.896Z

## Resolution

Prototype on branch prototype/agent-host (final 5e82b085, origin only, never merged); hub/src/host/README.md holds the measurements, the survival table, the Linux facts and 19 decisions; the sandbox's HOW-TO-TRY.md has "Try agent hosts". Spend $0.083; every droplet and key destroyed (tag listing and 404s at 17:01Z). The human signed in Claude Code on the host over `ssh -t` and tried attach; Codex skipped by the human's decision (figures from the first live host after the build).

Measurements (Linux RSS, DO lon1, Ubuntu 24.04.5): boot to ready 218–232 s on s-2vcpu-4gb (204 s on s-4vcpu-8gb; DO's apt-installed droplet agent is most of the 145 s provision, a prepared snapshot removes it); OpenCode session tree 345–437 MB, Claude Code 508–599 MB plus a 70 MB pty host, per host a Claude supervisor 129 MB and a warm spare 100–330 MB; the spoke 105–125 MB on Linux (4–5× macOS); host agent 78–90 MB; a Claude turn 3–4 CPU s, an OpenCode turn 10–14 % of a core; packing: 7 OpenCode or 3 Claude + 2 OpenCode on 4 GB leave 1.85 GB, 12 OpenCode on 8 GB leave 4.45 GB; derived capacity with a 1.2 GB typecheck reserve: 4 Claude or 6–7 OpenCode on 2 vCPU/4 GB, 8–9 Claude or 15–20 OpenCode on 4 vCPU/8 GB; concurrent turns: OpenCode 7 at once 72 s at load 2.2, Claude 3 at once 17 s at load 0.4. No swap on droplets.

Survival: hub stopped 20 s → tunnel back in 1.4 s, rows re-found from the agent's table, spoke hello +7 s; SSH master SIGKILLed → back in 3.2 s after the fix (stale control socket removed before start, forwards retried); host agent killed → supervisor restart ~2 s, harnesses untouched; remote stop 0.9 s. Second host boot 218 s; dense packing; visible "waiting for a host"; idle_stop at 2 min; lease renewal; the detached watchdog deleted the last host 13 s after the deadline with the hub stopped.

Decisions settled: (1) no systemd dependency: a setsid/nohup supervisor, detached harnesses outlive agent, SSH login and hub (KillUserProcesses=no); (2) sockets in an agent-owned 0700 directory on disk (/run/user exists only while a login lives); (3) one hub-owned ControlMaster per host as Q-1515 laid out plus stale-socket removal, forward retry and an end-to-end probe through agent.sock; (4) git daemon --inetd per connection carries clone, fetch and push, dev stays protected, commits reach the territory in ~2 s; (5) the ws+unix spoke edge works unchanged; (6) artifact bytes come up by path through the host agent; (7) Claude on a host needs one `claude agents --json` at launch only, hooks and the mod bridge carry state; (8) placement as specified; cold boot ~3.6 min, so pools that matter keep min_hosts = 1 or boot from a snapshot; (9) pool defaults 4 sessions per s-2vcpu-4gb, 8 per s-4vcpu-8gb; (10) harness homes at /cland/auth/<harness>-<login> through OPENCODE_DB and CLAUDE_CONFIG_DIR; (11) the Host interface needs a realpath/sandbox-root operation (Codex sandbox roots are computed from local paths); (12) item branches are made in the territory, not as a local worktree first; (13) a per-host secret replaces the project secret in the host's hub.json.

Findings for the spec: Ctrl+Z over `ssh -t` ends the attach at once while the session survives and re-attach works → run attach with `stty susp undef` or document it; git daemon over a socket needs half-open sockets on both ends; OpenCode 2 only from opencode.ai/v2/install; the free OpenCode model's per-IP limit tripped the hub's limited mark for every host; the executor wrapper treats DELETE 404 as success, which can hide a leaked key; relaunch on a host not implemented; Neovim view untested (sandbox setup not run).
