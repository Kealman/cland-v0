---
id: Q-1517
kind: question
title: "Prototype: an agent host on a small droplet with the hub tunnelled in"
state: open
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
updated: 2026-10-31T14:55:21.671Z
---

## Question

How does an agent host feel in practice (map M-1511 round-2 decisions 1–4, round-3 decisions 1–4), and how many sessions fit on a small machine? A throwaway prototype on the sandbox project: a small DigitalOcean droplet from the existing provision recipe, a `cland host serve` host agent started by systemd, the hub connecting over SSH with a reverse tunnel for the spoke port and the hub socket, `git daemon` over the territory through the tunnel, a Codex session and a Claude Code session launched on the host into worktrees fetched from the territory, pushes back on commit, an artifact by path uploaded through `artifact.upload`, `cland` CLI from inside the session through the tunnel, attach through `ssh -t`, hub restart and tunnel loss with the sessions surviving, and a second host joining the pool with dense packing.

Measure on the host: RSS, CPU and disk per session for Codex, Claude Code and OpenCode at idle and during a turn, how many sessions a 2 vCPU / 4 GB and a 4 vCPU / 8 GB machine hold before swap or model-turn latency suffers, boot-to-ready time, and the cost of a host-hour. Record the frictions (trust, sockets, paths, `claude agents --json` on the host, Codex sandbox roots) and the decisions the prototype settles for the spec. Credentials on the prototype host come from a one-off login on that host; the credential store is the subject of the other prototype.
