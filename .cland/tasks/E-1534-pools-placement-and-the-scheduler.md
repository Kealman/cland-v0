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
topic: topic-1425
branch: null
created: 2026-10-31T18:22:03.811Z
updated: 2026-11-08T11:58:55.868Z
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

QA runs the demo below on `dev` through the `cland` CLI and the hub's frame protocol, with the fake host provider and fake transport in the suite , the spec's fixed 5-, 3- and 15-minute timeouts shortened only through the test-only `CLAND_TEST_HOST_BOOT_MS`, `CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS` environment knobs, honoured inside the fake-host fence (`CLAND_FAKE_HOST_ROOT`) alone, and `idle_stop` and `lease` shortened in the scratch project's `config.toml`, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No real droplet is created.

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

## Plan

```yaml
stages:
  - name: pool config, role placement, placement core, memory floor and ledger categories
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1738
      - - T-1739
      - - T-1740
      - - T-1737
        - T-1741
      - - T-1742
  - name: placement on pool hosts, waiting launches, scale up, lease and watchdog
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1743
        - T-1744
        - T-1745
        - T-1746
      - - T-1747
        - T-1748
      - - T-1763
  - name: idle stop, failures, restart, money, host status and DigitalOcean
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-1749
        - T-1750
        - T-1751
      - - T-1752
        - T-1753
        - T-1756
      - - T-1754
      - - T-1755
```

## Comments

### qa-678 · 2026-11-08T00:38:54.816Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-e1534s1-2026-11-08-qa678-1
commit: c130bac414ae88d9e79f89000f10f97751cfe1d6
stage: pool config, role placement, placement core, memory floor and ledger categories
stage_hash: a2d72ccfee802271bcb54668eef0cec7b7e8ed5bb266db99b34721b189fe2b2c
findings: [{"severity":"low","text":"Found aside T-1676: three dead ownership receipts from nvim QA and unchanged Claude CLI-hub producer. PIDs absent, no open listeners, test roots gone; removed by literal paths under carried brief clause.","file":"shared/fixture-ownership.ts","line":13},{"severity":"low","text":"Brief defects corrected with Coordinator decisions: stale kit3 pin (9de5178b); expected T-1735 landing delta (ccf550e7); whole-config daily_spend_usd counter (5f1dfe6d); fake-host OpenCode descendant omitted from final census allowance (76d4b23b). Original captures, exact comparisons and supplemental-observation correction retained. No stage product defect.","file":"qa/briefs/E-1534-stage-1.md"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Result | Tests | Observation and evidence |
|---|---|---:|---|
| E1534S1-10 | PASS | 9 | nt E1534S1-10 hub/test/host-scheduler.test.ts; native exit and TAP counts plus required names checked; [E1534S1-10.log](E1534S1-10.log); [E1534S1-10.check.txt](E1534S1-10.check.txt); [E1534S1-10-validation.json](E1534S1-10-validation.json) |
| E1534S1-11 | PASS | 5 | nt E1534S1-11 hub/test/roles-harnesses.test.ts; native exit and TAP counts plus required names checked; [E1534S1-11.log](E1534S1-11.log); [E1534S1-11.check.txt](E1534S1-11.check.txt); [E1534S1-11-validation.json](E1534S1-11-validation.json) |
| S0 | PASS | — | Fresh plain/hub shared-builder seals; zero credential names and HOME PATH extras; scratch roots and Node 24.21.0; kit3 pin correction coord ask 9de5178b with five identical heredocs; [S0-env.txt](S0-env.txt); [S0-node.txt](S0-node.txt); [S0-kit3-pin.diff](S0-kit3-pin.diff) |
| E1534S1-00 | PASS | — | Brief s00; captured facts checked; [E1534S1-00.txt](E1534S1-00.txt) |
| E1534S1-01 | PASS | — | Brief s01; captured facts checked; [E1534S1-01.txt](E1534S1-01.txt) |
| E1534S1-02 | PASS | — | Brief s02; preserved files and package files unchanged; landing-delta correction coord ask ccf550e7: T-1735 self-ignore only, six T-1741 files identical and memory seed unchanged; [E1534S1-02.txt](E1534S1-02.txt) |
| E1534S1-03 | PASS | — | Brief src.mjs: all 45 source/default checks match; 45 file registration lists checked against final source; [E1534S1-03.txt](E1534S1-03.txt) |
| E1534S1-12 | PASS | 12 | nt E1534S1-12 hub/test/roles-snapshot.test.ts; native exit and TAP counts plus required names checked; [E1534S1-12.log](E1534S1-12.log); [E1534S1-12.check.txt](E1534S1-12.check.txt); [E1534S1-12-validation.json](E1534S1-12-validation.json) |
| E1534S1-13 | PASS | 16 | nt E1534S1-13 hub/test/role-launch.test.ts; native exit and TAP counts plus required names checked; [E1534S1-13.log](E1534S1-13.log); [E1534S1-13.check.txt](E1534S1-13.check.txt); [E1534S1-13-validation.json](E1534S1-13-validation.json) |
| E1534S1-14 | PASS | 14 | nt E1534S1-14 hub/test/roles-component.test.ts hub/test/cli.test.ts; native exit and TAP counts plus required names checked; [E1534S1-14.log](E1534S1-14.log); [E1534S1-14.check.txt](E1534S1-14.check.txt); [E1534S1-14-validation.json](E1534S1-14-validation.json) |
| E1534S1-15 | PASS | 43 | nt E1534S1-15 hub/test/session-host-placement.test.ts hub/test/roles-editor.test.ts hub/test/roles-template.test.ts hub/test/roles-launch-permissions.test.ts; native exit and TAP counts plus required names checked; [E1534S1-15.log](E1534S1-15.log); [E1534S1-15.check.txt](E1534S1-15.check.txt); [E1534S1-15-validation.json](E1534S1-15-validation.json) |
| E1534S1-16 | PASS | 25 | pl E1534S1-16 nvim/test/qa.test.ts; native exit and TAP counts plus required names checked; [E1534S1-16.log](E1534S1-16.log); [E1534S1-16.check.txt](E1534S1-16.check.txt); [E1534S1-16-validation.json](E1534S1-16-validation.json) |
| E1534S1-17 | PASS | 21 | pl E1534S1-17 hub/test/host-agent.test.ts; native exit and TAP counts plus required names checked; [E1534S1-17.log](E1534S1-17.log); [E1534S1-17.check.txt](E1534S1-17.check.txt); [E1534S1-17-validation.json](E1534S1-17-validation.json) |
| E1534S1-18 | PASS | 45 | pl E1534S1-18 hub/test/claude-code-remote.test.ts; native exit and TAP counts plus required names checked; [E1534S1-18.log](E1534S1-18.log); [E1534S1-18.check.txt](E1534S1-18.check.txt); [E1534S1-18-validation.json](E1534S1-18-validation.json) |
| E1534S1-19 | PASS | 1 | nt E1534S1-19 hub/test/host-agent-client.test.ts; native exit and TAP counts plus required names checked; [E1534S1-19.log](E1534S1-19.log); [E1534S1-19.check.txt](E1534S1-19.check.txt); [E1534S1-19-validation.json](E1534S1-19-validation.json) |
| E1534S1-20 | PASS | 8 | nt E1534S1-20 hub/test/host-spend.test.ts; native exit and TAP counts plus required names checked; [E1534S1-20.log](E1534S1-20.log); [E1534S1-20.check.txt](E1534S1-20.check.txt); [E1534S1-20-validation.json](E1534S1-20-validation.json) |
| E1534S1-21 | PASS | 20 | nt E1534S1-21 hub/test/executor-spend.test.ts; native exit and TAP counts plus required names checked; [E1534S1-21.log](E1534S1-21.log); [E1534S1-21.check.txt](E1534S1-21.check.txt); [E1534S1-21-validation.json](E1534S1-21-validation.json) |
| E1534S1-22 | PASS | 17 | nt E1534S1-22 hub/test/suite-accounting.test.ts hub/test/state-paths.test.ts; native exit and TAP counts plus required names checked; [E1534S1-22.log](E1534S1-22.log); [E1534S1-22.check.txt](E1534S1-22.check.txt); [E1534S1-22-validation.json](E1534S1-22-validation.json) |
| E1534S1-24 | PASS | 17 | pl E1534S1-24 hub/test/executor-safety.test.ts; native exit and TAP counts plus required names checked; [E1534S1-24.log](E1534S1-24.log); [E1534S1-24.check.txt](E1534S1-24.check.txt); [E1534S1-24-validation.json](E1534S1-24-validation.json) |
| E1534S1-25 | PASS | 3 | pl E1534S1-25 hub/test/host-provision-gate.test.ts; native exit and TAP counts plus required names checked; [E1534S1-25.log](E1534S1-25.log); [E1534S1-25.check.txt](E1534S1-25.check.txt); [E1534S1-25-validation.json](E1534S1-25-validation.json) |
| E1534S1-26 | PASS | 1 | nt E1534S1-26 hub/test/host-create-entry.test.ts; native exit and TAP counts plus required names checked; [E1534S1-26.log](E1534S1-26.log); [E1534S1-26.check.txt](E1534S1-26.check.txt); [E1534S1-26-validation.json](E1534S1-26-validation.json) |
| E1534S1-27 | PASS | 2 | nt E1534S1-27 hub/test/host-readiness-owner.test.ts; native exit and TAP counts plus required names checked; [E1534S1-27.log](E1534S1-27.log); [E1534S1-27.check.txt](E1534S1-27.check.txt); [E1534S1-27-validation.json](E1534S1-27-validation.json) |
| E1534S1-28 | PASS | 11 | pl E1534S1-28 hub/test/host-create-ready.test.ts; native exit and TAP counts plus required names checked; [E1534S1-28.log](E1534S1-28.log); [E1534S1-28.check.txt](E1534S1-28.check.txt); [E1534S1-28-validation.json](E1534S1-28-validation.json) |
| E1534S1-29 | PASS | 15 | nt E1534S1-29 hub/test/host-destroy.test.ts hub/test/host-provision-records.test.ts; native exit and TAP counts plus required names checked; [E1534S1-29.log](E1534S1-29.log); [E1534S1-29.check.txt](E1534S1-29.check.txt); [E1534S1-29-validation.json](E1534S1-29-validation.json) |
| E1534S1-31 | PASS | 3 | pl E1534S1-31 hub/test/host-destroy-native.test.ts; native exit and TAP counts plus required names checked; [E1534S1-31.log](E1534S1-31.log); [E1534S1-31.check.txt](E1534S1-31.check.txt); [E1534S1-31-validation.json](E1534S1-31-validation.json) |
| E1534S1-32 | PASS | 8 | nt E1534S1-32 hub/test/host-runtime-owner.test.ts hub/test/host-ssh-registry.test.ts; native exit and TAP counts plus required names checked; [E1534S1-32.log](E1534S1-32.log); [E1534S1-32.check.txt](E1534S1-32.check.txt); [E1534S1-32-validation.json](E1534S1-32-validation.json) |
| E1534S1-34 | PASS | 16 | nt E1534S1-34 hub/test/host-pools-config.test.ts; native exit and TAP counts plus required names checked; [E1534S1-34.log](E1534S1-34.log); [E1534S1-34.check.txt](E1534S1-34.check.txt); [E1534S1-34-validation.json](E1534S1-34-validation.json) |
| E1534S1-35 | PASS | 23 | nt E1534S1-35 hub/test/config-set.test.ts; native exit and TAP counts plus required names checked; [E1534S1-35.log](E1534S1-35.log); [E1534S1-35.check.txt](E1534S1-35.check.txt); [E1534S1-35-validation.json](E1534S1-35-validation.json) |
| E1534S1-36 | PASS | 13 | nt E1534S1-36 hub/test/config-reload-component.test.ts; native exit and TAP counts plus required names checked; [E1534S1-36.log](E1534S1-36.log); [E1534S1-36.check.txt](E1534S1-36.check.txt); [E1534S1-36-validation.json](E1534S1-36-validation.json) |
| E1534S1-37 | PASS | 20 | nt E1534S1-37 hub/test/init-config.test.ts; native exit and TAP counts plus required names checked; [E1534S1-37.log](E1534S1-37.log); [E1534S1-37.check.txt](E1534S1-37.check.txt); [E1534S1-37-validation.json](E1534S1-37-validation.json) |
| E1534S1-38 | PASS | 5 | nt E1534S1-38 hub/test/transport-config.test.ts; native exit and TAP counts plus required names checked; [E1534S1-38.log](E1534S1-38.log); [E1534S1-38.check.txt](E1534S1-38.check.txt); [E1534S1-38-validation.json](E1534S1-38-validation.json) |
| E1534S1-39 | PASS | 20 | nt E1534S1-39 hub/test/host-prepare.test.ts hub/test/host-create-admission.test.ts; native exit and TAP counts plus required names checked; [E1534S1-39.log](E1534S1-39.log); [E1534S1-39.check.txt](E1534S1-39.check.txt); [E1534S1-39-validation.json](E1534S1-39-validation.json) |
| E1534S1-41 | PASS | 20 | nt E1534S1-41 hub/test/host-provision-recovery.test.ts hub/test/host-provider-digitalocean-prepare.test.ts; native exit and TAP counts plus required names checked; [E1534S1-41.log](E1534S1-41.log); [E1534S1-41.check.txt](E1534S1-41.check.txt); [E1534S1-41-validation.json](E1534S1-41-validation.json) |
| E1534S1-43 | PASS | 28 | nt E1534S1-43 hub/test/setup-accounts.test.ts hub/test/setup-flow.test.ts; native exit and TAP counts plus required names checked; [E1534S1-43.log](E1534S1-43.log); [E1534S1-43.check.txt](E1534S1-43.check.txt); [E1534S1-43-validation.json](E1534S1-43-validation.json) |
| E1534S1-45 | PASS | 7 | nt E1534S1-45 hub/test/cli-help.test.ts; native exit and TAP counts plus required names checked; [E1534S1-45.log](E1534S1-45.log); [E1534S1-45.check.txt](E1534S1-45.check.txt); [E1534S1-45-validation.json](E1534S1-45-validation.json) |
| E1534S1-46 | PASS | 39 | pl E1534S1-46 hub/test/host-ssh-contract.test.ts; native exit and TAP counts plus required names checked; [E1534S1-46.log](E1534S1-46.log); [E1534S1-46.check.txt](E1534S1-46.check.txt); [E1534S1-46-validation.json](E1534S1-46-validation.json) |
| E1534S1-47 | PASS | 4 | nt E1534S1-47 hub/test/startup-cleanup.test.ts; native exit and TAP counts plus required names checked; [E1534S1-47.log](E1534S1-47.log); [E1534S1-47.check.txt](E1534S1-47.check.txt); [E1534S1-47-validation.json](E1534S1-47-validation.json) |
| E1534S1-48 | PASS | 1 | nt E1534S1-48 hub/test/host-memory.test.ts; native exit and TAP counts plus required names checked; [E1534S1-48.log](E1534S1-48.log); [E1534S1-48.check.txt](E1534S1-48.check.txt); [E1534S1-48-validation.json](E1534S1-48-validation.json) |
| E1534S1-49 | PASS | 23 | nt E1534S1-49 hub/test/test-docs.test.ts hub/test/suite-tiers.test.ts; native exit and TAP counts plus required names checked; [E1534S1-49.log](E1534S1-49.log); [E1534S1-49.check.txt](E1534S1-49.check.txt); [E1534S1-49-validation.json](E1534S1-49-validation.json) |
| E1534S1-50 | PASS | — | mrow p50: empty scratch init writes one hosts table, defaults 3/12h, no pool; hub stopped; immediate isolation gate clean; [E1534S1-50.txt](E1534S1-50.txt) |
| E1534S1-51 | PASS | — | p51 update: counter-scope correction coord ask 5f1dfe6d; exact hosts swap succeeded, verification daily_spend_usd stays init default 5 (config.ts:52); one hosts daily/lease restored, qa pool and codex pin retained; [E1534S1-51.txt](E1534S1-51.txt); [E1534S1-51-table-observation.json](E1534S1-51-table-observation.json) |
| E1534S1-52 | PASS | — | p52 provider and max_hosts writes apply now on same running hub; default agents capacity and updated max_hosts 4 observed; published configuration separately passed row36; [E1534S1-52.txt](E1534S1-52.txt) |
| E1534S1-53 | PASS | — | p53: unknown key, invalid name and short lease refused with exact expected text; empty stdout and unchanged config; [E1534S1-53.txt](E1534S1-53.txt) |
| E1534S1-54 | PASS | — | p54: hub start refuses missing provider and 29s lease with key-specific output; remains down; exact config restore starts hub normally; [E1534S1-54.txt](E1534S1-54.txt) |
| E1534S1-55 | PASS | — | p55: help names --pool (usage exit1 as captured); implementer pool set/list/JSON correct; coordinator remote pool refused and roles file unchanged; [E1534S1-55.txt](E1534S1-55.txt) |
| E1534S1-56 | PASS | — | p56: invalid Coordinator pool reload refused with exact one-line stderr and no stdout; last good roles remain; restore reload succeeds; [E1534S1-56.txt](E1534S1-56.txt) |
| E1534S1-60 | PASS | — | pm: fake ram host ready, 8GiB seed; 1.2GB launch typed memory refusal, exact 1.3GB no floor refusal; later session-forward/cleanup-incomplete error captured but not judged by row; destroy succeeds; [E1534S1-60.txt](E1534S1-60.txt) |
| E1534S1-57 | PASS | — | p57 repeated after identity-checked drain; census correction coord ask 76d4b23b includes fake agent descendant OpenCode; all records settled, three owned processes ended, census0; [E1534S1-57.txt](E1534S1-57.txt); [E1534S1-57-initial.txt](E1534S1-57-initial.txt); [E1534S1-57-settlement.txt](E1534S1-57-settlement.txt); [E1534S1-57-drain.txt](E1534S1-57-drain.txt) |
| E1534S1-58 | PASS | — | s58 after authorized literal alias and dead T-1676 receipt cleanup: head/dev/request match, clean worktree/root unchanged, no preservation lock or alias, TMPDIR only compile cache; [E1534S1-58.txt](E1534S1-58.txt); [cleanup-step1.txt](cleanup-step1.txt) |

## Findings

**Low — found aside, T-1676 (Bugs, existing).** Three dead fixture-owner receipts remained in TMPDIR: PIDs 25075 and 25189 from nvim/test/qa.test.ts (row 16), and PID 49095 from the CLI-started-hub block of hub/test/claude-code-remote.test.ts:660 (row 18). The census found every owner absent, no open receipt or Unix listener, and the per-test fixture roots removed; the shared tested worktree still existed by design. The Claude producer is byte-identical to d8750191 (SHA-256 c3168acf9cae1584c357acde75194a5f4e27ed975678faea3a7933e168c5fd3f); nvim dump producer is identical (3017699fcbe766ba034946596fed647f8929ed551f8454a2d888b5ea209e1fee). Nvim’s only later file change is the T-1759 pool-local expectation; hub CLI, receipt ownership and nvim QA lifecycle sources are unchanged. Under the brief’s carried T-1676 clause, only the three literal receipt paths and empty directory were removed. See [inventory](residue-inventory.json), [producer comparison](residue-producer-comparison.json), [nvim delta](residue-nvim-delta.diff), and [literal removal](cleanup-step1.txt).

No stage product finding remains. Row 57’s live fake OpenCode descendant was classified by the Coordinator’s conditional census correction, then drained with its fake-host parent processes. The trace confirms destroy settled the hub records: no pending cleanup remains after destroy, despite the earlier intermediate error message. See [trace](E1534S1-57-trace.txt), [settlement](E1534S1-57-settlement.txt), [drain](E1534S1-57-drain.txt) and [zero census](E1534S1-57.txt).

## Corrections and limitations

- **kit3 pin correction (coord, ask 9de5178b)**, decision 9a9f12d0-0c87-4cf8-b47f-9997e7866f9c: accepted 3e85f49d635ff2d39ba36ea359e824a802ca65e7 instead of 997909c0c8ac8770cd879e0862816ca22743c939. The sole diff is three added historical-scope prose lines. All five reused heredocs are byte-identical. S0-kit3-pin.diff and S0-kit3-comparison.txt retain both checks. The original extraction block is retained beside the run script. No assertions changed.
- **landing-delta correction (coord, ask ccf550e7)**, decision 063c0b63-e93b-4ab4-8fcf-7a6b4b7ea7e5: row 02 originally reports shared/fake-host-machine.ts differs from the T-1741 branch head 0b2a3f8f. The only difference is T-1735 self-ignore setup merged at 042be2f5: directory mkdir with mode 0700 and .gitignore containing *. Other six compared files are identical; the memory seed is unchanged. Original row and exact diff retained.

Supplemental registration enumeration: the QA-only static parser was extended to expand Object.entries, negative numeric constants, and imported bindings. It executes no tests or source modules. All 45 planned files matched required names and every exact list; expect.json remained unchanged. TAP is checked separately after actual execution.

- **counter-scope correction (coord, ask 5f1dfe6d)**, decision 2538ce2d-fc75-401b-b2d8-98e005fe0078: row 51 whole-file counter included verification.daily_spend_usd, so older-form count was 1 instead of 0. The exact hosts replacement succeeded, verification value stays generated default 5 (config.ts:52), and table-specific read-only observation after update shows exactly one hosts daily_spend_usd=3 and lease=12h, with qa pool and codex 1.0.0 pin retained. No rerun or config edit. Original count kept.

- **census correction (coord, ask 76d4b23b)**, decision 4ff730e1-5563-4721-8fd3-6900418d84e7: row 57 initially saw supervisor 77991, agent 78032 and its fake OpenCode child 78160. The latter is another survivor of fake-machine deletion, under the conditional checks in the decision. Read-only checks confirmed its ancestry, cwd and HOME/XDG/TMPDIR ownership; no session/process/pending-stop/reservation/retirement row remained; host destroyed/released, registration revoked, two confirming reads, no live hub PID or fake SSH master. All three were identity-checked and drained; repeat census is zero. The at-floor launch's later forward refusal is recorded but unjudged as row 60 prescribes. No launch retry occurred.
- Supplemental observation disclosure: the initial settlement probe compared environment paths only against Q/T and missed the validated alias, then tried to read hub.json after hub stop had removed it. Its output is retained in E1534S1-57-settlement-initial.txt. The corrected read-only probe includes exactly the validated alias and checks recorded PIDs/discovery absence; E1534S1-57-settlement.txt supersedes it. No assertions or product state were changed by either observation. The initial false path comparison is not evidence of real-HOME use.

Row 60 proved the actual 1.2 GB typed memory refusal through a created fake host and no memory-floor refusal at 1.3 GB. The admitted launch then failed session forwarding because the kit had no ports.json; fake-ssh.ts:41 requires that map, and transport/ssh.ts:121 retires the master after forward refusal. This later launch outcome is captured, not counted as a successful OpenCode session, and is expressly unjudged by row 60. The native memory/Claude tests separately passed.

## Supporting stage covers

These are Coordinator-owned prior full-stage receipts at this same head and verification tree 88986b4b9377d1880fd57510dbee20808a731569; they are not new QA executions:

- Linux droplet e8a3f44e-06cf-4914-96c9-ff7c9534ee22, A-17636: Finished exit 0, T0–T4 and Web. Linux x64 6.8.0-147-generic, Node v24.21.0, Neovim v0.12.5. Two c-8 lon1 shards: cland-v0-90583ffd, lifetime 2248 s, $0.1561; cland-v0-5d6aa688, lifetime 1675 s, $0.1163. Total $0.2724; measured admission-through-collection wall 2311.83 s. Browser Chrome for Testing 156.0.8078.4, chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell. Nine recorded platform/absent-real-OpenCode skips remain skips, not passes. [Receipt extract](A-17636-summary.txt).
- macOS local 5f39f0a5-a04a-410e-913e-9c367ebd00e1, A-17641: Finished exit 0, T0–T4 and Web; Darwin arm64 27.0.0, same Node/Neovim. Browser binary and version are retained in [provenance](A-17641-summary.txt). Local cost not applicable. The earlier failed macOS A-17640 is not counted as green or waived: its suite-recovery admission failure was filed T-1761; this accepted successor is the supporting result.
- Both covers ran 17 T4 files only in their base phase; T4 repetitions were skipped. Timing budgets/lint/ratchets reported findings in report mode, not enforcement. Projected tier walls are projections, not measured wall times. This QA did not re-run the whole suite or its skipped phases.

Final read: HEAD=dev=request, worktree clean, root non-tracker status unchanged, no preservation lock, fixture alias gone, TMPDIR contains only Node compile cache. Q/T and worktree removal follows verdict as the brief requires. All evidence was scanned with a positive control before publication. Stage verdict carries no epic or child criterion marks.


QA clear: 49 scoped checks, 45 targeted files, 515 tests, no skip/fail/cancel/todo; local macOS only. Full report/evidence A-17643: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17643-e-1534-stage-1-qa-clear-at-c130bac4-49-checks-515-tests/report.md. No epic or child criterion marks.

### qa-678 · 2026-11-08T11:58:15.507Z

verdict: qa
result: not clear
by: qa-678 [qa]
run: qa-e1534s2-2026-11-08-qa678-1
commit: 4688f9566449a15bb2b170b0c7468046df4d3cef
stage: placement on pool hosts, waiting launches, scale up, lease and watchdog
stage_hash: 69777b2affd4d9d0e661a116003041b75c44cc1239b67519663f359bbab7fbaa
findings: [{"severity":"high","text":"E1534S2-55: H1 created for min_hosts lost its lease and was deleted with w1 still recorded running after H2 scaled up; one mirror instead of two. Source omits inUse callback and falls back to min_hosts selection by id. E1534S2-56 dependent two-host proof inconclusive.","file":"hub/src/hub/dispatch.ts","line":550},{"severity":"low","text":"T-1676 found aside: 37 dead/unopened owner receipts after row26; producing tests and ownership helpers unchanged from 4360256ac. Inventoried and removed under carried cleanup rule.","file":"nvim/test/stub-hub.ts","line":45}]
finding_counts: {"high":1,"medium":0,"low":1}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| S0 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/S0-env.txt |
| E1534S2-00 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-00.txt |
| E1534S2-01 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-01.txt |
| E1534S2-02 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-02.txt |
| E1534S2-03 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-03.txt |
| E1534S2-10 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-10.log |
| E1534S2-11 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-11.log |
| E1534S2-12 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-12.log |
| E1534S2-14 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-14.log |
| E1534S2-15 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-15.log |
| E1534S2-16 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-16.log |
| E1534S2-17 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-17.log |
| E1534S2-20 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-20.log |
| E1534S2-21 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-21.log |
| E1534S2-22 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-22.log |
| E1534S2-23 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-23.log |
| E1534S2-24 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-24.log |
| E1534S2-25 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-25.log |
| E1534S2-26 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-26.log |
| E1534S2-30 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-30.log |
| E1534S2-31 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-31.log |
| E1534S2-32 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-32.log |
| E1534S2-34 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-34.log |
| E1534S2-35 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-35.log |
| E1534S2-36 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-36.log |
| E1534S2-40 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-40.log |
| E1534S2-41 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-41.log |
| E1534S2-42 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-42.log |
| E1534S2-43 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-43.log |
| E1534S2-45 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-45.log |
| E1534S2-50 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-50.txt |
| E1534S2-51 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-51.txt |
| E1534S2-52 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-52.txt |
| E1534S2-53 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-53.txt |
| E1534S2-54 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-54.txt |
| E1534S2-55 | hub-api | FAIL | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-55.txt |
| E1534S2-56 | hub-api | INCONCLUSIVE | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-56.txt |
| E1534S2-57 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-57.txt |
| E1534S2-59 | hub-api | PASS | /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/E1534S2-59.txt |

Not clear: E1534S2-55 failed (one lease mirror, expected two); E1534S2-56 is inconclusive for its two-host after-hub-stop proof because H1 was already destroyed at PRE. 37 other checks pass. A-17820 report: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17820-e-1534-stage-2-qa-not-clear-at-4688f956-active-host-lease-expiry/report.md

HIGH: Row55's H1, created by row51 min_hosts startup at 11:49:23.670Z, was deleted at 11:51:01.339Z while w1's process row remained running. H2 was created by row53 max_hosts scaling at 11:50:30.805Z and renewed normally. H1 later had no DB lease, mirror, or watchdog and a confirmed absence receipt; w1's final stored row was running/stopped_at=null/host_retired=0 though its PID was absent. Pool min_hosts=1/max_hosts=2. No host-lease-publication failure found. Read-only source: dispatch.ts:550–558 omits inUse; provision-host.ts:86 falls back to heldByMinimum; provision-records.ts:61–63 selects minimum by id. H1's last renewal/deadline is unavailable, not inferred; no atomic process census was taken at receipt time. H2's after-stop deletion, both absence receipts and 2/2 spend settlements passed, but cannot clear the missing two-host proof.

LOW found aside: T-1676, 37 dead fixture-owner receipts from row26. Every PID absent, no open handle, temporary roots gone; producing tests/helpers byte-identical against 4360256ac (SHA-256 evidence). Per-file directory listings do not pinpoint each receipt to a test; attribution is row26's unchanged producer group. Removed literal directory after drain under brief's carried rule.

Corrections: casing correction (coord, ask 7199f474; decision d9b1c31c) accepts existing [Implementer] display label in row52, with original capture and no retry. Census correction (coord, ask b9c53ce3; decision 0dcf424b) includes spoke95315 in verified fake OpenCode→agent→supervisor ancestry for row57; unchanged TERM drain reaches zero. No product/kit/test/assertion code changed. A supplementary census first matched its ancestor shell; a separate ancestry-filtered observation resolves that diagnostic artifact. Interactive wrapper setpgid warning disclosed in report; row53 facts passed.

Executed locally: macOS arm64 Darwin27.0.0, Node24.21.0, pinned Neovim0.12.5, 51 named files/603 tests, zero fail/cancel/skip/todo, no retries, typecheck and 34 source checks passed. Fresh seals/streaming redaction; positive-control publication scan clean. Serial targeted node --test, no new suite, no duration/resource enforcement, no browser/GUI/provider/harness network or load stress. Cover-quiet/load<=10 gates and preservation lock observed.

Supporting covers at this SHA/tree54908b0b: Linux679622a2/A-17814 (2 shards) and macOS2fffc4ad/A-17818, exit0, T0–T4/Web; T4 repetitions skipped, base17 only; timing/lint report-only, Linux9 skips/macOS1. Chrome Headless Shell1248, Chrome for Testing156.0.8078.4; full binaries/platforms in provenance. Linux shard1 cland-v0-ea5e1185 lifetime2330s/$0.1618, shard2 cland-v0-1404e382 lifetime1730s/$0.1202; total$0.2820. These are supporting cover facts, not this local run's wall time. Local droplet cost not applicable.

Final HEAD=dev=request, clean worktree, root non-tracker unchanged; hub/relay stopped, owned survivors zero, alias removed, only node compile cache remains in TMPDIR. Q/T/worktree cleanup follows verdict. Stage verdict only: no epic or child criterion marks.
