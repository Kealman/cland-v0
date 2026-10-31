---
id: Q-1519
kind: question
title: Scheduler, pools and host lifecycle in detail
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1511
blocked_by:
  - Q-1517
  - Q-1513
topic: null
branch: null
created: 2026-10-31T14:35:39.288Z
updated: 2026-10-31T17:09:24.854Z
closed: 2026-10-31T17:09:24.854Z
---

## Question

Scheduler, pools and host lifecycle in detail, after the host prototype and the provider research (map M-1511 round-3 decisions 1–4): defaults for sessions per host by harness, idle_stop and lease length, dense packing details, the "waiting for a host" queue and its visibility in web, Neovim, Telegram and the Agents topic, host rows in doctor, status and the workbenches, the spend ledger line for hosts and the daily cap, failure handling (boot failure, SSH loss, provider rate limits, a host that stops answering while sessions run), `cland host` commands (list, stop, login, status), and the Host interface shape that leaves room for serverless providers. Grilling with the human, in rounds.

## Comments

### human · 2026-10-31T17:09:24.707Z

## Resolution (round 5, 2026-10-31, all accepted by the human)

1. **Sizes and defaults.** Pool slots are weights, not counts: Claude Code 1.0, Codex 0.5 (until measured on the first live host), OpenCode 0.75; defaults 4 weight on s-2vcpu-4gb, 8 on s-4vcpu-8gb; the host agent refuses a launch when free memory is below 1.3 GB (typecheck reserve). The default size of the `agents` pool is s-4vcpu-8gb: twice the price, a quarter of the hosts and logins.
2. **Cold start.** Hosts boot from a pool image snapshot built like the executor's (same prepare recipe, key from Node, Neovim, lockfile and harness versions, rebuilt by `cland host prepare`), target 60–90 s to ready instead of 216 s; `agents` has `min_hosts = 1` by default so the first session never waits; other hosts on demand.
3. **Idle and lease.** `idle_stop` 20 min by default; lease 12 h renewed while sessions run; the detached watchdog deletes a host at the deadline even without the hub (13 s after the deadline in the prototype). Stopping a host means destroy it and keep the login snapshots; the host disk is disposable.
4. **Failures.** No machine or no SSH within 5 min → host destroyed, launch stays queued, one line to the Coordinator; tunnel lost → reconnect with backoff up to 30 s, sessions live on, after 3 min a General line "host X unreachable" and a red Hosts row; host not back within 15 min → sessions exited, roles vacated, host destroyed by the watchdog; provider API limits → creation paused with retry, no cascade.
5. **Visibility.** A `Hosts` row in the web and Neovim beside Remotes ("agents 2/4 hosts · 7/16 slots · logins claude 2/3, codex 1/1") expanding to the host list (id, size, region, uptime, sessions, price per hour, spend today); "waiting for a host / for a login" is a status line in the inbox, not an ask; `cland host list/status/stop/destroy/prepare`, `cland login add/list/remove`; doctor checks the provider token, the image snapshot and free logins.
6. **Money.** The spend ledger gains a `hosts` category beside `verify`; the daily cap is shared with a sub-cap `[hosts] daily_spend_usd` (default $3 ≈ 40 small host-hours); 80 % → a General line, 100 % → no new hosts, live ones untouched; `cland host status` shows today's and the month's spend per pool.
7. **Placement rules.** A role binds to a pool; the Coordinator and the Aide are always `local` in shape A (their Claude login is the Mac's); a task's session stays on one host for its life (relaunch on the same host if alive, else fetch the branch elsewhere); a lead and its implementer need not share a host; the QA role with a browser gets a `qa` pool on 4/8 with one session per host.
8. **Host interface.** The host provider interface mirrors the executor's (acquire/prepare/status/release/reap plus the attach transport and login disks); the transport is a separate layer (`ssh` now, `outbound` later) so a serverless provider without SSH is added without touching the scheduler; `local` is the same interface in-process.
9. **Prototype findings into the spec.** Attach runs with `stty susp undef`; the Linux spoke gets slimmed as its own task (105 MB against ~25 on the Mac); sockets in an agent-owned 0700 directory; the task branch is created in the territory, not as a local worktree first; a per-host secret instead of the project secret; a realpath/sandbox-root operation in Host for Codex; the executor's DELETE 404 no longer counts as success without a confirming GET.
