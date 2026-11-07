---
id: T-1738
kind: task
title: Pool configuration in `[hosts]` and `[hosts.<pool>]`, hot-reloaded and set with `cland config set`
state: open
status: review
size: M
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
topic: topic-1428
branch: t/T-1738-pool-configuration-in-hosts-and-hosts
created: 2026-11-07T16:01:56.769Z
updated: 2026-11-07T16:20:05.724Z
---

## Summary

`[hosts]` gains `daily_spend_usd` (default 3), `lease` (default `"12h"`, at least 30 s) and an optional `weights` override, beside the existing `harnesses` pins. `[hosts.<pool>]` gains `slots`, `min_hosts`, `max_hosts`, `idle_stop` and `spread` beside `provider`, `size`, `region` and `transport`. `provider` is required; every other pool key has a default. The pools become part of the hub's published configuration, so a `cland config set hosts.<pool>.<key>` applies at once. `cland init` writes `[hosts]` with no pool, and `cland update` adds it to existing projects.

## What to build

One parser for the whole hosts table, with refusals that name the key. The defaults:
- `size = "s-4vcpu-8gb"`, `region = "lon1"`, `transport = "ssh"`;
- `slots` from the size table: `s-2vcpu-4gb` = 4, `s-4vcpu-8gb` = 8; a size outside the table needs `slots`;
- `min_hosts`: 1 for `agents`, 0 for any other pool;
- `max_hosts = 2`, `idle_stop = "20m"`, `spread = false`.

`provider` has no default: a pool without it is refused at config read, naming the key. A pool table therefore starts with `cland config set hosts.<pool>.provider …`. `configKeys()` learns the `hosts.<pool>.<key>` pattern for valid pool names and pool keys. `ProjectConfig` carries the pools, so hot reload publishes them. `outbound` stays refused, as T-1623 left it. `readHostPools` keeps its exported name and return shape, extended additively, so its callers need no edit.

## Acceptance criteria

- [x] C1. `[hosts]` `daily_spend_usd`, `lease` and `weights`, and `[hosts.<pool>]` `size`, `region`, `slots`, `min_hosts`, `max_hosts`, `idle_stop`, `spread` and `transport` parse with the defaults above, and each invalid value is refused naming its key (test).
  - done: impl-1738 · 2026-11-07T16:18:59.556Z
- [x] C2. A pool without `provider` is refused at config read naming `provider`, and `cland config set hosts.qa.provider fake` on a project without that pool writes a valid pool with every other key at its default (test).
  - done: impl-1738 · 2026-11-07T16:19:00.752Z
- [x] C3. `slots` defaults to 4 for `s-2vcpu-4gb` and 8 for `s-4vcpu-8gb`, `agents` defaults to `min_hosts = 1` and any other pool to 0, and a pool of a size outside the table without `slots` is refused naming `slots` (test).
  - done: impl-1738 · 2026-11-07T16:10:09.119Z
- [x] C4. A `lease` shorter than 30 s is refused naming `hosts.lease` (test).
  - done: impl-1738 · 2026-11-07T16:19:01.966Z
- [x] C5. `cland init` writes `[hosts]` with `daily_spend_usd = 3` and `lease = "12h"` and no pool, and `cland update` adds it to a managed config that lacks it, keeping existing pools and harness pins (test).
  - done: impl-1738 · 2026-11-07T16:10:11.195Z
- [x] C6. On a running hub, `cland config set hosts.agents.max_hosts 4` answers "applies now" and the hub's published pool configuration holds 4 without a restart (test).
  - done: impl-1738 · 2026-11-07T16:10:12.987Z
- [x] C7. `cland config set` refuses an unknown pool key and an invalid pool name, naming the allowed keys and characters (test).
  - done: impl-1738 · 2026-11-07T16:10:13.269Z
- [x] C8. `cland host prepare` and `cland host create` give unchanged results on their existing tests.
  - done: impl-1738 · 2026-11-07T16:10:14.219Z

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/init/config.ts`, `hub/src/init/config-set.ts`, `hub/src/host/transport-config.ts` (replaced by `hub/src/host/pools.ts`), `hub/src/hub/configuration.ts`, `hub/src/cli/config.ts`, `hub/test/host-pools-config.test.ts` (new). Callers of `readHostPools` (`provision-host.ts`, `pool-image.ts`, `executor/droplet/droplet.ts`) are not edited.
- Tests: `host-pools-config.test.ts` (T1, new); `config-set.test.ts` (T2, edit); `init`/`update` rendering tests (T1, edit).
- Serves epic C1. Retires the note "E-1534 owns the rest of the hosts table" in `transport-config.ts`.

## Comments

### impl-1738 · 2026-11-07T16:04:19.939Z

Rule 20 pre-change sweep: readHostPools consumers provision-host.ts, provider/pool-image.ts and executor/droplet/droplet.ts retain imports via transport-config compatibility re-export and existing fields; parseConfig/defaultConfig/renderConfig consumers across hub, CLI, web status, config/init/update/setup/auth tests gain additive hosts projection. Searched hosts fields, transport-config, readHostPools, [hosts] across src/test/docs/.agents/shared. Fixtures needing explicit slots for custom sizes: host-create-fixture, host-create-admission, host-provision-recovery, digitalocean-pool-fixture, host-prepare, host-provider-digitalocean-prepare, config-preservation; transport-config tests migrate interim permissive expectations to full validation. Docs consumers host-providers, host-agent, config command and parser test guides will be updated. No wire fields removed; old status clients ignore additive hosts and new clients do not require it. Parser/config rendering/config-set seams are specified by ticket; tests proceed there.

### rev-38 · 2026-11-07T16:14:29.130Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1738-source-1
commit: 52c2344d173c0b30ca276c1ea2dcb2300b2f3bba
scope: full
findings: [{"severity":"medium","text":"New hosts provider/lease/capacity/global-policy validation errors miss the startup-fatal classifier; readProjectConfig returns null and the daemon silently uses the entire default config instead of refusing the configured policy. Keep key-specific refusals through startup with a shared classifier.","file":"hub/src/hub/daemon.ts","line":220},{"severity":"medium","text":"New weights/harnesses table replacements are rendered against original via recursive merge, restoring omitted entries. Setting weights from {codex=2,opencode=3} to {codex=1} retains opencode; {} retains all old overrides/pins. Replace the addressed validated table while preserving unrelated fields; test subset/empty persisted and published readback.","file":"hub/src/init/config-set.ts","line":80},{"severity":"medium","text":"Retained size=fake example lacks newly required slots. Executable QA consumers still append a duplicate [hosts] after init and omit custom-size slots (E-1533 stage2:664/stage3:708, reused by epic demo:405); migrate current consumers or record explicit historical pinned-build dispositions and name them in the inventory.","file":"docs/hub/host-providers.md","line":282}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear at52c2344d1 against79b350ec5. Three medium findings: daemon.ts:220 new hosts validation errors silently load defaults; config-set.ts:80 subset/empty weights or harnesses replacements resurrect old entries through renderConfig's recursive source merge; host-providers.md:282 and QA consumers retain now-invalid custom-size/duplicate-hosts examples. Standards:1medium; Spec:2medium. Full evidence/reproducing input paths and fixes in A-17492 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17492-t-1738-full-source-review-at-52c2344d1.md). Failed C1/C2/C4 for startup refusal integration; all other criteria unverified. No Reviewer execution; importer/preservation reports remain partial evidence. Fresh source review required after correction before verification.

Criteria: C1 failed (New hosts invalid-value errors fall through daemon startup to built-in defaults rather than refusing the configured policy.), C2 failed (Missing provider is refused by the parser but swallowed by the hub startup fallback classifier.), C4 failed (hosts.lease below30s is swallowed by hub startup fallback instead of retaining the required refusal.).

### rev-38 · 2026-11-07T16:20:05.724Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1738-source-2
commit: e3c911e078c971894ce2ff5f350af3914e172d34
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at e3c911e0, resolving all3 medium findings from source-1. Shared HostConfigurationError now survives readProjectConfig instead of whole-config fallback; daemon no longer duplicates hosts classification. Config-set renders edited candidate source, keeping removed weights/pins absent; new CLI persisted/readback and live-owner subset/empty regressions cover it. Provider example has slots, superseded text replaced, and5 prior QA briefs explicitly confined to historical pre-T-1738 builds/current migration requirements. Standards/Spec0 findings; full corrected review A-17505 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17505-t-1738-corrected-source-review-at-e3c911e0.md). No criteria verified: C1-C8 require corrected-head runtime evidence. Ongoing mixed-head native sweep and suite-cancel failure are partial/failed evidence, not a green aggregate; keep authorized diagnosis/retry labelled. No Reviewer execution. Verification may run at this head.
