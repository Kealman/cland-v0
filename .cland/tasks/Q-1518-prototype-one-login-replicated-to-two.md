---
id: Q-1518
kind: question
title: "Prototype: login disks, snapshots and the login capacity rule"
state: closed
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
updated: 2026-10-31T17:48:15.291Z
closed: 2026-10-31T17:48:15.291Z
---

## Question

Does the login-disk mechanics of map M-1511 round 4 work end to end, without touching the human's real subscription logins? A throwaway prototype on the sandbox project with small DigitalOcean droplets: a `disk` login created on host A (OpenCode with its free models, plus a fake harness whose "login" is a file it rotates on every turn), its 1 GiB volume snapshotted on host stop, a volume created from the snapshot and mounted on host B, the harness homes passed through OPENCODE_DB / CODEX_HOME / CLAUDE_CONFIG_DIR, write-back of the rotated file into a new snapshot, `exclusive` enforced by the scheduler (host B refuses the login while A holds it; two hosts with `exclusive = false`), a `key` login for OpenCode Go from the encrypted store on two hosts at once, the signed-out path (the fake harness reports a dead login → the hub marks the login, blocks launches on it, the re-login on the same host updates the snapshot in place), the capacity rule (effective max = min(max_hosts, free logins)), the "waiting for a login" queue row and the card, `cland login add/list` output, and the snapshot cost and timing (create volume from snapshot, attach, mount, snapshot on stop).

Real accounts are used only once each and only where production needs them anyway: one Claude Code device login on a host during the host prototype's sizing step; one Codex `--device-auth` login on a host at a moment the human picks (no Codex sessions running on the Mac's crew), followed by a day of watching whether the Mac stays signed in. No copy-of-a-login experiment with real accounts: the design assumes `exclusive = true` and the signed-out hint covers the kick-out case (human, 2026-10-31).

## Comments

### human · 2026-10-31T17:48:15.148Z

## Resolution

Prototype on branch prototype/agent-host (final 7f7ecb0f, origin only, never merged); "Logins" section of hub/src/host/README.md (tables, checks, frictions, 13 decisions); HOW-TO-TRY.md "Try logins". Live on DO lon1 s-2vcpu-4gb with OpenCode (free model) and a fake harness, no real account; spend under $0.12; everything destroyed (provider listing 17:45Z: no cland-proto droplets, volumes, snapshots or keys; four droplet ids 404).

Timings (s, mean): volume create 3.5; volume from snapshot 1.5; attach 7.4; mount 0.16; snapshot 1.7; detach 7.1; delete 1.1; `login add` 22.4 with the host up; bind per login 8.9; release per login 10.3; a release that hit the one-snapshot-per-volume-per-10-min limit waited 449 s. Cost per login ≈ $0.02/month at rest (two snapshots at the $0.01 minimum), ≤ $0.12/month in use.

Checks: write-back (host B read generation 3 written on host A); exclusive and capacity (second launch waited "waiting for a login fake" in session, host and login lists, General got the "create one?" card, no host booted; `login add` released it and a host booted 1 s later); non-exclusive (two hosts from one snapshot, write-back from the writer only); signed-out (dead login marked, card posted, next launch skipped the host, its session kept running, `login signin` reused the same volume, the one-sign-in hint appeared on the second dead login within a day); key login on two hosts (value only in the harness env, not in argv, files, hub.db, log or journal; .cland/auth ciphertext only); hub restart re-found two hosts with bound logins.

Decisions amending round 4: (1) keep each login's VOLUME and detach it at stop instead of snapshot-and-delete (DO allows one snapshot per volume per 10 min; a volume attaches to one droplet at a time, so the provider enforces exclusive like a Kubernetes RWO claim; the next bind re-attaches in ~7 s, never stale); snapshots become backups (after a sign-in, at most daily, last two kept) and the source for non-exclusive readers; ≈ $0.08/login/month more. (2) Never block a host stop on a snapshot: detach, delete the droplet, snapshot later from the hub. (3) Bind logins while the host provisions (attach needs only an active droplet at ~35 s; provisioning takes ~140 s); release a host's logins in parallel. (4) A release ends every process using the login disk (OpenCode 2 leaves `opencode serve --service` holding its home). (5) One privileged helper on the host (mount, unmount, freeze, thaw with strict arguments) through sudo; drop DO's /mnt automount udev rule; the host agent stays unprivileged. (6) Placement asks each host for a per-harness verdict (serves, can bind, signed out, no login); a pool grows only when a free login exists; the waiting row's reason must update. (7) A login belongs to a region (snapshots cannot leave it). (8) A key login's value goes only into the spawn env; the store key is a known [auth] section of secrets.toml (the strict reader must learn it). (9) The hub reconciles login volumes at start after a watchdog deletion (inferred, not tested).

Not settled: whether a live Claude or Codex process picks up re-signed tokens without relaunch (the fake harness re-reads per turn); OpenCode turns with a real key. Gap: sessions on a destroyed host stayed "running" in the prototype.
