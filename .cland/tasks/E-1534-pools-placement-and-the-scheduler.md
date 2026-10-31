---
id: E-1534
kind: epic
title: Pools, placement and the scheduler
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1533
follows:
  - E-1533
topic: null
branch: null
created: 2026-10-31T18:22:03.811Z
updated: 2026-10-31T18:22:33.966Z
---

## Goal

Roles run on pools of hosts that the hub sizes by itself. A pool is a table in `config.toml`: provider, size, region, slots, the smallest and largest number of hosts, and the idle stop. A role is bound to a pool in `roles.toml`. The scheduler packs launches densely by weight, holds a launch it cannot place as a visible waiting launch, starts hosts on demand, stops empty ones after their idle time, and never stops a host with sessions. Each host has a 12-hour lease, renewed while it works, and a detached watchdog that deletes it at the deadline even if the hub is gone. Failures follow fixed timeouts, and agent hosts get their own category in the spend ledger with a $3 daily sub-cap. Everything runs on the fake host provider of the previous epic. The host prototype ran dense packing, the waiting line, idle stop, lease renewal and the watchdog on real droplets (Q-1517), and the scheduler grilling fixed the numbers (Q-1519).

## Contents

- **Pool configuration** (spec §3.5). `[hosts]` with `daily_spend_usd`, `lease` and an optional weights override, and `[hosts.<pool>]` with `provider`, `size`, `region`, `slots`, `min_hosts`, `max_hosts`, `idle_stop`, `spread` and `transport`, validated, hot-reloaded and settable with `cland config set` (`cland config set hosts.agents.max_hosts 4` scales at once). `cland init` writes `[hosts]` with no pool, and `cland update` adds it to existing projects. Demo: raising `max_hosts` with `cland config set` lets a waiting launch start a host without a hub restart.
- **Role placement** (§3.1, §3.5). `[<role>.launch] pool` in `roles.toml`, default `local`, read at each launch; the Coordinator and the Aide refused anything but `local`. Demo: an Implementer launch goes to the `agents` pool, and a Coordinator bound to a pool is refused.
- **Weighted slots and the memory floor** (§3.5). Claude Code 1.0, Codex 0.5, OpenCode 0.75; `slots` 4 on s-2vcpu-4gb and 8 on s-4vcpu-8gb by default, `agents` defaulting to s-4vcpu-8gb; the host agent refuses a launch below 1.3 GB free memory, and the launch then waits as if the host were full. Demo: eight Claude Code sessions fill a host of 8; a Codex and an OpenCode session fit where the weights allow; a fake host reporting 1.2 GB free refuses the next launch.
- **Placement** (§3.5). Dense packing onto the fullest host with enough free weight; `spread = true` takes the emptiest; a host that cannot serve the session's harness is skipped (the verdict hook that "Logins" fills in). Demo: four launches on two hosts land densely, then spread with the flag.
- **Waiting launches** (§3.5). A launch with no host able to take it waits in the hub as a status line with its current reason ("waiting for a host", "waiting for host <id> to boot"; "waiting for a login <harness>" comes with "Logins"), shown in both inboxes, in the Agents topic and in `cland session list`; never an ask; ended by placement or cancel; the reason updates when it changes and never repeats per poll. Demo: with `max_hosts` reached, a launch waits; when a host frees a slot, it is placed and the line ends.
- **Scale up and down** (§3.5). `min_hosts` kept (1 for `agents` by default), further hosts on demand, an empty host stopped after `idle_stop` (20 minutes by default) never below `min_hosts` and never sooner than the provider's billing minimum; a host with sessions stopped only by `cland host stop <id>`, which ends them as exited. Demo: with `idle_stop` shortened, an emptied host above `min_hosts` stops, and the last one stays.
- **Lease and watchdog** (§3.6). A lease per host in `hub.db`, written before the create call, held until deletion is confirmed; a 12-hour deadline renewed while the host has sessions or is held by `min_hosts`; a detached watchdog per host deleting it and its key at the deadline without the hub, re-armed after a hub restart. Demo: with the hub stopped and a short lease, the watchdog deletes the fake host shortly after its deadline.
- **Failures** (§3.6). No machine or SSH within 5 minutes: the host destroyed, launches kept waiting, one line to the Coordinator. Tunnel lost: reconnect with sessions alive, a General line "host <id> unreachable" after 3 minutes and a red row. Not back within 15 minutes: sessions exited, roles vacated, the host destroyed. Provider API limits: creation paused with a retry. A host destroyed by anyone makes its sessions exited; an unknown host counts as gone, not alive. Demo: each case on a fake host with shortened timeouts reads as specified.
- **Hub restart with hosts** (§3.2, §3.6). After a restart the hub re-reads its leases, re-opens the tunnels, re-finds rows and re-arms watchdogs; a lease whose machine is gone ends its sessions as exited. Demo: a restart with two hosts, one deleted meanwhile.
- **Money** (§3.6). The spend ledger's entries gain a category, `verify` or `hosts`; `[verification] daily_spend_usd` bounds both, `[hosts] daily_spend_usd` (default $3) bounds the hosts within it; a host reserves its price to its lease deadline at create and renewal and settles on its lifetime; at 80 % of the sub-cap one General line, at 100 % no new host and live ones untouched. Demo: with a tiny sub-cap a second host is refused at the cap, the first keeps running, and the 80 % line appears once.
- **`cland host` commands** (§3.9). `cland host status` (per pool: hosts, slots used, today's and the month's spend; per host: id, size, region, uptime, sessions, price per hour), `cland host stop <id>`, beside `list`, `destroy` and `prepare` from the previous epic. Demo: `cland host status` after the money demo shows the spend per pool.

Not in this epic: logins, their capacity rule and the "create one?" card ("Logins"); the Hosts row and the workbench views ("Workbenches, doctor, setup and docs for hosts"); autoscaling from the queue (out of scope for 0.4).

## Order

1. **One pool, one host, dense placement.** Config, role placement, weights, placement on the fake provider. Demo: an Implementer launch lands on the `agents` pool's host.
2. **Waiting launches and scale up.** The status line, `max_hosts`, start on demand, `cland config set`. Demo: a launch waits at `max_hosts`, then starts a host when it is raised.
3. **Idle stop, `min_hosts`, stop and the memory floor.** Demo: an emptied host stops after `idle_stop`; the floor refuses a launch.
4. **Lease, watchdog and restart.** Demo: the watchdog deletes a host with the hub stopped; a restart re-finds hosts.
5. **Failures.** The three timeouts, API limits, destroyed hosts. Demo: each failure case.
6. **Money and `cland host status`.** Demo: the sub-cap refuses a host and the status shows the spend.

## Definition of done

QA runs the demo below on `dev` through the `cland` CLI and the hub's frame protocol, with the fake host provider and fake transport in the suite and shortened timeouts set in the scratch project's config, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real droplet is created.

In a scratch project with an `agents` pool of `max_hosts = 1` and `min_hosts = 1`, QA launches Implementers until the host is full by weight and reads the next launch waiting with its reason in `cland session list`, the inbox and Agents; raises `max_hosts` with `cland config set` and reads a second host start and the launch placed. It sets `spread = true` and reads the next placements. It empties the second host and reads it stop after `idle_stop` while the first stays. It makes a fake host report 1.2 GB free and reads the refusal. It stops the hub with a short lease and reads the watchdog's deletion, restarts the hub with one host deleted meanwhile and reads its sessions exited. It runs the boot-timeout, unreachable and 15-minute cases and reads the General lines and the red state in `cland host status`. With a tiny sub-cap it reads the 80 % line once, a refused host at 100 % and the running host untouched, then reads `cland host status` with the spend and a ledger entry of category `hosts`. Finally it binds the Coordinator to a pool and reads the refusal.

- [ ] C1. Pools are configured in `[hosts.<pool>]`, hot-reloaded and scaled with `cland config set`, and roles bind to them with `[<role>.launch] pool`, the Coordinator and the Aide only `local`.
- [ ] C2. Placement packs densely by harness weight within `slots`, spreads with `spread = true`, and the host agent refuses a launch below 1.3 GB free memory.
- [ ] C3. A launch that cannot be placed waits as a status line with its current reason in both inboxes, Agents and `cland session list`, never as an ask, and is placed when room appears.
- [ ] C4. Pools keep `min_hosts`, start hosts on demand up to `max_hosts`, stop an empty host after `idle_stop`, and never stop a host with sessions except by `cland host stop`.
- [ ] C5. Each host has a lease renewed while it works, and its detached watchdog deletes it at the deadline with the hub stopped.
- [ ] C6. Boot and SSH failures after 5 minutes, unreachable hosts after 3 and 15 minutes, provider API limits and destroyed hosts each behave as spec §3.6 says.
- [ ] C7. Agent hosts book under the ledger's `hosts` category, the sub-cap stops new hosts at 100 % with live ones untouched, and General gets one line at 80 %.
- [ ] C8. `cland host status` shows per pool the hosts, slots, and today's and the month's spend, and per host its size, region, uptime, sessions and price.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch, push to `origin`, reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items through `cland task` only.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig. No new runtime dependency.
- **Tests.** Test first (`tdd`) on the fake host provider and fake transport, with timeouts injected through the hub's clock (`hub/src/hub/clock.ts`) rather than real waits. No real droplet.
- **The ledger.** `spend.json` is shared by every project hub of the user: entries without a category read as `verify`, and the change never loses or resets an entry (the ledger's own reconciliation rules hold). Never delete `~/.cland` or the state directory.
- **No autoscaling from the queue.** Hosts start for waiting launches only within `max_hosts`; nothing raises `max_hosts` by itself.
- **The Coordinator's line.** Lines to the Coordinator and General are one per event, never per poll (the General-is-dialogue rule: no suite results there).
- **The prototype.** `prototype/agent-host` at 7f7ecb0f is never merged; read `hub/src/host/hosts.ts` (placement, idle stop, lease renewal) and `watchdog.ts`, follow the spec.
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Fourth in the hub lane, after "Host providers, images and DigitalOcean". "Logins" follows it, and "Workbenches, doctor, setup and docs for hosts" waits for it and for "Logins".

## References

- Spec: `docs/spec/v0.4.md` §3.5 (pools, placement, the scheduler and the queue), §3.6 (lifecycle, lease, watchdog, failures and money), §3.9 (the commands), §3.13 and §4.
- Items: R-1530; the map M-1511, round 1 decisions 8 and 9, round 3 decisions 1, 2 and 4; Q-1519 §1 to §7; Q-1517 (decisions 8, 10 and 11, the packing measurements).
- Research: `docs/research/host-providers.md` on `research/host-providers` (359d08df), rules 1, 4, 5 and 10.
- Prototype, on `prototype/agent-host` at 7f7ecb0f: `hub/src/host/README.md` ("How many fit", survival, spend and teardown), `hosts.ts`, `watchdog.ts`.
- Code: `hub/src/init/config.ts`, `hub/src/roles/config.ts`, `hub/src/adapters/sessions.ts`, `hub/src/executor/droplet/{spend,spend-hubs,lease,deadline,watchdog}.ts`, `hub/src/hub/clock.ts`, `hub/src/hub/inbox.ts`, `hub/src/hub/agents-topic.ts`.
- GLOSSARY: Host pool, Slot, Waiting launch (added for v0.4); Lease (amended); Pool (the crew's, distinct).
