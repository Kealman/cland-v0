---
id: T-1626
kind: task
title: The droplet executor and the host carrier share one ssh binary selector
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1884
blocked_by:
  - T-1589
topic: topic-1600
branch: t/T-1626-the-droplet-executor-and-the-host
created: 2026-11-02T05:50:22.553Z
updated: 2026-11-17T09:09:03.613Z
---

## Summary

The droplet executor (`executor/droplet/machine.ts`) honours `CLAND_SSH_BIN`/`CLAND_SCP_BIN` without any gate, while E-1532's host carrier selects its binaries through `sshBinaries(env)` (T-1589), which honours them only under the fake-hosts gate. Move the executor onto one selector so both paths share one rule.

## What to build

The executor resolves its `ssh`/`scp` through a shared selector. Its test override keeps working for the executor's own fixtures under an explicit executor-test gate (or the same gate, whichever the executor tests can adopt without editing their assertions), and production never honours the override outside a gate. The executor argv audit doc is updated.

Found by impl-1589 while building T-1589 (topic-1327, 2026-11-02 05:50Z); T-1589 keeps its gate to the new host carrier and leaves the executor unchanged.

## Acceptance criteria

- [x] C1. The droplet executor and the host carrier resolve `ssh`/`scp` through one selector function.
  - done: impl-1626 · 2026-11-17T09:07:13.177Z
  - verified: rev-35 [reviewer] · run rev-35-1626-source-3 · 2026-11-17T09:09:03.613Z · commit dbd8391672e8b544d708bf77dc60559461463761
- [x] C2. Outside its test gate, the executor ignores `CLAND_SSH_BIN`/`CLAND_SCP_BIN` (test).
  - done: impl-1626 · 2026-11-17T09:07:13.318Z
- [x] C3. The executor-contract, executor-droplet, executor-prepare and remote-fixture tests pass with their assertions unchanged.
  - done: impl-1626 · 2026-11-17T09:07:13.585Z
- [x] C4. `docs/executor-argv-audit` names the selector and the gate.
  - done: impl-1626 · 2026-11-17T09:07:13.720Z
  - verified: rev-35 [reviewer] · run rev-35-1626-source-3 · 2026-11-17T09:09:03.613Z · commit dbd8391672e8b544d708bf77dc60559461463761

## Comments

### impl-1626 · 2026-11-17T07:55:01.140Z

Rule 20 consumer inventory before policy change: production readers are host/ssh.ts (sshBinaries) and executor/droplet/machine.ts (raw overrides); latter changes to the shared selector. Direct executor fixture overrides: executor-contract.test.ts, executor-droplet.test.ts (two environments), executor-prepare.test.ts, remote-fixture.ts. All adopt both CLAND_FAKE_HOSTS and CLAND_FAKE_HOST_ROOT, assertions unchanged. remote-fixture importers found across hub/test including scenarios/droplet-verify, executor/demo/suite lifecycle/component tests; shared fixture migration covers them. Host overrides in ssh-host-fixture, transport-contract-fixture, transport-ssh, transport-forwards, host-create-fixture, host-provision-gate and their consumers already follow host membership admission and are unaffected. fake-ssh.test.ts directly covers selector. Searches covered hub/src, hub/test all tiers, nvim/test, web/test, shared, docs and .agents/skills for CLAND_SSH_BIN, CLAND_SCP_BIN, sshBinaries, Machine and remote-fixture. No wire/persisted shape change; old-client wire regression inapplicable. Docs affected: executor-argv-audit and running transport override paragraph. Red T1 executor-contract on macOS arm64 Node 24.21.0: 3 pass/1 fail. Literal failure actual ['untrusted-ssh','untrusted-ssh','untrusted-scp','untrusted-scp'] expected ['ssh','ssh','scp','scp']; no native child or network call.

### impl-1626 · 2026-11-17T07:59:50.733Z

Coordinator decision ff05cb8c: use explicit executor gate CLAND_TEST_EXECUTOR_TRANSPORT=1 plus CLAND_TEST_FAKE_MACHINE_ROOT with scratch ownership marker. Selector validates marker path/contents; fake provider writes it. Real role adapter constructors use shared withoutExecutorTransportOverrides; fixtureEnvironment already drops inherited CLAND_* and retains explicit fixture overlays. Regression checks both filtering paths. Residual risk: a hub started from a shell that deliberately sets both controls and a valid marker can still use fake binaries, the same exposure the fake-hosts gate already has. Initial same-host-gate attempt caused four ENOENT executor/host-key.pub fixture startup failures (10/14 passed); superseded by explicit gate, retained as failed evidence. Production selector importer correction: host carrier is hub/src/transport/ssh.ts, not host/ssh.ts.

### impl-1626 · 2026-11-17T08:00:49.340Z

Full remote fixture consumer list (shared helper migrates gate for all; assertions untouched): hub/test/suite-soak-component.test.ts, hub/test/verification-workers.test.ts, hub/test/demo-release-component.test.ts, hub/test/executor-safety-component.test.ts, hub/test/demo-start.ts, hub/test/executor-reap-confirmation.test.ts, hub/test/dev-t3-search-component.test.ts, hub/test/demo.test.ts, hub/test/close-run-fixture.ts, hub/test/executor-safety.test.ts, hub/test/executor-health.test.ts, hub/test/gateway-secrets.test.ts, hub/test/suite-close-recovery.test.ts, hub/test/state-inventory.test.ts, hub/test/suite-candidate-remote.test.ts, hub/test/suite-remote-process.test.ts, hub/test/remote-scripted.test.ts, hub/test/demo-release.test.ts, hub/test/cover-quiet.test.ts, hub/test/executor-safety-case.ts, hub/test/executor-admission-lock.test.ts, hub/test/suite-close.test.ts, hub/test/executor-deletion-confirmation.test.ts, hub/test/remote-cleanup.ts, hub/test/executor-prepare-retry.test.ts, hub/test/executor-deletion-watchdog.test.ts, hub/test/scenarios/droplet-verify.test.ts, hub/test/suite-hung-component.test.ts, hub/test/remote-fixture-lifecycle.test.ts, hub/test/demo-cap.test.ts, hub/test/executor-snapshot-confirmation.test.ts, hub/test/remote-fixture-parent.ts, hub/test/executor-run.test.ts, hub/test/suite-cover.test.ts, hub/test/demo-provisioning.test.ts, hub/test/suite-selection.test.ts, hub/test/remote-fixture.ts. New shared gate policy consumers also include fake-api marker producer, selector consumer fake-ssh.test.ts (existing host-gate tests unchanged), role constructors adapters/claude-code.ts, codex.ts, opencode.ts using the shared stripping helper. No persisted record readers/startup probes/QA briefs use the new controls yet; docs search results updated at running, argv audit, tests shared guide, host fixture guide, README index. Existing host docs remain accurate for the host gate.

### impl-1626 · 2026-11-17T08:25:58.706Z

Consumer census correction from Reviewer source inspection: hub/src/host/provision-ssh.ts:12 also reads CLAND_SSH_BIN/SCP_BIN directly, called by provision-host.ts:134 for provider bootstrap before the established carrier. Missed in original census; unmodified existing bypass at 6de1673a6. Reported to lead T-1626 as size S Bugs for triage/scope disposition; current head does not prove all SSH paths gated. Constructor filtering also lacks final-overlay protection for restored accountEnv/OpenCode secretEnv; Reviewer consolidating findings, no source/probes changed.

### rev-35 · 2026-11-17T08:32:04.281Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1626-source-1
commit: 6de1673a623c3af8fad50c992ff79571878a7bab
scope: full
findings: [{"severity":"medium","text":"Marker/argv callbacks(:91) await roots before cleanup enrollment and lack body/write joins; fake-api.ts:32 also adds marker write before optional root ownership. Enroll setup/callback owners before acquisition, adopt late/partial roots and join before removal. Lead confirms no owner/disposition (rule12).","file":"hub/test/executor-contract.test.ts","line":61},{"severity":"medium","text":"Constructor-only filtering is undone by later accountEnv/restored/relaunch overlays; Claude:359 and OpenCode:307-309/secretEnv have the same gap. Filter the final Host command/spawn env after all overlays and prove final frames/restored rows. Helper-only test is insufficient; lead/Coordinator confirm (ff05cb8c(a), rules15/20).","file":"hub/src/adapters/codex.ts","line":498},{"severity":"medium","text":"Provider bootstrap remains an independent raw SSH/SCP override reader, omitted from census. It predates this change, but Coordinator4e3bec99 includes it here: shared selector/gates, red regression and provision-host caller census are required at the correction head.","file":"hub/src/host/provision-ssh.ts","line":12},{"severity":"medium","text":"Fake Machine callbacks lack a positively controlled native-launch guard covering setup/body/cleanup. Newly active rule38 applies to this not-yet-cleared head; lead confirms none exists. Include guard/control for existing and forthcoming bootstrap/final-frame fakes; no observed escape claimed.","file":"hub/test/executor-contract.test.ts","line":39},{"severity":"low","text":"Guide and adapters-and-sessions.md:695 still say executor overrides are ungated pending T-1626, contradicting this change. Replace stale statements and qualify preceding host-only gate claim (rule16).","file":"docs/agents/tests/hub-test-fake-ssh.test.ts.md","line":30}]
finding_counts: {"high":0,"medium":4,"low":1}

Full source pass, tree16a0e2adca7922e545ec2a3c5f2e32f32b9fb4af; A-20785. Standards2M/1L, Spec2M. Nominal Machine/host shared selector and marker gate check out; migrated native assertions unchanged. Coordinatorff05cb8c scope/residual risk retained;4e3bec99 requires bootstrap in same item;7dbb57ed confirms final-overlay finding. New rules38-43 apply only to this not-yet-cleared head. A-20760/A-20784 retain target6T1+14/6/16T3+6T4, exact-head lint/typecheck0/122report findings59files, initial red and failed10/14 migration; precommit/hash/raw/signal/scan-control limits explicit, no configured proof. C1-C3 failed, C4 unverified. All findings consolidated; fresh pushed-head source review after fixes before verify. No Reviewer runtime/probe/edit.

Criteria: C1 failed (Coordinator-authorized shared-selector scope now includes provider bootstrap, which remains a raw ungated reader.), C2 failed (Final role launch overlays can restore executor controls, and current fake-only regressions lack required positive launch guards.), C3 failed (New contract callbacks/provider marker setup introduce unjoined acquisition/write lifetimes, so required fixture acceptance remains incomplete.).

### impl-1626 · 2026-11-17T08:39:35.754Z

Consolidated revision consumer census (rule20/41): raw CLAND_SSH_BIN/SCP_BIN readers searched across hub/src, hub/test, shared, web/nvim tests, docs and skills; production raw reader now only sshBinaries. provisionSsh caller: provision-host.ts#createHost. provision-host consumers/importers and function-name readers: hub/dispatch.ts (host create/list/destroy admission), hub/daemon.ts (restore/destroy), host/host-health.ts and host/host-restart.ts (destroy), host/login-add.ts (createHost request dispatch). Tests: host-create-entry, host-create-ready, host-create-admission, host-provision-gate, host-provision-recovery, host-destroy, host-destroy-native, host-restart-reconcile, host-unreachable, host-lease, login-release, login-exclusive, login-exclusive-native, login-write-back, pool-idle-stop, pool-failures, scenarios/integrated-v04, plus new executor-contract bootstrap control. Shared final hostCommandEnvironment consumers: adapters Claude/Codex/OpenCode, host/attach.ts; no intended role-launch path retains executor fixture controls. Agent remoteCommandEnvironment direct users (server/prepared/ref-push) remain unchanged; adapter frames are filtered before reaching them. Frozen CLI-usage fixture/QA/docs have no new control or changed help bytes. Tier history: executor-contract remains T1 (syntax/fake callback/filesystem only); new executor-launch-boundary is T2 actual adapter orchestration with recording Hosts, no borrowed T1 proof. Existing changed executor-droplet/prepare remain T3; remote-fixture-lifecycle remains T4. Bootstrap old host-create-admission test remains T2, updated policy assertions (identity/pins retained). Two guard setup attempts failed before behavioral coverage (custom-symbol redefinition; then positive-control sync rejection); fixed guard now passes and bootstrap red was subsequently observed actual untrusted-ssh/untrusted-scp vs ssh/scp. Final launch local new/restored rows all six red: '1' !== undefined; after fix local six pass, remote extension initially had three fixture failures, then all twelve cases passed with complete remote fakes.

### impl-1626 · 2026-11-17T08:48:59.718Z

Consolidated ownership implementation: fakeOnlyFixture enrolls before allocation, joins entire body/adapter close, and keeps positive callback/custom/sync/native-spawn controls active through removal. setupOwnedDirectory enrolls fake-provider setup before root acquisition and joins pending marker/setup before root disposal; fakeDigitalOcean captures current node:test context before setup or uses explicit testContext, refusing ownerless setup. Partial setup/cleanup failures preserve primary cause in AggregateError. Held marker writer test proves root present during disposal wait and ENOENT only after writer join. Shared final Host filter replaces constructor edits, leaving five production files overall. Docs superseded ungated/pending statements removed, including historical subsystem note and QA descriptions; QA exact selector return-byte guard remains unchanged. Tier manifest new entry sorted. Renamed bootstrap test's old duration baseline removed rather than transferred: new identity has no inherited measured baseline. No suite receipt is borrowed across tier changes; executor-contract stays T1, new launch-boundary T2, existing native tiers unchanged. Full-lint attempts failed on own guard's missing reasoned environment-lint exemption, manifest order and stale duration identity; each corrected; full lint currently rerunning. Those attempts remain failed, not passes.

### rev-35 · 2026-11-17T09:00:45.700Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1626-source-2
commit: b7acdf8e4c24bc74a37433c380df23f83c7e2ce5
scope: full
findings: [{"severity":"medium","text":"New inferred-context/mandatory ownerless refusal changes every shared-provider caller. Coordinator adffef57, reaffirmed8a103932, requires opt-in ownership and explicit context only on affected paths. Remove the blanket requirement, thread the captured owner for affected acquisitions, and keep marker setup joined before disposal. Node24.21 supports getTestContext; API absence is not a finding. No failed acquisition is claimed.","file":"hub/test/fakes/digitalocean/fake-api.ts","line":24}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20796: full source pass at Git tree0cb8a78acaee504df5eb1a5352d8c8776b3f7080,1M Standards/0 new Spec findings. Original M1-M4/L1 otherwise addressed: whole-body/root joins, positive native guard incl custom routes, final-overlay filtering/actual new-restored local-remote adapter frames, bootstrap shared selector and stale docs/census. Exact-head8/12/6 focused passes; candidate native14/6/6/16/8 remain pre-final-adjustment evidence, not final-head proof. Candidate lint/type0,122 report findings59files; failed rounds/provenance limits retained. C1/C4 supported by inspection, C2/C3 await corrected head/configured proof. No Reviewer runtime/probe/edit. Fresh pushed-head source review after consolidated scoped correction, before verification.

Criteria: C3 failed (The shared fixture's new mandatory-owner contract exceeds the Coordinator-approved scope; native acceptance receipts preceded that final adjustment.).

### impl-1626 · 2026-11-17T09:05:31.294Z

Revision dbd839167 removes global inferred-context/mandatory refusal. setupOwnedDirectory enrollment is explicit options.testContext only. Changed executor-droplet acquisitions (13), executor-prepare acquisitions (2), default remote-fixture acquisition pass their owning t before setup; external supplied API and other legacy callers unchanged. Owned marker path remains async and joined; omitted-context marker is synchronous, adding no pending writer or lifecycle requirement. Guarded scripted-provider contract now proves both omitted and explicit ownership. No production edits beyond five previously reviewed files. Full candidate test:lint exit0 (122 report findings/59 files, zero refusals) and typecheck exit0 before commit. Committed head dbd8391672e8b544d708bf77dc60559461463761/tree b5642f627ecfc1b01eb1255cad9dffcc7d26e238; pushed origin; no post-review dev merge. Exact-head native droplet14/14 and prepare6/6 passed; remote-fixture-lifecycle pending in granted native slot.

### rev-35 · 2026-11-17T09:09:03.613Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1626-source-3
commit: dbd8391672e8b544d708bf77dc60559461463761
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20802: full source clearance at treeb5642f627ecfc1b01eb1255cad9dffcc7d26e238. Standards0/Spec0 findings; prior A-20796 scope medium resolved: opt-in explicit contexts on13droplet/2prepare/defaultremote acquisitions, no global inference/refusal, legacy synchronous marker avoids new pending writer. Original assertions unchanged; all5 production files/actual-frame/bootstrap/guard helpers byte-identical to reviewed basis. Exact-head A-20800 local Darwin Node24.21: T3droplet14/14,T3prepare6/6,T4remote-lifecycle6/6,T1contract9/9, each independent exit0/zero fail/cancel/skip. Assembled document SHA256 independently matched9f6f3c62...e968b8c57; not raw-stream hash. Candidate-byte lint/type0 beforecommit/122report59files/zero refusals; previous-head12/12frames+6/6bootstrap remain labelled earlier. Provenance/failure history retained; no configured/Linux/Web/load/QA claim. C1/C4 verified by source; C2/C3 await same-head configured evidence. No Reviewer runtime/probe/edit. Source clearance allows Coordinator window request, not final suite clearance.

Criteria: C1 verified, C4 verified.
