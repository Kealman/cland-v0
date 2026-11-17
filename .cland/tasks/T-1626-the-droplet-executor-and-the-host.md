---
id: T-1626
kind: task
title: The droplet executor and the host carrier share one ssh binary selector
state: closed
status: done
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
updated: 2026-11-17T11:51:53.712Z
closed: 2026-11-17T11:51:53.712Z
---

## Summary

The droplet executor (`executor/droplet/machine.ts`) honours `CLAND_SSH_BIN`/`CLAND_SCP_BIN` without any gate, while E-1532's host carrier selects its binaries through `sshBinaries(env)` (T-1589), which honours them only under the fake-hosts gate. Move the executor onto one selector so both paths share one rule.

## What to build

The executor resolves its `ssh`/`scp` through a shared selector. Its test override keeps working for the executor's own fixtures under an explicit executor-test gate (or the same gate, whichever the executor tests can adopt without editing their assertions), and production never honours the override outside a gate. The executor argv audit doc is updated.

Found by impl-1589 while building T-1589 (topic-1327, 2026-11-02 05:50Z); T-1589 keeps its gate to the new host carrier and leaves the executor unchanged.

## Acceptance criteria

- [x] C1. The droplet executor and the host carrier resolve `ssh`/`scp` through one selector function.
  - verified: rev-35 [reviewer] · run rev-35-1626-source-3 · 2026-11-17T09:09:03.613Z · commit dbd8391672e8b544d708bf77dc60559461463761
  - verified: rev-36 [reviewer] · run rev-36-1626-delta-1 · 2026-11-17T09:29:22.595Z · commit b052e6ba2f5f04f9ef2e1a324b7ac4a4a4a380be
  - done: impl-1626 · 2026-11-17T10:23:09.820Z
  - verified: rev-36 [reviewer] · run rev-36-1626-delta-2 · 2026-11-17T10:27:04.417Z · commit 1e2341be7639a116fbe4ccfebb71811b03d99ed5
  - verified: rev-36 [reviewer] · run rev-36-1626-final-1 · 2026-11-17T10:57:30.036Z · commit 1e2341be7639a116fbe4ccfebb71811b03d99ed5
- [x] C2. Outside its test gate, the executor ignores `CLAND_SSH_BIN`/`CLAND_SCP_BIN` (test).
  - done: impl-1626 · 2026-11-17T10:23:10.134Z
  - verified: rev-36 [reviewer] · run rev-36-1626-final-1 · 2026-11-17T10:57:30.036Z · commit 1e2341be7639a116fbe4ccfebb71811b03d99ed5
- [x] C3. The executor-contract, executor-droplet, executor-prepare and remote-fixture tests pass with their assertions unchanged.
  - done: impl-1626 · 2026-11-17T10:23:10.665Z
  - verified: rev-36 [reviewer] · run rev-36-1626-final-1 · 2026-11-17T10:57:30.036Z · commit 1e2341be7639a116fbe4ccfebb71811b03d99ed5
- [x] C4. `docs/executor-argv-audit` names the selector and the gate.
  - verified: rev-35 [reviewer] · run rev-35-1626-source-3 · 2026-11-17T09:09:03.613Z · commit dbd8391672e8b544d708bf77dc60559461463761
  - verified: rev-36 [reviewer] · run rev-36-1626-delta-1 · 2026-11-17T09:29:22.595Z · commit b052e6ba2f5f04f9ef2e1a324b7ac4a4a4a380be
  - done: impl-1626 · 2026-11-17T10:23:10.928Z
  - verified: rev-36 [reviewer] · run rev-36-1626-delta-2 · 2026-11-17T10:27:04.417Z · commit 1e2341be7639a116fbe4ccfebb71811b03d99ed5
  - verified: rev-36 [reviewer] · run rev-36-1626-final-1 · 2026-11-17T10:57:30.036Z · commit 1e2341be7639a116fbe4ccfebb71811b03d99ed5

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

### impl-1626 · 2026-11-17T09:18:44.626Z

Coordinator attributed sole configured failure to this item, not shared. c314b4b1/A-20809 stopped after T0 green/T1 red; T2/T3/T4/Web did not execute. Literal assertion: 'run node hub/bin/generate-host-agent-closure.ts'. Assertion actual was committed closure hash20e7693f..., expected current source hash87d1f634... (clarifies digest direction in earlier traffic). Generator changed only hub/src/host/agent/closure.json's shared/executor-credentials.ts hash. Committed only that file as b052e6ba2f5f04f9ef2e1a324b7ac4a4a4a380be/tree87c7f8cfede536fe19e7ceddd16995e4f1b56914. Rule41 build/upload consumer: agent/command-environment.ts imports withoutExecutorCredentials from shared/executor-credentials.ts; agent/package.ts lists it as an exact owner-bound shared leaf. code-delivery.ts agentBundle reads closure.json, reads and hashes every named source including credentials, and carries base64 bytes into installAgent's upload; INSTALL_AGENT rechecks hashes and writes/verifies the package. Thus the changed shared module is consumed by actual agent build/upload, not only tests. Exact-head local Darwinarm64 Node24.21 host-agent-closure.test.ts passed5/5 with zero skips; full lint underway, then typecheck/delta review. No rerun/resubmission of c314b4b1.

### rev-35 · 2026-11-17T09:20:21.192Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1626-final-1
commit: dbd8391672e8b544d708bf77dc60559461463761
scope: evidence
findings: [{"severity":"medium","text":"Generated consumer not migrated: executor-credentials source SHA25687d1f634...e2b284f but committed agent closure retains20e7693f...eb359. Shared leaf is consumed by agent/command-environment/package graph. Sole configured T1 failure requires regeneration; Coordinator72903422 attributes to this item and authorizes closure-only delta/new window. Source review missed this consumer (rules16/20/41).","file":"hub/src/host/agent/closure.json","line":185}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20814: FAILED c314b4b1/A-20809 atdbd839167, normtree df03139add6b2187445fc1336b3fc1ed3f7935f5. Structured1796ordinarypass/1fail,223pass/1fail file envelopes;30load passes separate. All224T1completed,T0exit0/T1exit1/Finishedexit1. Sole failure closure test finish2526/file2554; assertion10121 calls generator. Source hash/manifest identities independently checked, exact opposite objects from earlier shorthand: actual assertion=old manifest20e..., expected=new source87d.... T2/selectedT3/T4/Web unexecuted,browsernull; contract ordinary positive1703 does not clear fullrun. LinuxNode24.21/Nvim.12.5uncached, billing282s/$0.0196 notsuitewall,report advisories retained. C3failed/C2pending; sourceC1/C4 do not waive gate. No retry of old round; Coordinator-authorized closure-only correction may continue, then delta review/new window. No Reviewer runtime/probe/edit.

Criteria: C3 failed (Configured acceptance remains incomplete: runc314b4b1 fails stale generated agent closure inT1 before T2/T3/T4/Web execute; named native cases are not claimed failed.).

### rev-36 · 2026-11-17T09:29:22.595Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1626-delta-1
commit: b052e6ba2f5f04f9ef2e1a324b7ac4a4a4a380be
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: clear, zero findings. Spec: clear for the closure-only delta from dbd8391672e8b544d708bf77dc60559461463761 to b052e6ba2f5f04f9ef2e1a324b7ac4a4a4a380be (Git tree 87c7f8cfede536fe19e7ceddd16995e4f1b56914). Uses full source basis rev-35-1626-source-3 / A-20802. Only hub/src/host/agent/closure.json changed: shared/executor-credentials.ts hash now 87d1f63490fe54f160ce8ed5fe0f85f910fd425ef46c2406d0b315a54e2b284f. All 47 entries match raw binary committed blobs; path order/schema and all other source/test/help/fixture/tier bytes are unchanged. Build/upload consumer inspection confirms agentBundle validates these hashes and uploads this graph. C1/C4 static criteria verified using unchanged cleared source plus this corrected packaging metadata. C2/C3 remain unverified pending fresh completed configured evidence at this exact head and Coordinator window. A-20815 local closure 5/5, lint/typecheck tool summaries retain stated provenance limits; reviewer performed no runtime checks. Old configured c314b4b1 / A-20809 remains FAILED/partial at dbd839167, not a pass at this head. Rules 38–43 considered for this pending metadata delta. Full audit and evidence limits: A-20818, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20818-t-1626-closure-only-delta-and-build-upload-hash-audit.md.

Criteria: C1 verified, C4 verified.

### rev-36 · 2026-11-17T09:58:25.576Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1626-evidence-1
commit: b052e6ba2f5f04f9ef2e1a324b7ac4a4a4a380be
scope: evidence
findings: [{"severity":"medium","text":"The changed fake-provider root owner fails its existing queued-issuance drain consumer. A-20824 test finish17276/file17352 and assertion32325 record ENOTEMPTY removing <fake-do root>/executor-state. Replacing ownDirectory's beforeRemove closing guard with setupOwnedDirectory's first dispose hook can initiate api.close/root removal before later admission/storage drainage. Coordinator8bcc34e6 attributes this to T-1626 and requires old/new comparison, exact writer diagnosis, restored drain-before-remove order, queued-issuance red/green regression and full drain-consumer census. Exact writer identity is not established by this review; no reproduction was run.","file":"hub/test/fakes/digitalocean/fake-api.ts","line":32}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20826 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20826-t-1626-failed-volume-drain-consumer-and-partial-configured-receipts.md records FAILED68c159f1/A-20824 atb052e6ba2, Git tree87c7f8cf versus effective verification tree302158c6. Standards1medium; Spec acceptance incomplete. Actual assertion32325: ENOTEMPTY removing fake-do root/executor-state in unchanged volume drain test14; structured test17276/file17352fail. Coordinator8bcc34e6 attributes to this item's root-owner replacement and authorizes old/new comparison/writer diagnosis/order restoration/red-green/full drain census after this hold releases. Exact writer not diagnosed by Reviewer. T0/T1exit0; all224T1pass; T2exit1 with385filepass/1fail/44unexecuted; finalexit1. Ordinary5888pass/1fail, separate95loadtest passes (19identities each5+proof), combined5983pass/1fail, no unmatched/duplicate finishes. Closure5/5 now positive; contract9/final launch12/bootstrap6 positives remain partial. Selected nativeT3/T4/Web unexecuted, browsernull. C3failed/C2pending; staticC1/C4 retained. Known planted ticket-loss/unrelated-output pair27654–55 is separate from actual disposal failure. LinuxNode24.21uncached, report-only advisories/billing scope retained. Oldc314b4b1 remains failed history; no retry/reproduction/edit by Reviewer. Source/helper direct39path drain snapshot and missing transitive census obligation retained.

Criteria: C3 failed (Configured run68c159f1 fails the changed shared fake-provider queued-issuance drain consumer with ENOTEMPTY; selected native T3/T4 acceptance and Web remain unexecuted, not failed tests.).

### impl-1626 · 2026-11-17T10:06:28.739Z

Rule41 complete drain-consumer census for this correction. Direct source references/acquisitions/type consumers (23): hub/test/host-provider-tokens.test.ts, hub/test/suite-dry-run.test.ts, hub/test/executor-admission.test.ts, hub/test/setup-hosts.test.ts, hub/test/executor-safety.test.ts, hub/test/hosts-state.test.ts, hub/test/host-provider-digitalocean.test.ts, hub/test/host-provider-digitalocean-prepare.test.ts, hub/test/executor-contract.test.ts, hub/test/executor-droplet.test.ts, hub/test/executor-deletion-confirmation.test.ts, hub/test/startup-ready-component.test.ts, hub/test/suite-unit-fixture.ts, hub/test/scenarios/integrated-v04.test.ts, hub/test/droplet-fixture.ts, hub/test/executor-prepare.test.ts, hub/test/daemon.test.ts, hub/test/executor-snapshot-confirmation.test.ts, hub/test/doctor-hosts.test.ts, hub/test/executor-prepare-component.test.ts, hub/test/host-provider-digitalocean-volumes.test.ts, hub/test/digitalocean-pacing.test.ts, hub/test/remote-fixture.ts. Conservative reverse literal-relative-.ts graph over hub/test, 12477389 source bytes read, 81 transitive consumers (includes pure/type importers; not claimed executed): hub/test/close-run-fixture.ts, hub/test/cover-quiet.test.ts, hub/test/daemon.test.ts, hub/test/demo-cap.test.ts, hub/test/demo-provisioning.test.ts, hub/test/demo-release-component.test.ts, hub/test/demo-release.test.ts, hub/test/demo-start.ts, hub/test/demo.test.ts, hub/test/dev-t3-search-component.test.ts, hub/test/dev-t3-search.test.ts, hub/test/digitalocean-pacing.test.ts, hub/test/doctor-hosts.test.ts, hub/test/droplet-fixture.ts, hub/test/durations.test.ts, hub/test/executor-admission-lock.test.ts, hub/test/executor-admission.test.ts, hub/test/executor-contract.test.ts, hub/test/executor-deletion-confirmation.test.ts, hub/test/executor-deletion-watchdog.test.ts, hub/test/executor-droplet.test.ts, hub/test/executor-health.test.ts, hub/test/executor-prepare-component.test.ts, hub/test/executor-prepare-retry.test.ts, hub/test/executor-prepare.test.ts, hub/test/executor-reap-confirmation.test.ts, hub/test/executor-recovery-collection.test.ts, hub/test/executor-run-rules.test.ts, hub/test/executor-run.test.ts, hub/test/executor-safety-case.ts, hub/test/executor-safety-component.test.ts, hub/test/executor-safety-load.test.ts, hub/test/executor-safety.test.ts, hub/test/executor-snapshot-confirmation.test.ts, hub/test/host-provider-digitalocean-prepare.test.ts, hub/test/host-provider-digitalocean-volumes.test.ts, hub/test/host-provider-digitalocean.test.ts, hub/test/host-provider-tokens.test.ts, hub/test/hosts-state.test.ts, hub/test/merge-batch-dependencies.test.ts, hub/test/merge-batches.test.ts, hub/test/remote-cleanup.ts, hub/test/remote-fixture-lifecycle.test.ts, hub/test/remote-fixture-parent.ts, hub/test/remote-fixture.ts, hub/test/remote-scripted.test.ts, hub/test/scenarios/droplet-verify.test.ts, hub/test/scenarios/integrated-v04.test.ts, hub/test/setup-hosts.test.ts, hub/test/startup-ready-component.test.ts, hub/test/state-inventory.test.ts, hub/test/suite-accounting.test.ts, hub/test/suite-cache.test.ts, hub/test/suite-candidate-remote.test.ts, hub/test/suite-close-component.test.ts, hub/test/suite-close-recovery.test.ts, hub/test/suite-close.test.ts, hub/test/suite-coordinator.test.ts, hub/test/suite-cover.test.ts, hub/test/suite-dry-run.test.ts, hub/test/suite-duration-budget.test.ts, hub/test/suite-hung-component.test.ts, hub/test/suite-landed-load.test.ts, hub/test/suite-log-backfill.test.ts, hub/test/suite-persistence.test.ts, hub/test/suite-progress.test.ts, hub/test/suite-queue-policy.test.ts, hub/test/suite-queue.test.ts, hub/test/suite-remote-budget.test.ts, hub/test/suite-remote-log.test.ts, hub/test/suite-remote-process.test.ts, hub/test/suite-scheduling.test.ts, hub/test/suite-soak-component.test.ts, hub/test/suite-soak.test.ts, hub/test/suite-stage-cover.test.ts, hub/test/suite-stage-rules.test.ts, hub/test/suite-task-selection.test.ts, hub/test/suite-unit-fixture.ts, hub/test/test-lint-policy.test.ts, hub/test/verification-commands.test.ts, hub/test/verification-workers.test.ts. Shared factory consumers in remote-fixture, suite-unit-fixture and droplet-fixture propagate ordering to this entire set; direct acquisition owners require provider/admission/lease/spend/store drainage before api.close and directory removal. Explicit testContext paths retain original ownDirectory beforeRemove fence; omitted contexts retain manual api.close behavior. The new setup owner only joins allocation/marker setup, never supplants those lifetime owners. Additional manual QA callers: qa/briefs/E-1537-stage-3.md and qa/briefs/E-1538-stage-1.md use context-free API drivers with explicit close and are unaffected (sync marker/manual lifetime unchanged). Searches covered fakeDigitalOcean, its importers, owner helpers, raw close/root removal, test tiers and QA/docs; frozen CLI fixture unaffected (no user-visible command/text change). Only volume contract, provider contract and executor-contract have been executed in this delta so far; remaining consumers deferred to subsequent configured run/batches/occasions.

### rev-36 · 2026-11-17T10:27:04.417Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1626-delta-2
commit: 1e2341be7639a116fbe4ccfebb71811b03d99ed5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20843 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20843-t-1626-minimal-fixture-rollback-and-exact-head-targeted-evidence.md pins1e2341be/tree56cb9de5, two linear commits afterb052e6ba2/no dev merge. Standards0/Spec0 findings. Coordinator382872e8/9fec707b explicitly narrows fixture change; T1941 independently confirms full ownership hardening/caller migration/regressions assigned separately. fake-api versus originale248bca68 is exactly3added marker lines; original ownDirectory/beforeRemove/mkdtemp/API/caller drainage restored, no new context enrollment/setupOwnedDirectory. Removed hardening helper/regression is scoped toT1941; fakeOnlyFixture positive guard/body owner retained. Original volume file/guide byte-identical; native fixture assertion bytes preserved, only required gate env insertions remain versus original. Production selector/filter/shared credential/closure blobs unchanged from clearedb052; tiers/durations/frozenhelp unchanged. C1/C4 verified; C2/C3 await completed configured evidence at this head. A20841 parsed6whole-file sections independently:18+89+8+14+6+6=141named passes, each exit0/zero fail/cancel/skip; granted serial localDarwinNode24.21 native slot released. Full root lint/typecheck reported0/zero refusals122report59files, provenance/raw/static-stream limits retained.81drain consumers mapped at current head with6current positives/rest deferred/reference; old configured failures and intermediate51f82910 failed/incomplete native round remain historical. No Reviewer runtime/edit/probe, configuredLinux/Web/QA/deployment claim or retry waiver.

Criteria: C1 verified, C4 verified.

### rev-36 · 2026-11-17T10:57:30.036Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1626-final-1
commit: 1e2341be7639a116fbe4ccfebb71811b03d99ed5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20849 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20849-t-1626-final-same-head-configured-receipts-and-scoped-native-acceptance.md settles current source plus e8671a60/A-20848 at reviewed1e2341be. Standards0/Spec0 findings; C1–C4verified. Hub passed/Finishedexit0; sourceGit tree56cb9de5 distinguished from uncached verification snapshot a6862629. Independent typed audit:6656ordinary testpass/1platformskip,712ordinary filepasses,90separate loadpasses for18required identities each5+proof; no duplicate/unmatched finishes. All224T1/430T2/55Web, two selectedT3files and one selectedT4guard complete. Required contract8, finalframes12, bootstrap6, closure5, provider89/volume18positive incl formerly failed queued drain. Selected Linux native droplet13pass/1macOSskip and prepare6pass; T4guard1top-level timing/13typed nested passes, no load repetitions. Same-head DarwinA20841 supplies droplet14/prepare6/remote-lifecycle6 including caffeinate; Linux remote-lifecycle file unexecuted and not relabelled. Remaining267T3/16T4unexecuted here. Actual HeadlessShell1248/CfT156.0.8078.4 receipt34710, LinuxNode24.21provenance37283; billing/report-only advisories scoped. Known planted cause pair27599–27600 separate from ownerexit0.81drain paths mapped:53configured-positive,1Darwin-only,19deferred,8helpers. T1941 ownership hardening and all prior failed/intermediate rounds retain dispositions; no retry/deployment/QAclaim. Reviewer only read existing source/receipts; no runtime/edit/merge.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-17T11:51:53.712Z

Merged 1cd9883c0c6c27545aa5c6aa2176a097d9368eff onto dev.
