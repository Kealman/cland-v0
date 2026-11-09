---
id: T-1756
kind: task
title: DigitalOcean host creation under the lease, the watchdog and the spend
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1747
  - T-1748
topic: topic-1449
branch: t/T-1756-digitalocean-host-creation-under-the
created: 2026-11-07T16:02:00.451Z
updated: 2026-11-09T08:06:58.734Z
closed: 2026-11-09T08:06:58.734Z
---

## Summary

The DigitalOcean provider drops its blanket E-1534 refusal. A create proceeds when the hub's create path supplies its lease, armed watchdog and hosts reservation, and without them it is refused before any API call, naming what is missing. The SSH and readiness gate becomes provider-neutral: it takes the client key and the known-host material from the provision record, never from the fake host directory or `CLAND_FAKE_HOSTS`, so a DigitalOcean machine can reach it. Tests use the fake DigitalOcean API and a recording `ssh` only; no real droplet is created. A real droplet reaching `ready` stays with the live run of E-1539 (Release v0.4.0).

## What to build

Admission receipts from T-1747 and T-1748 passed through `createAdmission` and `acquire`. A provision record that carries the machine's SSH client identity and pinned host key, with the fake keeping its directory key through the same field. The provider-neutral watchdog of T-1748 deleting a DigitalOcean host through the provider. `docs/hub/host-providers.md` updated to drop the refusal.

## Acceptance criteria

- [x] C1. Against the fake API, a DigitalOcean host create with its lease, armed watchdog and hosts reservation reaches the droplet create, with the pool image and the cland, project and pool tags (test).
  - done: impl-1756 · 2026-11-09T06:54:53.020Z
  - verified: rev-36 [reviewer] · run rev-36-1756-final-1 · 2026-11-09T07:28:22.113Z · commit 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f
- [x] C2. A DigitalOcean create missing any of the three is refused before any API call, naming what is missing (test).
  - done: impl-1756 · 2026-11-09T06:54:53.351Z
  - verified: rev-36 [reviewer] · run rev-36-1756-final-1 · 2026-11-09T07:28:22.113Z · commit 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f
- [x] C3. The SSH gate for a DigitalOcean machine uses the client key and known-host material from the provision record and the machine's address, and never reads a fake host directory or `CLAND_FAKE_HOSTS` (test).
  - done: impl-1756 · 2026-11-09T06:54:53.559Z
  - verified: rev-36 [reviewer] · run rev-36-1756-final-1 · 2026-11-09T07:28:22.113Z · commit 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f
- [x] C4. With the hub stopped, the host watchdog deletes a DigitalOcean host's droplet and key through the fake API at the deadline, each confirmed by a GET (test).
  - done: impl-1756 · 2026-11-09T06:54:53.890Z
  - verified: rev-36 [reviewer] · run rev-36-1756-final-1 · 2026-11-09T07:28:22.113Z · commit 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f
- [x] C5. The fake provider's create-to-ready tests pass through the same provision-record identity with no test edited.
  - done: impl-1756 · 2026-11-09T06:54:54.098Z
  - verified: rev-36 [reviewer] · run rev-36-1756-final-1 · 2026-11-09T07:28:22.113Z · commit 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f
- [x] C6. No code, test or doc still names the E-1534 refusal.
  - done: impl-1756 · 2026-11-09T06:54:54.433Z
  - verified: rev-36 [reviewer] · run rev-36-1756-final-1 · 2026-11-09T07:28:22.113Z · commit 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f

## Blocked by

- T-1747
- T-1748

## Notes

- Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/src/host/provider/provider.ts`, `hub/src/host/provision-host.ts`, `hub/src/host/provision-records.ts`, `docs/hub/host-providers.md`.
- Tests: `hub/test/host-create-admission.test.ts` and `hub/test/host-provider-digitalocean.test.ts` (T2, edit); fake DigitalOcean API only.
- Serves epic C5 and C7 (the production provider path). Its plan lane orders it after T-1752 and T-1753, because it shares `host-watchdog.ts` and `provision-records.ts` with them.

## Comments

### impl-1756 · 2026-11-08T20:39:48.014Z

Rule-20 sweep before changes: searched createAdmission, AcquireOptions/Result, ProvisionRecord/provisions.*, HostWatchdogInput/runHostWatchdog and refusal references across hub/shared/nvim/web/docs/qa/skills. Production consumers: provider/{provider,digitalocean,fake,registry}, provision-host/records, host-watchdog/leases/restart/health/status, pool-runtime, registry, records, hub/{daemon,dispatch}, adapters/sessions. Tests: provider-contract; host-provider-{digitalocean,digitalocean-prepare,fake}; host-{create-admission,create-entry,create-ready,create-fixture,provision-records,provision-gate,provision-recovery,watchdog,watchdog-loop,watchdog-identity,lease,restart,restart-reconcile,unreachable,destroy,destroy-native,stop,status}; pool-{scale,idle-stop}; session-pool-placement; waiting-launch/restart. Docs/brief consumers: host-providers, hub README, waiting-launches, implement skill, E-1533 (+stage3), E-1534 stage1/stage2 briefs, per-file provider/create docs. Additive optional SSH identity preserves old persisted records; machine shape stays unchanged so health/status/sessions/wire clients remain compatible. Watchdog old machine-shaped input remains supported; new admitted input is additive. Provider contract fixture must supply admission rather than bypass production checking. Exact record/deep-equals and transitive test import closure will be checked before ready.

### impl-1756 · 2026-11-08T21:01:00.805Z

Source candidate 7962fbe41 pushed to origin on t/T-1756-digitalocean-host-creation-under-the; C1–C6 implementation done marks recorded. Evidence A-17969 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17969-t-1756-source-candidate-and-validation-evidence-at-7962fbe41/report.md), full graph A-17967. Local macOS/Node24.21: 154 targeted T1/T2 passed; full project typecheck and test:lint exit0, existing report-only findings labelled. Final reviewed-head native+Linux verification outstanding. Early locked native full file was 11/12, corrected locked C3 1/1; out-of-protocol cli-usage-merge excluded and queued for locked rerun.

Coordinator-approved replace-only docs lines at this head (all other shared paragraphs unchanged): docs/hub/host-providers.md 150,151,172,173,221,222,223,310,311,312,315,318,319,320,321,382,383; .agents/skills/implement/SKILL.md 296,297,298; qa/briefs/E-1533.md 11,13,17,73,408,415,424,438; qa/briefs/E-1533-stage-3.md 68,70,85,92,413,561,572,574,575,577,635,638,639,776,784,822,833,873,883,897,938. Historical row ids/table shapes retained, same-line superseded notes included, embedded JSON/JS syntax checked. New item guidance and skill changes note added. Host public rows omit internal ssh identity, so no inbox/session/host frame shape change; no Neovim fixture regeneration required.

Validation decision: all T1/T2 mode-free Linux verify; full T3 Linux merge batch before landing. Final local locked set after clear source: host-create-ready, host-watchdog, host-provision-gate, host-create-entry(T2), host-destroy-native, host-restart, executor-droplet, executor-prepare, executor-safety, qa-lint-build, codex-workspace-git(T4 macOS), system-processes, durations-runner, cli-usage-merge. No real DigitalOcean or browser evidence; no per-item QA request under full/after-stage policy.

### rev-35 · 2026-11-08T21:07:30.270Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1756-source-1
commit: 7962fbe41407f999e9856cc780fc37105ddb98a5
scope: full
findings: [{"severity":"medium","text":"Standards/evidence: the old admission-before-image identity's0.320604 baseline is transferred to a newly titled image-currency refusal with changed behavior/path. No measured migration is approved. Remove the transferred baseline and let the new identity obtain its own ordinary/load evidence, preserving traceability and new-case admission.","file":"hub/test/durations.json","line":11025},{"severity":"high","text":"Spec/admission: acquire's later checks validate only WeakSet-issued frozen snapshot fields and captured deadline, not current lease/watchdog/spend backing. Retirement, shortening or settlement during image/declaration/key awaits can leave a still-issued receipt authorizing provider effects without its required live controls. Introduce an owned/fresh backing-authority boundary across effects and cover each invalidation before API mutation.","file":"hub/src/host/provider/digitalocean.ts","line":130},{"severity":"medium","text":"Spec/ownership: successful importKey followed by droplet POST429/limit422 returns refused while retaining keyId. createHost then installs provider-refused non-acquisition, retires watchdog and cancels spend without guaranteed confirmed key deletion. Confirm key-only cleanup before safe refusal, or retain acquisition/resource ownership and its backstop when cleanup is incomplete.","file":"hub/src/host/provider/digitalocean.ts","line":161},{"severity":"medium","text":"Spec/replay: machine-less watchdog replay requires project/pool/deadline in a receipt, but hub create/destroy cleanup still publishes only root/id/provider/machine. A valid hub-originated absence receipt is rejected on machine-less worker restart. Use a shared bound publication/normalization path and test hub-originated replay without unsafe identity inference.","file":"hub/src/host/host-watchdog.ts","line":58},{"severity":"medium","text":"Spec/C6 migration: host-leases.md still claims DigitalOcean creation remains refused, and qa/briefs/E-1534-stage-1.md:324 still names the deleted blanket-refusal test. No historical exception exists. Migrate these consumers/current expectations, preserving historical row IDs and same-line superseded notes and the edited-line inventory.","file":"docs/hub/host-leases.md","line":8}]
finding_counts: {"high":1,"medium":4,"low":0}

NOT CLEAR: Standards1medium/Spec1high3medium, A-17971. All five author-confirmed findings recorded: live backing authority across acquisition effects; key-only post-import refusal cleanup; shared hub/worker absence receipt format; remaining C6 consumers; invalid duration sample transfer. C3/C5 runtime-unverified. A-17969 candidate/early native/out-of-protocol limits retained; A-17970 supplement inspected, including exact command/completion transcriptions, unknown PID/signal/source limits and corrected9T2+2excludedT3 help split. No provenance-only rerun. Native14/configuredLinux/fullT3batch after fresh source clearance per Coordinator; no real provider evidence. Head clean, no reviewer execution; full after-stage QA separate.

Criteria: C1 failed (Acquisition authority can outlive backing controls; post-import refusal can cancel without confirmed key cleanup.), C2 failed (Frozen issued receipt remains accepted after watchdog/lease/spend invalidation across awaited provider work.), C4 failed (Machine-less watchdog restart rejects valid hub-originated absence receipts; key-only intent has no guaranteed cleanup owner.), C6 failed (host-leases.md retains blanket refusal and E-1534-stage-1 names the deleted test.).

### impl-1756 · 2026-11-08T21:10:15.368Z

Repair shared-contract sweep before edits: host admission issuer/current backing used by provision-host, DigitalOcean acquire, admissionFixture and provider contract tests. AcquireResult refusal consumers include createHost, FakeHostProvider, DigitalOcean provider, provider-contract, pool-runtime retry/error propagation, provider image/volume/pacing fixtures, T3 provision-gate and T-1750's pending acquire handling. Additive optional positive nonAcquisition receipt will be persisted when present, retaining prior no-effect refused compatibility. Key-only recovery adds optional provider releaseAdmission(project,pool,lease,observer) used by machine-less watchdog; old findAdmission/explicit-machine inputs stay supported. Shared receipt publication remains recordHostAbsence, migrated for both hub cleanup callers and worker replay. Invalidation consumers are HostLeases expire/cancel/release, watchdog retirement and host spend settlement/cancellation; new backing checks also cover durable changes outside this process. Tests will cover each stale component before acquire/after declarations/after import; key cleanup confirmation/failure; hub-origin receipt replay. No wire field changes.

### impl-1756 · 2026-11-08T21:24:23.684Z

Repair head fbcccf329 pushed to origin; addresses all five A-17971 findings and Coordinator's live/stopped cooldown owner requirement. Evidence A-17973 report: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17973-t-1756-repair-evidence-and-c6-dispositions-at-fbcccf329/report.md. 199/199 targeted T1/T2 (12 files), full typecheck and test:lint exit0 on repair candidate, known report-only findings labelled; exact producer command/cwd/tier/PID/code/signal/start/close manifests retained. Source linkage remains candidate/precommit, not final reviewed-head verification. No native preservation or configured suite run since source verdict.

Ordering case `DigitalOcean watchdog deletes an admitted droplet after owner closure before machine checkpoint` now observes durable watchdog birth before key import AND droplet POST, then asserts ['key-import','droplet-post']; onCreating precedes arming. Nine invalidation regressions (3 backing components × 3 effect boundaries), confirmed/refused key cleanup, unknown cleanup retained, live/stopped cooldown cleanup, and hub-originated absence replay pass. First authority red shell tailed its log and exited0 despite 9 Node failures; report labels that distinction. Interrupted exploratories and the initial196/197 lease batch are excluded; mirror ENOTDIR cancellation and pre-arm callback ordering fixed before final199/199.

C6 whole-repo strict old-refusal/deleted-title scan0 with original-source positive controls. Every broad hit disposition in A-17973/c6-dispositions.md: digitalocean.ts volume-only policy retained; E-1533-stage-3.md70 current local-only/admission paragraph false-positive; closed tracker T-1719 lines35/59 and E-1533 line476 retained as historical decision/actual-run evidence; T-1756 summary/C6 describe removal, not current refusal. Latest approved shared edits: docs/hub/host-leases.md8–9 only refusal sentence; qa/briefs/E-1534-stage-1.md324 only deleted-title line, same-line superseded JSON note and row identity retained. Removed transferred0.320604 baseline; new identity still needs ordinary/load evidence. New docs/skill change note describe live effect authority and key-only recovery.

Updated transitive graph included: 687 files (77T1/322T2/223T3/13T4/52Web),15 unknowns, inventory only. No dev merge after first source review. Pending fresh review → coordinated native14 → mode-free Linux allT1/T2 and fullT3Linux merge batch before landing; after-stage QA separate.

### rev-36 · 2026-11-08T21:30:10.529Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1756-source-2
commit: fbcccf329f1f570ba6fda6354ac86655487aeae9
scope: full
findings: [{"severity":"high","text":"Spec/admission: hostAdmissionEffect checks backing and AcquireOptions.signal before calling importKey/create, but DigitalOceanApi.#admit can then await its shared budget/cooldown and #send has no per-effect backing callback or this acquisition signal. A queued key/droplet POST can send after lease/watchdog/spend revocation. Revalidate and honor cancellation at actual admitted send, with invalidation controls inside the API wait. Author849bfce5 confirms no omitted fence; Coordinator bcd50eb8 requires this boundary.","file":"hub/src/host/provider/digitalocean.ts","line":149},{"severity":"medium","text":"Spec/recovery: key-only replay requires dropletRefused plus keyId. Hub loss after keyId checkpoint but before POST/refusal checkpoint is rejected; lost import reply has only exact keyName and is also never attempted. findAdmission cannot resolve either without a droplet, so worker only retains/reports. Implement required persisted-id or unique exact-name deletion/GET attempt under Coordinator bcd50eb8. Unresolved non-billable keys may remain reported for T-1765; do not demand guaranteed key disappearance or release spend without positive droplet settlement. Author6333bc8e confirms missing owner.","file":"hub/src/host/provider/digitalocean.ts","line":188},{"severity":"medium","text":"Standards/Test levels: new process-free T2 fixture scripts watchdog birth but omits the lock process table on leases.create, leading reserveHostSpend/acquireLockAsync to native ps probes. New settlement/cancel/worker paths likewise pass only clock. Raw node --test launcher selects tiers without resource instrumentation, so 199/199 does not prove T2 resource compliance. Inject lock processes through these seams and add a no-native/resource-boundary control; authorf6081cc5 confirms no omitted injection.","file":"hub/test/host-admission-fixture.ts","line":24}]
finding_counts: {"high":1,"medium":2,"low":0}

Completed in-progress source verdict under Coordinator pause. Standards1medium/Spec1high1medium; author confirmed all three. Actual API send lacks backing/acquisition-signal revalidation after pacing; worker key-only replay misses pre-POST/lost-import windows; process-free T2 fixture omits lock process injection. Directly read Coordinator bcd50eb8 final bar: bounded key recovery attempts required, unresolved non-billable orphans may remain reported under T-1765 once droplet positively settled; no stronger key completion requirement. Other repaired receipt publication/C6/timing issues source-consistent; C3/C5 runtime-unverified, no criteria verified. A-17973 candidate199/199 retained with precommit/tier-instrumentation limits, not final native/Linux proof. Correct after pause and request fresh source review before already-directed native14/configuredLinux/fullT3batch. No Reviewer execution/edit/delegation. Taking no new reviews until explicit Coordinator resume.

Criteria: C1 failed (Queued provider mutations can send after live backing or acquisition signal changes during API pacing.), C2 failed (Invocation-time validation does not protect actual admitted send after budget/cooldown waits.), C4 failed (Stopped-hub worker skips required known-id/exact-name key recovery attempts in pre-POST/lost-import windows.).

### impl-1756 · 2026-11-09T06:42:00.466Z

Final-bar shared-contract sweep before edits: add optional per-mutation send scope to DigitalOceanApi.create/importKey and private #call/#admit/#send; existing deadline-only callers remain compatible. Production consumers include host provider, executor droplet run/prepare/reap/snapshot/cleanup and mapped DropletDependencies.Provider, direct API tests, fakeDigitalOcean scripted transport, API pacing/endpoint tests, pool preparation and volume fixtures. Search covers create/importKey/deadline/signal/ProviderCall/tokenBudget plus API importers across all tiers; no wire frames change. Provider intent adds explicit postState not-started/pending so new key-only windows have positive droplet-side disposition while old records without that field stay conservative. Optional non-acquisition receipt gains bound orphan information only when droplet never-posted/refused; unresolved keys are reported for T-1765. Watchdog options gain LockProcessTable injection; admission fixture and changed worker/spend tests import one shared scripted lock table, distinct from watchdog native-birth fakes.

### impl-1756 · 2026-11-09T06:55:19.804Z

Final repair head 52f12c657 pushed after Coordinator-authorized origin/dev merge1e7b9d467 (landed T-1750). Boot deadline/checkpoint/notice, typed retry/failed occupancy and scoped GET signal preserved. All C1–C6 done marks restored. A-17992 report/manifests: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17992-t-1756-final-source-repair-pacing-guard-and-resource-proof-at-52f12c657/report.md.

Actual DigitalOceanApi admitted send now owns MutationScope authority+signal after pacing, rechecking shared capacity after async backing reads. Original queued-send red observed1 forbidden key POST versus expected0; eight key/drop × lease/watchdog/spend/signal invalidations inside actual API waits now pass. Exact key-id/name attempts cover pre-POST and lost-import windows; unresolved non-billable orphans remain durable/reported for T-1765 after positive droplet settlement. Unknown POST remains reserved through key cleanup until exact-tag droplet deletion/GET. Optional API scopes/receipt orphan fields remain additive; no public frame change. Exact pre-edit API consumer inventory is A-17992/api-consumers.txt, with production/test family sweep recorded before edits.

Committed-head four-file proof101/101 T2, macOS Node24.21, suite tier bootstrap report-only0 resource findings, native code0/signalnull. The original shell committed/pushed before this run; no source edits followed. Positive pre-injection control caught native lock ps; identical post-injection control has0 findings. WatchdogProcesses and LockProcessTable now injected separately for lease/spend/worker paths. Broader six-file candidate138/138; full typecheck and test:lint exit0, report-only known findings labelled. Unchanged HTTP pacing teardown findings are T-1767 and excluded from own process-free claim. No new case≥3s macOS; no baseline transfer or allowance added. C6 strict old strings0, previous broad-history dispositions retained.

Pending fresh source clearance, native14 under coordinated lock, mode-free configured Linux verification and fullT3Linux batch before landing. Full after-stage QA separate. No native preservation/configured suite or real-provider run since second source verdict.

### rev-36 · 2026-11-09T06:59:24.311Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1756-source-3
commit: 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards0/Spec0. A-17976 three findings resolved under Coordinator bcd50eb8 final bar: actual admitted API send revalidates backing/signal after pacing and rechecks shared capacity; persisted POST phase plus known-id/exact-name worker attempts separate positive no-droplet from unknown POST; allowed non-billable key orphans remain reported for T-1765 without another finding. Distinct lock injection and A-17992 own4file101/101 tier-bootstrap0events/code0/signalnull proof inspected, positive native-ps control retained; broader138/138 excludes T-1767 HTTP teardown from process-free claim. Authorized dev merge preserves T-1750 boot checkpoint/deadline/notice, typed retry/occupancy, scoped GET/status and joined probe. C6/timing repairs retained. Runtime criteria unverified; native14/configured mode-free Linux/fullT3Linux-before-landing still pending per Coordinator, fullafter-stageQA separate. Evidence capture/tree limits retained; no provenance-only rerun or real-provider probe requested. Reviewer read-only/no execution/delegation.

### rev-36 · 2026-11-09T07:28:22.113Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1756-final-1
commit: 52f12c657f07b3c19fbec697ec2e1e01e3be2c6f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C6 verified, no findings. A-18001 same-source head5720/5720; parsed named admission/tag/missing components/SSH identity/order/worker-replay/unknown-POST cases. Inside-pacing8base+40load; all45new/admission identities each5/5load. Own4file resource events0; known HTTP T-1767/report-only baseline notices retained. T0/allT1/fallbackallT2/selected gateT3(8once)/Web executed; LinuxT4/fullT3 not run. A-17999 exact committed-head native14 manifests/raw names reconcile146/146 and all code0/signalnull, including unchanged fake-ready12, detachedwatchdog2, committedQAcorpus3, CLIusage2 and macOS T4control1. Capturetree1c44969 differs from native commit Git tree47e9e4ad; both correctly labeled. Uncached Linux/Node24.21/Nvim0.12.5/pinnedHeadless1248 CfT156, skips[]missing0report. Coordinator bcd50eb8 allowed key-orphan scope retained. FullT3Linux batch BEFORE LANDING still pending Coordinator gate; fullafter-stageQA separate, no realcloudready claim. No extra task run requested; Reviewer read-only/no execution/delegation.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-09T08:06:58.734Z

Merged 49b3099fa614a56f9b4984ad145257aa84cdb52a onto dev.
