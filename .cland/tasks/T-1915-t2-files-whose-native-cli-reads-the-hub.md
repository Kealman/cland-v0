---
id: T-1915
kind: task
title: T2 files whose native CLI reads the hub lock, and other native calls in T2 found by T-1768's census, need a tier or a hermetic seam
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by:
  - T-1768
topic: topic-1588
branch: t/T-1915-t2-files-whose-native-cli-reads-the-hub
created: 2026-11-16T15:13:39.720Z
updated: 2026-11-17T06:44:08.068Z
closed: 2026-11-17T06:44:08.068Z
---

## Summary

T-1768's enforce-mode census of 239 projectHub-based T2 files (2026-11-16, topic-1557, findings artifact from impl-1768) found native calls that T-1768's fixture default does not remove. Ten files call the native CLI `status`/`start`, whose `readForeignHolder` → `lockHostIdentity` reads the real machine identity: config-reload-component, config-set, roles-component, hub-priority, hub-status-component, startup-ready-component, suite-protocol, suite-wait-metrics, merge-queue and auth-mode (users mode, to classify). Others: claude-code-schedule's upgrade-restart case reaches the lock through another caller, codex-remote's process-cleanup `execFileSync`, and host fixture lock probes. T-1768 keeps these files on an explicit native identity opt-in so they behave as on dev.

## What to build

For each file, decide and apply one of: move to T3 (it exercises native lock behaviour; add a duration allowance only if needed), or make its native dependency hermetic through a test seam that does not let a production hub take its lock identity from the environment (E-1538's two-hubs-one-lock guarantee stays intact). Remove the native opt-ins T-1768 added as each file moves.

## Acceptance criteria

- [x] C1. A shared hermetic CLI and fixture boundary replaces the native lock-identity read for T2. config-reload-component, config-set, hub-priority, hub-status-component and startup-ready-component use it and pass an enforce-mode T2 tripwire run with no native process call; or a file is in T3 with its reason recorded (test).
  - done: impl-1915 · 2026-11-17T05:14:42.575Z
  - verified: rev-35 [reviewer] · run rev-35-1915-final-1 · 2026-11-17T05:49:47.736Z · commit 6e813ea91fe9dc8f8b62db176e2b40760087c5b9
- [x] C2. The boundary has its own regression test: a T2 fixture using it cannot reach the real machine lock identity, and the five migrated files' assertions are unchanged (test).
  - done: impl-1915 · 2026-11-17T05:14:43.104Z
  - verified: rev-35 [reviewer] · run rev-35-1915-final-1 · 2026-11-17T05:49:47.736Z · commit 6e813ea91fe9dc8f8b62db176e2b40760087c5b9

## Comments

### coord · 2026-11-16T15:14:03.751Z

Source evidence from T-1768 (impl-1768, 2026-11-16): A-20205 lists every finding with file, case and stack, plus the 2 incomplete outcomes; A-20206 is the raw census of 239 projectHub T2 files under the enforce-mode tripwire (212 exit 0, 25 completed failing, 2 incomplete; not a green tier); A-20200 holds the standalone dev-versus-head comparisons without the tripwire.

### impl-1915 · 2026-11-17T04:43:12.135Z

Scope inspection recorded in A-20619 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20619-t-1915-scope-inventory-and-proposed-split.md). Ten C1 test-file opt-ins plus shared seam/regression/docs exceed launch boundary. Proposed split sent as a question to lead T-1915 in topic-1588. Awaiting scope decision; no tests, source changes or native runs. Claim retained.

### coord · 2026-11-17T04:43:33.843Z

Scope split, Coordinator decision on impl-1915's A-20619. This item keeps the shared hermetic boundary and five consumers (config-reload-component, config-set, hub-priority, hub-status-component, startup-ready-component). The other five nativeIdentityProjectHub consumers move to T-1932, which is blocked by this item. The census C2 findings (claude-code-schedule, codex-remote, host lock probes) move to T-1933. I narrowed C1 to the five files and changed C2 to the boundary's own regression.

### impl-1915 · 2026-11-17T04:44:45.645Z

Rule 20 inventory before CLI seam edit: additive optional arguments to inspect, runHub and startProjectHub. Production hub/bin/cland.ts and hub/src/setup/hub.ts retain native defaults. Direct test callers hub-lock-readers and startup-deadline-component retain default coverage; hub-priority, hub-status-component and startup-ready-component migrate explicitly. config-set and config-reload-component replace only status subprocess calls with the public module fixture boundary. describe-only host-flush, transport-status and E-1532-stage-3 unchanged. Search included names/imports/paths across hub/src, hub/bin, hub/test, nvim/test, qa, docs and skills; no snapshot/list/wire/persisted shape changes. Existing native CLI regression files retain previous invocation shapes. No environment override added.

### impl-1915 · 2026-11-17T04:52:28.810Z

Implementation committed and pushed at 8206d7c557d7715e384ced45a45ddefc30726fc8, nine files. Fresh origin/dev merge already up to date. Both criteria marked done; status review; source request sent to reviewer in topic-1588. Evidence A-20627 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20627-t-1915-red-green-and-serial-enforce-mode-component-evidence.md): red regression then green, final serial enforce T2 51/51 across five files on Darwin arm64 Node24.21.0, hub typecheck exit0, test lint exit0/0 refusals. No full verification yet; waiting source review then Coordinator window. Remaining native T3 deferred to periodic/integrated occasions under the T1-only batch configuration.

### rev-35 · 2026-11-17T05:04:06.518Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1915-source-1
commit: 8206d7c557d7715e384ced45a45ddefc30726fc8
scope: full
findings: [{"severity":"medium","text":"Sealing strips runner-captured lock metadata before startup-ready's mocked spawn invokes projectHub, so cold hub acquisition falls back to fixture-host while CLI polling uses the earlier captured identity. No propagation owner or metadata-present cold-start control exists; direct bootstrap greens miss run-suite.ts:209's setup.","file":"hub/test/fixture-hub-cli.ts","line":13},{"severity":"medium","text":"Overlapping async helper calls capture/replace/restore global process.env without a concurrency owner. A second call can lose custom identity and out-of-order finally blocks can restore the wrong environment. captureCli supplies only an output sink; serial current cases are not a shared-helper contract.","file":"hub/test/fixture-hub-cli.ts","line":12},{"severity":"medium","text":"New regression acquires import/root/hub resources without whole-callback ownership before admission. beforeEach environment restoration and per-resource cleanup do not join/fence late setup/body continuations before teardown.","file":"hub/test/hub-status-component.test.ts","line":18}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear; A-20637. Standards2medium (whole callback, overlapping environment restoration), Spec1medium (captured CLI identity versus sealed cold-start acquisition). Lead3454cff3/07bb6790 confirms no earlier owners/exception. Production optional options/native defaults and existing assertions otherwise accepted; approved five-consumer split respected. A-20636 narrows A-20627:51direct-bootstrap passing records, first4native exits0 inferred from loop progression, fifth native exit unknown because ||break masks failure; worker-bootstrap and metadata-presence receipts unknown. Guard control output retained but independent exit absent. Final hub typing/lint0/0refusals; working-tree/source/raw/hash/signal/scan-control limits retained. No configured/T3/T4/Web pass. Both criteria failed, none verified; no Reviewer runtime/edit. Consolidate all3 fixes and request fresh source review before verification.

Criteria: C1 failed (Shared helper can diverge from runner-captured identity during cold acquisition and lacks concurrent environment ownership.), C2 failed (Boundary regression lacks whole-callback ownership and misses metadata-present cold startup through the actual helper.).

### impl-1915 · 2026-11-17T05:15:00.893Z

Consolidated all 3 review findings in pushed head 6e813ea91fe9dc8f8b62db176e2b40760087c5b9 (tree 88c67e1351175842b29ab0609972beb03f4efa53). Fresh source request delivered to reviewer (rev-35). C1/C2 done again, state review, clean worktree. A-20647 retains current-head raw commands and independent native completion receipts; A-20648 observer preload; A-20649 fixes/evidence narrative. Local Darwin arm64 Node24.21.0: five files enforce mode 53/53, all five native exit0, preload receipts, explicit runner metadata plus cold metadata present/absent. Typecheck0 and source lint0/0 refusals. No post-review dev merge; no configured verify submission. Awaiting fresh source verdict before Coordinator window.

### rev-35 · 2026-11-17T05:17:36.488Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1915-source-2
commit: 6e813ea91fe9dc8f8b62db176e2b40760087c5b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated full source clear; A-20652. All3 A-20637 mediums resolved: serialized overlapping helper operations retain original environment/context, captured identity reaches cold projectHub acquisition, and new/extended callbacks own setup/body/acquisitions/CLI waits before resource/root/env restoration. Partial socket setup and hub close joined/idempotent. Production native defaults unchanged; original assertions/foreign/mute controls retained. A-20647 independently records53/53targetedT2 across5files at current head/tree with each native exit0 and explicit worker post-bootstrapT2/enforce receipt; cold metadata absent/present and overlap positives inspected apart from exits. Raw JSON/observer hashes match suppliedf7c49d.../d0dc07... . Typing/lint0/0refusals; advisories/native-signal/PID/stream/earlier masked-loop limits retained. Standards/Spec0 findings; C1/C2 unverified pending configured exact-head result. No dev merge, Reviewer runtime or final suite claim.

### impl-1915 · 2026-11-17T05:46:46.405Z

Configured same-head run fd531d09-f980-4b6e-9e2b-fbe1714e6e93 at 6e813ea91fe9dc8f8b62db176e2b40760087c5b9 returned auto exit0 / full fallback selection: 6557 pass, 0 fail/cancel/skip/todo. T0, T1, all fallback T2 and Web completed. A-20662 retains durable result/log. Executor droplet c-8 ams3, Linux x64 6.8.0-147-generic, Node24.21.0, Neovim0.12.5; browser Chrome Headless Shell / Chrome for Testing156.0.8078.4. Lifetime1166s/cost$0.0809, not test-only wall time. Named new identity/overlap and both cold-start cases have passing timing receipts. Configured resource/duration advisories are report-only; local five-file enforce evidence is separately A-20647. No T3/T4 execution claimed for this task receipt; hub result names T3 merge-batch coverage separately. Reviewer received same result automatically; awaiting final settlement, claim retained.

### rev-35 · 2026-11-17T05:49:47.736Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1915-final-1
commit: 6e813ea91fe9dc8f8b62db176e2b40760087c5b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-20665. fd531d09/A-20662 matches reviewed6e813ea91, normalizedfbbcfb4c... . C1 current-head Darwin independent enforce53/53+worker acknowledgements/native exits in A-20647/48/49 combines with Linux configured five-file53/53. C2identity20391/overlap20396/cold absent27814/present27829 pass; new identity/overlap/present5/5proof20774/20749/28072. No matched five-file tier diagnostic; no blanket no-CLI-subprocess claim.6557ordinary/707file plus265load positives; T0/all224T1/all428T2/55Web green,269T3/17T4 unexecuted. Provenance37940 uncachedLinuxx64/Node24.21/Nvim0.12.5, actual browser35384 HeadlessShell1248/CfT156. Report-only advisories, scope split and historical/native-stream/PID/signal/scan limits retained. Standards/Spec0 findings; C1/C2 verified. No Reviewer runtime/edit or integrated/QA claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T06:44:08.068Z

Merged cb678e484393a0540c129254f413fcd4bf93409b onto dev.
