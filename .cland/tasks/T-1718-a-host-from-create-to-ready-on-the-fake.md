---
id: T-1718
kind: task
title: A host from create to ready on the fake provider, and `cland host list`
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1706
  - T-1716
  - T-1710
  - T-1723
topic: topic-1421
branch: t/T-1718-a-host-from-create-to-ready-on-the-fake
created: 2026-11-06T10:48:53.045Z
updated: 2026-11-07T07:02:34.498Z
---

## Summary

`cland host create [<pool>]` (frame `host.create`) takes a host from create to ready. The pool's provider creates a machine from the current pool image, with the prelude as user-data. The hub waits for the pinned key to answer, as its provisioning gate bounded at 5 minutes. It then registers the host and adds it to the running hub, which starts the supervisor and the host agent, opens the tunnel and clones the territory. The host is the `ssh` Host of E-1532 on a provider's machine. `cland host list` shows each host with its pool, provider, size, region, state, uptime and declared price per hour.

Hot files: `hub/src/host/provision-host.ts` (new), `hub/src/host/provider/fake.ts` (the fake host takes its pinned key from the user-data), `hub/src/cli/host.ts`, `hub/src/cli/help.ts`, `hub/src/hub/dispatch.ts` (`host.create`, `host.list`), `hub/src/hub/web-authority.ts`, `hub/test/host-create-ready.test.ts` (new)

## What to build

The create-to-ready sequence with a state per step (`creating`, `booting`, `connecting`, `cloning`, `ready`, `failed`) and the host record's provider, pool, machine id and created time. The fake provider writes the public key from the rendered user-data as the fake host's key, so the pinned-key gate is real. Only the local human CLI or Neovim may call these frames.

Decisions (coord, open questions 3 and 5): `cland host create [<pool>]` stays a local-only command beside the scheduler, and declared prices show in `host list`; E-1534 owns `host status`.

## Acceptance criteria

- [ ] C1. On the fake provider, `cland host create agents` reaches `ready` with the tunnel up and the territory cloned, and a `session.launch` with that `host` runs an OpenCode session on it (test).
  - failed: rev-35 [reviewer] · 2026-11-07T06:41:47.586Z · note Prepopulated fake membership bypasses failed provider identity/status restoration and can still open the rejected host.
- [x] C2. `cland host list` shows that host's id, pool, provider, size, region, state, uptime and the declared live price per hour (test).
  - done: impl-1718 · 2026-11-07T06:12:41.110Z
- [x] C3. A fake machine whose key differs from the one in its user-data is never connected, and after the bounded wait the create ends `failed` and releases the machine (test).
  - done: impl-1718 · 2026-11-07T06:12:42.103Z
- [x] C4. A create on a pool whose image is not current is refused naming `cland host prepare` (test).
  - done: impl-1718 · 2026-11-07T06:12:43.033Z
- [x] C5. `host.create` and `host.list` from a session or a remote are refused, and `cland host --help` lists `create` and `list` (test).
  - done: impl-1718 · 2026-11-07T06:12:43.957Z

## Comments

### impl-1718 · 2026-11-07T05:56:35.255Z

Rule 20 sweep before changes: new additive host.create/list frames touch hub/src/protocol.ts decoder+union, shared/wire/index.ts client union, dispatch local authority, web-authority exhaustive table, cli/host+usage, fixtures/cli-usage/commands.json and cli-help/web-authority/host-secret-admission tests. No existing reply shapes change; old hubs retain unknown-frame refusals. AcquireOptions consumers: provider.ts, fake.ts, digitalocean.ts; host-provider-contract, host-provider-fake/digitalocean and fake volume tests retain optional-field compatibility. Fake key readers: shared/fake-host-machine, fake-ssh-common authenticate, records registerFakeHosts, fixture/ssh-host/transport/native host tests; only acquire with rendered userData changes its public key, legacy acquire/createFakeHost unchanged. Runtime owner consumers: daemon, dispatch, host-runtime-join/owner and registry tests; readiness addition keeps add/remove signatures. Separate provision record avoids changing HostRecord or persisted hosts table. Docs/skills/QA sweep: host-providers, host-agent, ssh-host, hub README, implement skill; existing stage briefs use manual registrations and remain valid. New per-file QA guide will cover new frames.

### impl-1718 · 2026-11-07T06:10:30.559Z

Rule 20 addendum: runtime create registers newly minted host secrets with the daemon's existing remoteOutput registry through optional DispatcherOptions.registerHostSecrets and createHost.registerSecrets callbacks. Daemon is the sole producer; in-process unit dispatchers omit this optional seam. Existing HostSecretStore constructor/registration and record shapes remain unchanged. Same captured registry is used by initial restore, frame redaction and artifact upload scanning.

### rev-35 · 2026-11-07T06:17:24.419Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1718-source-1
commit: 9a369e7220581c4ce8de6f8ee719c11d582ae5a6
scope: full
findings: [{"severity":"high","text":"Failure cleanup treats any fulfilled owner.remove as settlement and releases the machine. Revoke settlement can fulfill with inventoryComplete:false, timedOut:true or retained leftovers. Require positive complete settlement before provider.release; incomplete/unknown results must preserve the machine and durable release:incomplete fence, with held-generation cleanup controls.","file":"hub/src/host/provision-host.ts","line":107},{"severity":"medium","text":"Created fake membership is appended only to this daemon's CLAND_FAKE_HOSTS. A fresh daemon cannot reconstruct the fake address/layout from durable provision/HostRecord data, so the previously ready host fails to reconnect. Restore only owned nonreleased machine membership before runtime opening, preserving host id/address association and avoiding duplicate auto-registrations; test fresh-daemon restart.","file":"hub/src/host/provision-host.ts","line":80},{"severity":"medium","text":"Persisted creating/booting/connecting/cloning records have no startup or later recovery owner; interruption leaves them indefinitely active with no recovery transition. Add identity-bound reconciliation that resumes or conservatively settles known admissions while retaining unknown native outcomes without replay/release authority, and cover crash boundaries.","file":"hub/src/host/provision-host.ts","line":25},{"severity":"medium","text":"After owner.ready awaits clone work, ready state is written without final registration/authority revalidation or an atomic revoke fence. Concurrent host.revoke can cut the HostRecord while the final JSON checkpoint is pending and create still publishes success/ready. Fence the terminal readiness commit against revoke/shutdown and retain a held-boundary regression; never restore revoked authority.","file":"hub/src/host/provision-host.ts","line":101}]
finding_counts: {"high":1,"medium":3,"low":0}

A-17391 complete source review: high incomplete-settlement result ignored before machine release; medium fake membership restore, intermediate provision recovery owner, and atomic final readiness/revoke gaps. Implementer confirms all. C1 failed; C2–C5 runtime-unverified. Additive authority/wire/help migrations reviewed without separate finding. A-17388 original-tool/precommit limits preserved; A-17390 authorized differential is separate, and Coordinator efb591a2 classifies processes.json.new race as pre-existing Bugs/outside item. Fresh committed source request before final-head preservation/verify; after-stage full QA separate.

Criteria: C1 failed (Ready publication is not fenced against revoke, and durable created/intermediate hosts cannot restore/reconcile after fresh-daemon restart.).

### impl-1718 · 2026-11-07T06:18:49.063Z

Before review corrections: new provision record table/checkpoint consumers will be provision-host create/list/recovery, Store construction, HostRecords.revoke, daemon startup (before registerFakeHosts), dispatch's new frames and create-ready/admission/storage tests. Runtime registry.ready gets a final stopped/registration identity check. Existing HostRecord/get/list wire shapes and manually registered fake-host paths remain unchanged. New table replaces only this unmerged item's JSON provision rows; no landed version has emitted them. New regression controls cover fresh env restart/no duplicate, interrupted states retained as failed/incomplete, nonthrowing incomplete settlement, and held revoke/shutdown versus final checkpoint.

### rev-35 · 2026-11-07T06:41:47.586Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1718-source-2
commit: 4639f0cc5bca28c206f410bb34b4f83102b4e31c
scope: full
findings: [{"severity":"medium","text":"Restore initializes membership from existing CLAND_FAKE_HOSTS but never removes a provisioned address when provider identity/status validation fails. Registry's new guard checks only that same membership, so stale/explicit environment membership bypasses failed/incomplete restore validation and still opens the Host/carrier. Fence provision-owned addresses before rebuilding positive membership; cover prepopulated membership with changed/unknown machine identity and zero admissions.","file":"hub/src/host/provision-host.ts","line":122},{"severity":"medium","text":"Held direct create has only a later raw t.after releasing its gate and joining it. Shared tempProject/projectHub cleanup is already registered and can stop the hub/close storage/remove roots first. This direct call is not Dispatcher-owned, so an earlier assertion/setup failure can leave it resuming into disposed state. Prearm ordered resource/pre-stop release/abort+join before admission and verify the actual registered failure cleanup path.","file":"hub/test/host-create-ready.test.ts","line":114}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17404 records two remaining medium findings: stale membership bypasses restore validation, and held direct-create raw after-hook lacks pre-stop release/join ownership. Previous positive settlement, interrupted-state classification and atomic ready/revoke fixes are reviewed/resolved in source. C1 failed; other runtime criteria unverified. A-17402 stable working-tree/native/final-indexed evidence limits retained, no final-head native/configured claim. T-1735 staging race remains external per Coordinator. Fresh committed source review before final preservation/verify; after-stage full QA separate.

Criteria: C1 failed (Prepopulated fake membership bypasses failed provider identity/status restoration and can still open the rejected host.).

### impl-1718 · 2026-11-07T07:02:34.498Z

Rule20 before authorized T-1719 integration (fd73a4e9/32bd03fe): HostProvider createAdmission will be implemented by FakeHostProvider and DigitalOceanHostProvider; production consumers are provider interface/registry, DO.acquire and provision-host.createHost. poolImageKey callers after landing: preparePools, provision-host.createHost, DO acquire/prepare and digitalocean-pool-fixture/prepare tests; unify to one landed implementation. Shared contract suite host-provider-contract runs via host-provider-fake (default/arm64/x64), host-provider-digitalocean, and volume suites; add admission case and effect snapshots at both real factories. Declaration-only test double in host-provider-declarations deliberately invokes only its registered declaration case and is unaffected by new admission case; document/retain. Direct provider consumers: host-provider-volumes, host-provider-digitalocean-volumes, host-prepare, host-create-ready, host-provision-recovery, incoming digitalocean-pool-fixture and host-provider-digitalocean-prepare. Sweep searched interface/import names, acquire/frame/function names, shipped docs/skills/QA/fixtures and all tiers; no web/nvim wire consumer of internal HostProvider interface. Docs host-providers, CLI admission per-file guide and provider contract guides will describe refusal ordering. Existing host.create/list wire frames and older SSH HostRecord shape remain unchanged. T-1734 owns later pool grammar; DO edits limited to admission extraction.
