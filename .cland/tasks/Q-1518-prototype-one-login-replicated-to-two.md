---
id: Q-1518
kind: question
title: "Prototype: login disks, snapshots and the login capacity rule"
state: open
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-1511
blocked_by:
  - Q-1514
  - Q-1517
topic: null
branch: null
created: 2026-10-31T14:35:39.154Z
updated: 2026-10-31T17:02:51.353Z
---

## Question

Does the login-disk mechanics of map M-1511 round 4 work end to end, without touching the human's real subscription logins? A throwaway prototype on the sandbox project with small DigitalOcean droplets: a `disk` login created on host A (OpenCode with its free models, plus a fake harness whose "login" is a file it rotates on every turn), its 1 GiB volume snapshotted on host stop, a volume created from the snapshot and mounted on host B, the harness homes passed through OPENCODE_DB / CODEX_HOME / CLAUDE_CONFIG_DIR, write-back of the rotated file into a new snapshot, `exclusive` enforced by the scheduler (host B refuses the login while A holds it; two hosts with `exclusive = false`), a `key` login for OpenCode Go from the encrypted store on two hosts at once, the signed-out path (the fake harness reports a dead login → the hub marks the login, blocks launches on it, the re-login on the same host updates the snapshot in place), the capacity rule (effective max = min(max_hosts, free logins)), the "waiting for a login" queue row and the card, `cland login add/list` output, and the snapshot cost and timing (create volume from snapshot, attach, mount, snapshot on stop).

Real accounts are used only once each and only where production needs them anyway: one Claude Code device login on a host during the host prototype's sizing step; one Codex `--device-auth` login on a host at a moment the human picks (no Codex sessions running on the Mac's crew), followed by a day of watching whether the Mac stays signed in. No copy-of-a-login experiment with real accounts: the design assumes `exclusive = true` and the signed-out hint covers the kick-out case (human, 2026-10-31).
