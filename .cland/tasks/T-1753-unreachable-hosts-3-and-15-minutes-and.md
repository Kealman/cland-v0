---
id: T-1753
kind: task
title: "Unreachable hosts: 3 and 15 minutes, and hosts destroyed by anyone"
state: open
status: in progress
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1752
topic: topic-1447
branch: t/T-1753-unreachable-hosts-3-and-15-minutes-and
created: 2026-11-07T16:01:59.872Z
updated: 2026-11-08T18:02:33.064Z
---

## Summary

When a host's tunnel is lost, the reconnect loop runs while its sessions live on, and the hub asks the provider about the machine. A machine reported gone makes the host's sessions exited at once. After 3 minutes down, General gets one line, "host <id> unreachable", and the host's state reads `unreachable`; this is the red state that `cland host list` and `cland host status` show. Back within 15 minutes, the state clears and nothing more is posted. Not back within 15 minutes, its sessions become exited, their roles are vacated, and the hub destroys the host through the confirmed destroy path. The hub also pulls the lease file's deadline to now, so the watchdog is the backstop.

## What to build

Per-host outage timers on the hub clock fed by tunnel status, once-per-outage lines, the 15-minute teardown, and a rate-bounded provider status check on tunnel loss. The 3 and 15 minutes stay fixed constants. The test-only knobs `CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS` shorten them only inside the fake-host fence (`CLAND_FAKE_HOST_ROOT` set), like `CLAND_TEST_DROPLET_*`. A host whose tunnel cannot be re-opened at hub start enters the same clock from the start.

## Acceptance criteria

- [ ] C1. A tunnel down for 3 minutes of hub-clock time posts exactly one General line "host <id> unreachable", and the host reads `unreachable` in `cland host list --json` (test).
  - failed: rev-35 [reviewer] · 2026-11-08T18:02:33.064Z · note Outage replay can warn early; required host list --json is rejected.
- [ ] C2. A tunnel back within 15 minutes clears the state, keeps the sessions running, and posts no second line for that outage (test).
  - failed: rev-35 [reviewer] · 2026-11-08T18:02:33.064Z · note Idle outage-grace hosts can lose their lease before the 15m recovery boundary.
- [ ] C3. A tunnel down for 15 minutes ends the host's sessions as exited, vacates their roles, destroys the host with a confirmed deletion, and moves its lease file deadline to that moment (test).
  - failed: rev-35 [reviewer] · 2026-11-08T18:02:33.064Z · note Premature lease expiry or mirror-publication failure defeats the terminal loss policy.
- [ ] C4. A machine the provider reports gone while its tunnel is down ends its sessions as exited without waiting for the 15 minutes (test).
  - failed: rev-35 [reviewer] · 2026-11-08T18:02:33.064Z · note Mirror-publication failure can block the positive-provider-gone confirmed-destruction path.
- [x] C5. A host whose tunnel cannot be re-opened at hub start starts its outage clock from the start time (test).
  - done: impl-1753 · 2026-11-08T17:52:50.617Z
- [x] C6. `CLAND_TEST_HOST_UNREACHABLE_MS` and `CLAND_TEST_HOST_LOST_MS` shorten the clocks inside the fake-host fence and are ignored without `CLAND_FAKE_HOST_ROOT` (test).
  - done: impl-1753 · 2026-11-08T17:52:50.776Z

## Blocked by

- T-1752

## Notes

- Hot files: `hub/src/host/host-health.ts` (new), `hub/src/host/registry.ts` (tunnel status feed), `hub/src/host/provision-records.ts` (the `unreachable` state), `hub/src/adapters/sessions.ts` (exited path).
- Tests: new `hub/test/host-unreachable.test.ts` (T2, fake transport status and fake clock).
- Serves epic C6.

## Comments

### impl-1753 · 2026-11-08T17:40:08.044Z

Rule-20 sweep before state/API changes: searched ProvisionState, ACTIVE_PROVISION_STATES, provisions.*, projectSshHosts, hostDeleted, HostLeases, host.list and host.status across hub/src, shared, web/src, nvim/lua, shipped skills, qa/briefs and all three test trees. Production consumers: provision-records, records, provision-host/listHosts, host-leases, host-restart, pool-runtime/scheduler selection, status, settle, registry, daemon, dispatch, sessions, adapters/index, cli/host, web-authority, protocol/shared wire. Tests: host-provision-records, pool-scale, host-ssh-contract/host-contract, host-create-ready/admission/fixture, host-runtime-owner, host-readiness-owner, host-ssh-registry, host-secret-admission, host-restart/reconcile, waiting-launch/restart, host-provision-gate/recovery, host-watchdog/loop, host-clone-integration, host-lease, host-records, host-destroy/native, remote-discovery-host, host-status, host-stop, session-pool-placement, web-authority. QA E-1532 stage3, E-1533 stage1/3, E-1534 stage2 reference host frames. Adding unreachable to persisted state while preserving prior record fields; existing consumers accept generic state strings; active/occupied inventory must include it, ready-only placement must exclude it. No frame field removal or membership change planned. Additional sweep results and consumer dispositions will be committed with per-file docs.

### impl-1753 · 2026-11-08T17:43:19.497Z

Additive transition-hook sweep extension: SshOptions/onStatus, HostTunnelStatus and transport/ssh importers found transport-ssh, transport-status, transport-forwards, transport-contract-fixture, ssh-host-fixture, host-revoke-native, host-relaunch-native, host-ref-watch-recovery, host-flush, claude-code-remote, opencode-remote, remote-discovery-host and host-records. Optional hook preserves old construction/wire shapes; registry subscribes to transitions and replays initial registered ready/unreachable states only after daemon restores sessions/leases. QA E-1532 stage2/3/4 and ssh-transport/remote-discovery docs retain their wire shapes.

### impl-1753 · 2026-11-08T18:00:46.302Z

Post-review change plan authorized by Coordinator decisions 5ea5639b, 9cb3a368 and 16e6585d: add an optional default-false outageHold(hostId) input to PoolRuntime.inUse, injected dynamically by Sessions from Health. Both minimum-eligibility sites in pool-runtime.ts change: early row-state guard and candidate filter accept ready/unreachable; placement/member/reserve remain ready-only. T-1749 merge must retain its #stopping condition at both sites. All-host outage grace protects idle hosts, not just current minimum holders. Shared consumers include createHost lease renewal, restoreHostLeaseOwners, daemon loss, Sessions hostInUse, pool scale/minimum reconciliation, forthcoming idle stop, direct PoolRuntime fixture constructors (default callback false) and all placement/waiting tests. Narrow CLI acceptance adds only optional --json to host list (already JSON output), preserving argument refusals and wire frame. Consumers: runHost/bin dispatch, HOST_USAGE and frozen commands.json, CLI help/usage/migration/import tests, host CLI tests/QA docs and existing list/status frame consumers. Registry replay will preserve actual up→down timestamps, and loss publication failure will retain owned retry and proceed to confirmed destroy. Head remains e541d004 pending Reviewer completion.

### rev-35 · 2026-11-08T18:02:33.064Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1753-source-1
commit: e541d004e440bd63aca62ad1118a6f31e580fd9f
scope: full
findings: [{"severity":"medium","text":"Standards: prearm joined fixture ownership before setup awaits. FIFO beforeDirectories closes Sessions/registry/table/base before HostHealth, so early failure can leave health provider/destruction work using disposed owners. The registry fixture likewise awaits owner.add before registering cleanup. Use attempt-all health → sessions → registry → table/base cleanup registered as each owner is acquired.","file":"hub/test/host-unreachable.test.ts","line":154},{"severity":"medium","text":"Spec: replay loses the actual continuous-outage timestamp. An initially up carrier can go down before subscription, but replay backdates that new outage to registry startup, triggering warning/destruction early. Retain transition time per carrier, preserving one time across down/connecting churn; use startup only for initially down carriers.","file":"hub/src/host/registry.ts","line":43},{"severity":"high","text":"Spec: outage grace does not hold the shared lease/idle owner. Idle unreachable hosts fall out of PoolRuntime's ready-only minimum hold and can expire around 3m30 with a 30s lease, before the 15m recovery window (min=0 can expire earlier). Coordinator decision 5ea5639b requires every grace host held in shared hostInUse independently of min/busy, no placement/idle stop, until recovery or terminal Health settlement.","file":"hub/src/host/host-health.ts","line":40},{"severity":"high","text":"Spec: lease mirror publication failure skips primary confirmed destruction. expireNow can stop/join renewal and checkpoint the DB, then throw publishing the mirror; lost never calls destroyHost, while HostHealth has already marked settling and cancelled timers. Preserve the publication diagnostic and still own/attempt confirmed destruction after the DB checkpoint, with a regression through the production loss seam.","file":"hub/src/hub/daemon.ts","line":702},{"severity":"medium","text":"Spec: C1's required host list --json invocation is rejected because list accepts exactly one argument and no earlier normalizer strips the flag. listHosts-only tests bypass this CLI boundary. Accept the narrow documented form and cover the sealed CLI/help consumers.","file":"hub/src/cli/host.ts","line":31}]
finding_counts: {"high":2,"medium":3,"low":0}

Full pinned Standards/Spec review: NOT CLEAR, five findings (2 high, 3 medium), detailed A-17925. C5/C6 remain runtime-unverified; no reviewer runtime execution. Qualified pre-review targeted receipts A-17920 and development excerpts A-17921 retained; no final configured receipt claimed. Implementer confirmed all gaps; Coordinator grace/shared-owner and CLI/loss handling decisions apply. Correct together and request fresh source review before verification. Full after-stage QA remains separate.

Criteria: C1 failed (Outage replay can warn early; required host list --json is rejected.), C2 failed (Idle outage-grace hosts can lose their lease before the 15m recovery boundary.), C3 failed (Premature lease expiry or mirror-publication failure defeats the terminal loss policy.), C4 failed (Mirror-publication failure can block the positive-provider-gone confirmed-destruction path.).
