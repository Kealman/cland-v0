---
id: T-1718
kind: task
title: A host from create to ready on the fake provider, and `cland host list`
state: closed
status: done
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
updated: 2026-11-07T10:45:27.121Z
closed: 2026-11-07T10:45:27.121Z
---

## Summary

`cland host create [<pool>]` (frame `host.create`) takes a host from create to ready. The pool's provider creates a machine from the current pool image, with the prelude as user-data. The hub waits for the pinned key to answer, as its provisioning gate bounded at 5 minutes. It then registers the host and adds it to the running hub, which starts the supervisor and the host agent, opens the tunnel and clones the territory. The host is the `ssh` Host of E-1532 on a provider's machine. `cland host list` shows each host with its pool, provider, size, region, state, uptime and declared price per hour.

Hot files: `hub/src/host/provision-host.ts` (new), `hub/src/host/provider/fake.ts` (the fake host takes its pinned key from the user-data), `hub/src/cli/host.ts`, `hub/src/cli/help.ts`, `hub/src/hub/dispatch.ts` (`host.create`, `host.list`), `hub/src/hub/web-authority.ts`, `hub/test/host-create-ready.test.ts` (new)

## What to build

The create-to-ready sequence with a state per step (`creating`, `booting`, `connecting`, `cloning`, `ready`, `failed`) and the host record's provider, pool, machine id and created time. The fake provider writes the public key from the rendered user-data as the fake host's key, so the pinned-key gate is real. Only the local human CLI or Neovim may call these frames.

Decisions (coord, open questions 3 and 5): `cland host create [<pool>]` stays a local-only command beside the scheduler, and declared prices show in `host list`; E-1534 owns `host status`.

## Acceptance criteria

- [x] C1. On the fake provider, `cland host create agents` reaches `ready` with the tunnel up and the territory cloned, and a `session.launch` with that `host` runs an OpenCode session on it (test).
  - done: impl-1718 · 2026-11-07T08:56:54.487Z
  - verified: rev-36 [reviewer] · run rev-36-1718-final-1 · 2026-11-07T09:26:12.354Z · commit 0bf8670502b807ac8981aa86aa49656b7dd7d9b6
  - verified: rev-36 [reviewer] · run rev-36-1718-merge-1 · 2026-11-07T10:01:59.468Z · commit 76f7b1025954ff827a24ab009a0458ed28d82ff9
- [x] C2. `cland host list` shows that host's id, pool, provider, size, region, state, uptime and the declared live price per hour (test).
  - done: impl-1718 · 2026-11-07T06:12:41.110Z
  - verified: rev-36 [reviewer] · run rev-36-1718-final-1 · 2026-11-07T09:26:12.354Z · commit 0bf8670502b807ac8981aa86aa49656b7dd7d9b6
  - verified: rev-36 [reviewer] · run rev-36-1718-merge-1 · 2026-11-07T10:01:59.468Z · commit 76f7b1025954ff827a24ab009a0458ed28d82ff9
- [x] C3. A fake machine whose key differs from the one in its user-data is never connected, and after the bounded wait the create ends `failed` and releases the machine (test).
  - done: impl-1718 · 2026-11-07T08:56:54.638Z
  - verified: rev-36 [reviewer] · run rev-36-1718-final-1 · 2026-11-07T09:26:12.354Z · commit 0bf8670502b807ac8981aa86aa49656b7dd7d9b6
  - verified: rev-36 [reviewer] · run rev-36-1718-merge-1 · 2026-11-07T10:01:59.468Z · commit 76f7b1025954ff827a24ab009a0458ed28d82ff9
- [x] C4. A create on a pool whose image is not current is refused naming `cland host prepare` (test).
  - done: impl-1718 · 2026-11-07T06:12:43.033Z
  - verified: rev-36 [reviewer] · run rev-36-1718-final-1 · 2026-11-07T09:26:12.354Z · commit 0bf8670502b807ac8981aa86aa49656b7dd7d9b6
  - verified: rev-36 [reviewer] · run rev-36-1718-merge-1 · 2026-11-07T10:01:59.468Z · commit 76f7b1025954ff827a24ab009a0458ed28d82ff9
- [x] C5. `host.create` and `host.list` from a session or a remote are refused, and `cland host --help` lists `create` and `list` (test).
  - done: impl-1718 · 2026-11-07T06:12:43.957Z
  - verified: rev-36 [reviewer] · run rev-36-1718-final-1 · 2026-11-07T09:26:12.354Z · commit 0bf8670502b807ac8981aa86aa49656b7dd7d9b6
  - verified: rev-36 [reviewer] · run rev-36-1718-merge-1 · 2026-11-07T10:01:59.468Z · commit 76f7b1025954ff827a24ab009a0458ed28d82ff9

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

### rev-36 · 2026-11-07T08:52:33.792Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1718-source-1
commit: 8f120815110482642cd67af4fbfe32a28c6d1861
scope: full
findings: [{"severity":"medium","text":"Restore only scans provision rows joined to registered HostRecords, but create publishes the machine address to shared CLAND_FAKE_HOSTS before gate/registration. Pre-registration failed/interrupted/released captured machines therefore escape restore fencing; startup auto-registration may admit the rejected physical address or fail on released key files. Fence all durable provision-owned captured addresses in restore and auto-registration; keep gate-only membership local until intended registration; add no-HostRecord stale-membership controls.","file":"hub/src/host/provision-host.ts","line":122}]
finding_counts: {"high":0,"medium":1,"low":0}

Full corrected/integrated source not clear. Standards0/Spec1medium; claimant confirms remaining gap ad0bbc75. Prior positive settlement, interrupted classification, atomic ready/revoke and registered fixture teardown corrections reviewed/resolved. Joined registered-only restore fixes do not cover no-HostRecord provision-owned addresses. Current-head native preservation/configured verification remain pending; C2/C4/C5 unverified. Source-linked A-17424 development execution is not final-head proof. Full A-17429: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17429-t-1718-full-corrected-source-pre-registration-membership-gap.md. Reviewer reads only.

Criteria: C1 failed (Pre-registration failed/interrupted captured machines are absent from restore ownership query and can be auto-registered from stale environment membership on restart.), C3 failed (A wrong-key retained machine with no intended HostRecord can bypass the provisioning gate through stale-membership physical-address auto-registration.).

### impl-1718 · 2026-11-07T08:52:59.557Z

A-17429 correction consumer sweep before change: provision ownership lookup consumers will be restoreProvisionedFakeHosts (daemon startup before registerFakeHosts) and registerFakeHosts (startup plus configured fake registration). Existing provision callers create/list, HostRecords revoke trigger, runtime registry startup admission remain unchanged. Searched provisions, registerFakeHosts, restoreProvisionedFakeHosts and CLAND_FAKE_HOSTS across production host/daemon, T1 provision-records, T2 recovery, T3 create-ready/runtime tests, host docs/QA guides. Add indexed lookup for captured fake machine id/address, not a retained-history startup scan; no wire/HostRecord shape change. Tests first for failed/interrupted/released no-HostRecord prepopulated membership, direct auto-registration without restore, and independent legacy host positive control. Gate/delivery gets private membership until intended registration persists.

### rev-36 · 2026-11-07T08:58:59.863Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1718-source-2
commit: 0bf8670502b807ac8981aa86aa49656b7dd7d9b6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; Standards0/Spec0. Resolves A-17429 via central indexed captured-id/address ownership for restore and automatic registration, independent of HostRecord/lifecycle state. Gate/delivery membership stays local; shared membership only after intended registration persists. Six no-registration interrupted/failed/released controls cover both boundaries with zero aliases/carriers/Hosts and independent manual positive control; native wrong-key shared-env assertion added. Prior settlement/atomic readiness/teardown/admission fixes unchanged. Read raw61 component and11 native outcomes at functional8433tree; independent diff to0bf onlydurations, so evidence remains source-linked development, not final-head configured proof. Duplicate keys none,8s/9s projection arithmetic correct/report-only. All C1-C5 unverified pending directed final-head preservation/configured result. A-17431: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17431-t-1718-corrected-durable-membership-source-review.md. Reviewer reads only.

### rev-36 · 2026-11-07T09:26:12.354Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1718-final-1
commit: 0bf8670502b807ac8981aa86aa49656b7dd7d9b6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at0bf; C1-C5verified, no findings. Independently matched e8451912/A-17435 overall0,5449pass/0fail/cancel/skip/todo; T0/T1/fallbackallT2/selectedT3/Web0. Native create-ready10 suite identities pass (C1/C2ready/OpenCode/list7.045s, wrongkey1.127s);21 new record/admission/recovery identities each base+5pass (105repetitions), including all6 no-registration fences. Authority17/47 and provider/runtime controls pass. T3fourfiles67identities once/no repetitions, not allT3. Read A-17432 original22/22 native preservation (20top+2nested), exact0bf stable7a7tree/absolutecommand/cwd/Macarm64Node24.21/close0/signalnull. No staged-tree result relabelled. UncachedLinuxx64 c8lon1 Node24.21/Nvim.12.5, Headless1248/CfT156.0.8078.4; T0capture2ced5c8d not repeated remotely; advisories report-only,skipmissing0. A-17436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17436-t-1718-final-create-ready-and-durable-restore-evidence.md. FullafterstageQA/T4/remainingT3/laterrequesteddevmerge separate. Reviewer reads only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-36 · 2026-11-07T10:01:59.468Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1718-merge-1
commit: 76f7b1025954ff827a24ab009a0458ed28d82ff9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear; C1-C5refreshed under independently retrieved Coordinator56f68af8/3f06ca8a carry waiver. Three resolutions retain create/list help+snapshot, shared grammar guidance and local-only skill paragraph. Fixture JSON duplicate-free, other values equal both parents; single-parent-only blobs preserved. Merged decoder+readHostPools use parsePoolName; create admits validated-map own property before paths/provider, list onlydisplays durable labels. Existing createAdmission/private membership/durable ownership guards retained. Read A-17439 directed native0/null typecheck,49/49 components and11/11 native at staged8fb tree matching merge; correctly labelled prior HEAD0bf during precommit execution. Earlier final A-17436/e8451912/A-17435 green5449 and prior22/22 A-17432 carry explicitly, not new76f configured runs. A-17440: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17440-t-1718-pool-parser-merge-delta-and-carried-criteria.md. No findings; fullafterstageQA/remainingcoverage/landingbatch separate. Reviewer reads only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-07T10:03:11.128Z

coord: rule 6 carry, enqueued at 76f7b102.

Verify e8451912 passed at the reviewed head 0bf86705 (A-17435). 76f7b102 merges dev after T-1734 landed. Its manual resolutions keep both sides of `usage.ts`, the cli-usage fixture and `SKILL.md`. The merge also auto-combines T-1718's `createAdmission` with T-1734's pool grammar in `digitalocean.ts`, `fake.ts` and `protocol.ts`.

Checks at the merged head:
- delta review clear (rev-36-1718-merge-1, A-17440);
- typecheck clean;
- usage/help/prepare/admission tests 49/49;
- `host-create-ready` native 11/11;
- the seven provider and grammar files that the T1+T3 batch would not cover, 124/124 one at a time (A-17441).

The verify carries over.

### coord · 2026-11-07T10:45:27.121Z

Merged 142fbe97d8883b44cbc820ca9f0c228d82fcb0a8 onto dev.
