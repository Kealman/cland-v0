---
id: T-1738
kind: task
title: Pool configuration in `[hosts]` and `[hosts.<pool>]`, hot-reloaded and set with `cland config set`
state: closed
status: done
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
updated: 2026-11-07T21:28:16.544Z
closed: 2026-11-07T21:28:16.544Z
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
  - verified: rev-38 [reviewer] · run rev-38-1738-evidence-2 · 2026-11-07T16:54:52.558Z · commit 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-1 · 2026-11-07T17:19:36.347Z · commit 08960ab54cc5e723b9c8bd27daf7d02596077f0a
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.244Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412
- [x] C2. A pool without `provider` is refused at config read naming `provider`, and `cland config set hosts.qa.provider fake` on a project without that pool writes a valid pool with every other key at its default (test).
  - done: impl-1738 · 2026-11-07T16:19:00.752Z
  - verified: rev-38 [reviewer] · run rev-38-1738-evidence-2 · 2026-11-07T16:54:52.558Z · commit 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-1 · 2026-11-07T17:19:36.347Z · commit 08960ab54cc5e723b9c8bd27daf7d02596077f0a
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.245Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412
- [x] C3. `slots` defaults to 4 for `s-2vcpu-4gb` and 8 for `s-4vcpu-8gb`, `agents` defaults to `min_hosts = 1` and any other pool to 0, and a pool of a size outside the table without `slots` is refused naming `slots` (test).
  - done: impl-1738 · 2026-11-07T16:10:09.119Z
  - verified: rev-38 [reviewer] · run rev-38-1738-evidence-2 · 2026-11-07T16:54:52.558Z · commit 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-1 · 2026-11-07T17:19:36.347Z · commit 08960ab54cc5e723b9c8bd27daf7d02596077f0a
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.245Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412
- [x] C4. A `lease` shorter than 30 s is refused naming `hosts.lease` (test).
  - done: impl-1738 · 2026-11-07T16:19:01.966Z
  - verified: rev-38 [reviewer] · run rev-38-1738-evidence-2 · 2026-11-07T16:54:52.559Z · commit 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-1 · 2026-11-07T17:19:36.347Z · commit 08960ab54cc5e723b9c8bd27daf7d02596077f0a
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.245Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412
- [x] C5. `cland init` writes `[hosts]` with `daily_spend_usd = 3` and `lease = "12h"` and no pool, and `cland update` adds it to a managed config that lacks it, keeping existing pools and harness pins (test).
  - done: impl-1738 · 2026-11-07T16:10:11.195Z
  - verified: rev-38 [reviewer] · run rev-38-1738-evidence-2 · 2026-11-07T16:54:52.559Z · commit 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-1 · 2026-11-07T17:19:36.347Z · commit 08960ab54cc5e723b9c8bd27daf7d02596077f0a
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.245Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412
- [x] C6. On a running hub, `cland config set hosts.agents.max_hosts 4` answers "applies now" and the hub's published pool configuration holds 4 without a restart (test).
  - done: impl-1738 · 2026-11-07T16:10:12.987Z
  - verified: rev-38 [reviewer] · run rev-38-1738-evidence-2 · 2026-11-07T16:54:52.559Z · commit 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-1 · 2026-11-07T17:19:36.348Z · commit 08960ab54cc5e723b9c8bd27daf7d02596077f0a
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.245Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412
- [x] C7. `cland config set` refuses an unknown pool key and an invalid pool name, naming the allowed keys and characters (test).
  - done: impl-1738 · 2026-11-07T16:10:13.269Z
  - verified: rev-38 [reviewer] · run rev-38-1738-evidence-2 · 2026-11-07T16:54:52.559Z · commit 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-1 · 2026-11-07T17:19:36.348Z · commit 08960ab54cc5e723b9c8bd27daf7d02596077f0a
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.245Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412
- [x] C8. `cland host prepare` and `cland host create` give unchanged results on their existing tests.
  - done: impl-1738 · 2026-11-07T20:47:44.160Z
  - verified: rev-38 [reviewer] · run rev-38-1738-delta-3 · 2026-11-07T20:49:10.246Z · commit 72d21ebc6d370c426006ec0570838cd3599b3412

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

### impl-1738 · 2026-11-07T16:25:28.301Z

Review correction consumer sweep: new HostConfigurationError changes readProjectConfig startup refusal behavior for its two production consumers, hub/daemon.ts and init/provision.ts. daemon.ts direct test importers: account-fixture-isolation (T4), fake-harness (T2), journal-async (T3), orphan-servers (T3), suite-coverage (T3), startup-cleanup (T2), territory-lock (T3), tracker-ready-native (T3). T2 pair passed 10/10 at corrected head e3c911e0; native/T4 six queued for follow-up preservation slot. QA retained-consumer disposition: completed-epic E-1533, E-1533-stage-2/-3 and E-1538-stage-1/-2 briefs now explicitly historical pre-T-1738 build only; current setup must edit generated hosts table and supply provider/custom-size slots. Provider docs example migrated.

### rev-38 · 2026-11-07T16:33:09.306Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1738-source-3
commit: 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at3716f1fc8 with retained full product review. Only frozen CONFIG_USAGE gains exact3 intentional hosts lines, plus CLI-help guide note; other command blocks/assertions unchanged. Resolves A-17509 failed help-fixture consumer; prior startup/table/doc corrections unchanged. A-17511 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17511-t-1738-help-fixture-source-review-at-3716f1fc8.md). Standards/Spec0findings. Criteria marks:none; C1-C8 unverified pending same-head configured and directed native/importer evidence. Old A-17509 remains failed T1; attempted old-head evidence verdict returned error and was not retried/recorded (assessment retained A-17510 and lead report). No Reviewer execution. Source is clear for verify at this new head.

### rev-38 · 2026-11-07T16:54:52.559Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1738-evidence-2
commit: 3716f1fc8e8db52f6f0ebe3235c7e2b67d86de1c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged source-reviewed3716f1fc8; no findings; C1-C8 verified. A-17522 configured92ca0213 passes5426/5426,0fail/cancel/skip/todo,T0/allT1/fallback-allT2/Web; exact task.verify/branch/provenance match,uncached tree609c919c8c3b43905877f5c27bcf00e4f26fdd93. Linuxx64droplet c-8lon1 Node24.21/Nvim0.12.5,isolated HeadlessShell1248/CfT156.0.8078.4. Independently checked required parser/default/invalid-field,provider-first CLI,lease,startup refusal,managed init/update,live publication,grammar and table-replacement base/load facts plus corrected help fixture. C8 existing prepare/create-admission pass configured; original native create-ready11/11 at e3c911e0 has identical host runtime/test bytes across final help-only delta. A-17524 originals verify final9native importers78/78,exit0; linkage/tier/carry limits in A-17525 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17525-t-1738-final-evidence-review-at-3716f1fc8.md). Original mixed-head suite-cancel7/8 remains failed; solo8/8 and Coordinatorffc6b69d explicit nonblocking T-1758 decision retained. Old configured A-17509 remains failed. T3 merge-batch/fullT4 and after-stage affectedQA separate; advisories report-only. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### rev-38 · 2026-11-07T17:19:36.348Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1738-delta-1
commit: 08960ab54cc5e723b9c8bd27daf7d02596077f0a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear at08960ab54,parents3716f1fc8/d87501912. Coordinator da51daf6 explicitly authorized merge after T-1740, two docs conflict resolutions, root typecheck and carrying92ca0213 without rerun. Compared both parent diffs: README retains one Host providers line naming both pool/scheduler; host-providers retains complete config and milli-slot placement sections/custom-size example. Task runtime modules identical to3716; incoming pure scheduler/test/docs unchanged vs dev parent and not wired into production callers yet. Tier/index union retained. A-17538 root merged-head typecheck completed exit0 per native receipt,macOSarm64Node24.21; no Reviewer execution. C1-C8 refreshed via unchanged reviewed task source +explicit Coordinator carried A-17522/A-17525/A-17524 evidence;92ca0213 actually ran at3716f1fc8,not merge head. No new configured pass claimed. T-1758 exception/failures retained; after-stageQA/fullT3/T4 separate. Findings:none. A-17539 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17539-t-1738-authorized-merge-delta-at-08960ab54.md).

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### rev-38 · 2026-11-07T20:47:07.331Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1738-delta-2
commit: 0207f7e045a3ba5ab380fcac986c17e829464151
scope: delta
findings: [{"severity":"medium","text":"Incoming settings literal has only4fields but expanded HostPool requires slots,minHosts,maxHosts,idleStop,idleStopMs,spread; merged-head typecheck reports TS2740. Migrate through shared readHostPools with explicit custom-size slots, keep assertions, review new head and pass required checks before evidence carry.","file":"hub/test/host-provision-gate.test.ts","line":68}]
finding_counts: {"high":0,"medium":1,"low":0}

Final merge delta not clear at0207f7e0,parents08960ab54/10b63fc8. Manual docs retain both lanes; parsed help fixture CONFIG_USAGE equals ours,ROLE_USAGE equals dev,other blocks equal dev. Incoming runtime merge automatic, but one medium missed consumer: host-provision-gate.test.ts:68 HostPool literal lacks6new fields; reported root typecheck TS2740 independently confirmed by source shape. C8 failed; C1-C7 unrefreshed. Coordinator54fe5ab7 carries prior92ca0213 only with docs/fixture conditions and successful required merge checks; typecheck red does not satisfy them. Reported help8/8 and lease1/1 do not override failure. Full delta A-17624 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17624-t-1738-final-merge-delta-blocked-by-hostpool-fixture.md). No Reviewer execution/new configured pass.

Criteria: C8 failed (Integrated host-create settings consumer host-provision-gate.test.ts:68 fails root typecheck TS2740 at merged head; shared-parser fixture migration required.).

### rev-38 · 2026-11-07T20:49:10.246Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1738-delta-3
commit: 72d21ebc6d370c426006ec0570838cd3599b3412
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final integration delta clear at72d21ebc6; resolves delta-2,findings[]. Both manual docs retain all lanes; independent fixture parse confirms CONFIG_USAGE matches own parent,ROLE_USAGE incomingdev,all other blocks incomingdev. Runtime merge automatic; task parser/settings code unchanged. Sole fixture commit supplies first custom-size slots8 and third-case settings via shared readHostPools; all assertions/bounds retained. A-17625 originals checked: final-head root typecheck exit0;help+compatibility8/8 exit0;targeted host-provision-gate alone3/3 exit0 under preservation lock;zero fail/cancel/skip/todo. Lease29s command exit1 key-specific at0207,identical production code finalhead. Prior0207 TS2740/pre-fix2/3 retained red. Coordinator54fe5ab7/bea2cada/3f776206 explicitly authorize semantic fixture correction and prior92ca0213 carry with these checks. C1-C8 refreshed via retained reviewed evidence A-17525/A-17524 +new integration receipts;92ca0213 actually ran3716f1fc8,not finalhead,no new fullverify claimed. macOSarm64Node24.21 local/no browser for new checks;configured Linux provenance remains priorhead. Full delta A-17626 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17626-t-1738-final-integration-delta-clear-at-72d21ebc6.md). No Reviewer execution;after-stageQA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-11-07T20:49:40.915Z

Rule 6/7 carry (coord): enqueued at integration head 72d21ebc. Verify 92ca0213 passed at 3716f1fc. Since then: a docs-only merge (08960ab5), then a final dev merge 0207f7e0. That merge resolved two docs conflicts and auto-merged README and the CONFIG_USAGE/ROLE_USAGE fixture; cli-help and cli-usage-compatibility pass 8/8. The integration fixture fix at 72d21ebc touches only hub/test/host-provision-gate.test.ts (T-1737's new test, to the new HostPool type and required slots), with assertions unchanged: red before the fix at 0207f7e0, then 3/3 alone under the preservation lock. Delta review clear at 72d21ebc; coord ran typecheck exit 0 at 72d21ebc.

### coord · 2026-11-07T21:28:16.544Z

Merged 5a359016d2860395373f840759aec83baa67bbde onto dev.
