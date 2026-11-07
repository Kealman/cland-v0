---
id: T-1713
kind: task
title: The DigitalOcean host provider's machines
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1707
  - T-1708
topic: topic-1410
branch: t/T-1713-the-digitalocean-host-provider-s
created: 2026-11-06T10:48:21.140Z
updated: 2026-11-06T23:36:10.296Z
closed: 2026-11-06T23:36:10.296Z
---

## Summary

The `digitalocean` provider creates a droplet per host from the hub's `DIGITALOCEAN_TOKEN`, as the executor reads it. Each droplet goes in the pool's region (lon1 by default; fra1 and ams3 allowed), is tagged `cland`, the project tag and a pool tag, and gets its own SSH key. Status reads the droplet. Release deletes the droplet and its key, each confirmed by a GET, so a DELETE 404 with a live GET is reported as not deleted. Reap deletes tagged droplets and prefixed keys that no host record owns.

Hot files: `hub/src/host/provider/digitalocean.ts` (new), `hub/src/host/provider/registry.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean.test.ts` (new)

## What to build

The provider over `DigitalOceanApi`, reusing its confirmed delete and the executor's `projectTag`. The name and tags are written before the create call, so an ambiguous create is found by tag. Keys are named with the project-tag prefix, since DigitalOcean keys carry no tags. The token is never in argv, a log line, an error or a host's user-data.

## Acceptance criteria

- [x] C1. A create against the fake API carries the region, size, image and tags `cland`, the project tag and `cland-pool-<pool>`, and a region outside lon1, fra1 and ams3 is refused before any call (test).
  - done: impl-1713 · 2026-11-06T20:43:55.680Z
  - verified: rev-36 [reviewer] · run rev-36-1713-final-1 · 2026-11-06T21:33:03.162Z · commit 07b179797532ba091d20c2d5548bc820aec0de5b
  - verified: rev-36 [reviewer] · run rev-36-1713-final-2 · 2026-11-06T22:28:45.808Z · commit 37b1176c7922dac52dee8a9ca5c1b587677c42e9
- [x] C2. Release with the fake API answering DELETE 404 while GET answers 200 reports the droplet as not deleted; with GET 404 it reports `released` (test).
  - done: impl-1713 · 2026-11-06T20:44:04.532Z
  - verified: rev-36 [reviewer] · run rev-36-1713-final-1 · 2026-11-06T21:33:03.162Z · commit 07b179797532ba091d20c2d5548bc820aec0de5b
  - verified: rev-36 [reviewer] · run rev-36-1713-final-2 · 2026-11-06T22:28:45.809Z · commit 37b1176c7922dac52dee8a9ca5c1b587677c42e9
- [x] C3. Reap deletes a droplet carrying the project and pool tags with no host record, and its prefixed key, each confirmed by a GET, and leaves droplets of other projects alone (test).
  - done: impl-1713 · 2026-11-06T21:08:31.029Z
  - verified: rev-36 [reviewer] · run rev-36-1713-final-1 · 2026-11-06T21:33:03.162Z · commit 07b179797532ba091d20c2d5548bc820aec0de5b
  - verified: rev-36 [reviewer] · run rev-36-1713-final-2 · 2026-11-06T22:28:45.809Z · commit 37b1176c7922dac52dee8a9ca5c1b587677c42e9
- [x] C4. A create whose response is lost is found by its tags at the next reap, not left running (test).
  - done: impl-1713 · 2026-11-06T20:44:15.676Z
  - verified: rev-36 [reviewer] · run rev-36-1713-final-1 · 2026-11-06T21:33:03.162Z · commit 07b179797532ba091d20c2d5548bc820aec0de5b
  - verified: rev-36 [reviewer] · run rev-36-1713-final-2 · 2026-11-06T22:28:45.809Z · commit 37b1176c7922dac52dee8a9ca5c1b587677c42e9
- [x] C5. With a sentinel token, no log line, error, user-data or child argv of the provider contains it (test).
  - done: impl-1713 · 2026-11-06T20:44:25.126Z
  - verified: rev-36 [reviewer] · run rev-36-1713-final-1 · 2026-11-06T21:33:03.162Z · commit 07b179797532ba091d20c2d5548bc820aec0de5b
  - verified: rev-36 [reviewer] · run rev-36-1713-final-2 · 2026-11-06T22:28:45.809Z · commit 37b1176c7922dac52dee8a9ca5c1b587677c42e9
- [x] C6. The machine cases of the contract suite pass against the fake API (test).
  - done: impl-1713 · 2026-11-06T20:44:30.835Z
  - verified: rev-36 [reviewer] · run rev-36-1713-final-1 · 2026-11-06T21:33:03.162Z · commit 07b179797532ba091d20c2d5548bc820aec0de5b
  - verified: rev-36 [reviewer] · run rev-36-1713-final-2 · 2026-11-06T22:28:45.809Z · commit 37b1176c7922dac52dee8a9ca5c1b587677c42e9

## Comments

### impl-1713 · 2026-11-06T20:36:37.906Z

Rule 20 sweep: fakeDigitalOcean consumers: executor-{admission,safety,droplet,prepare,deletion-confirmation,snapshot-confirmation,prepare-component}, digitalocean-pacing, startup-ready-component, daemon, suite-dry-run, suite-unit-fixture, droplet-fixture, remote-fixture. Registry consumers: host-provider-fake/declarations. Contract consumers: host-provider-fake and volumes. Search covered imports plus POST /droplets, /account/keys, beforeCreate/beforeImport, activeAfter and split-delete fault fields across hub/web/shared/docs/.agents. Additive opt-in lost-create/boot-failure faults preserve all existing default wire behavior and shapes; existing executor tests remain unedited. No public Machine/Acquire/Reap shape changes.

### impl-1713 · 2026-11-06T20:41:47.285Z

Additional rule 20 sweep for additive image GET: DigitalOceanApi callers/deadline adapter, dependencies Provider mapped type, droplet prepare/reap, watchdog, API fake and executor deadline/pacing/admission/recovery/snapshot/deletion tests. deadline.ts maps image deadline at argument 1. Existing method signatures and replies unchanged. New image GET route is additive; allocateAddressEarly, bootFailed and loseCreateResponse default off, preserving prior fake wire behavior. Exact fault-field sweep also found suite/demo fixtures and executor-reap-confirmation/recovery-collection; all unaffected by opt-in defaults.

### rev-36 · 2026-11-06T20:51:36.251Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1713-source-1
commit: 0d6734d311d4c47a9d56ce6df47a8b99b0426aca
scope: full
findings: [{"severity":"high","text":"ownedMachineIds is captured before awaited inventories and never refreshed/coordinated at target deletion admission; ownership published during those awaits or earlier deletes can be swept with its key. Coordinate current owner admission and retain held-inventory/deletion owner-race regression.","file":"hub/src/host/provider/digitalocean.ts","line":102},{"severity":"medium","text":"Pool prefix is ambiguous: agents matches keys for valid pool agents-host-x; exact tag excludes that pool's droplet but key-only loop deletes its key. Use unambiguous exact pool/intent identity and cover overlap with/without local intents.","file":"hub/src/host/provider/digitalocean.ts","line":119},{"severity":"low","text":"apiRequestsPerMinute duplicates250 already owned/exported by endpoint.ts; share the default owner and document/derive any endpoint-override distinction rather than a second policy literal (rule24).","file":"hub/src/host/provider/digitalocean.ts","line":23}]
finding_counts: {"high":1,"medium":1,"low":1}

Full source not clear at0d6734d311d4c47a9d56ce6df47a8b99b0426aca. High stale owned-id snapshot; medium cross-pool key prefix collision; low copied API-rate default. C3 failed; other criteria unverified. Inspected intent-before-create, confirmed DELETE/GET operations, retry/lost-response handling, image/deadline addition, opt-in fake faults, contracts/consumer sweep/docs. Coordinator4827cf0e's configured-image/no-build and production-acquisition fence respected. Regressions needed at scripted API seam; no real cloud/native probe requested. Details A-17216: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17216-t-1713-source-review-reap-ownership-and-pool-key-isolation.md. Pending preservation/configured receipts are not runtime passes; Reviewer executed no tests/probes/lint/browser. Fresh source review required after fixes, before verification.

Criteria: C3 failed (Reap can delete a newly owned host after stale inventory-time ownership and can delete another valid overlapping pool's key.).

### impl-1713 · 2026-11-06T20:52:25.370Z

Review-fix consumer sweep: ownedMachineIds appears only in DigitalOceanHostProviderOptions, provider reap, provider test and host-providers doc. Add admitReap callback to hold the host-record owner admission fence through per-target deletion, retaining ownedMachineIds field for prior callers; snapshot-only owners fail closed instead of deleting. No public HostProvider/ReapOptions or wire shapes change. Exact key identity parser migrates provider create/reap and orphan test fixtures; fake API preserves key names verbatim, no other key-name consumers exist. Pool/UUID parser will be shared by all provider key-selection paths.

### rev-36 · 2026-11-06T20:58:03.935Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1713-source-2
commit: f695770d37eed13fd1cae38f448e307f9fd89b7d
scope: full
findings: [{"severity":"high","text":"admitReap specifies an in-flight lock only; accepted DELETE/GET200 returns incomplete and may release that lock without a durable retirement reservation, allowing claims while native deletion is unresolved. Persist reservation before remove, retain across incomplete/throw/restart, reconcile before clearing; add blocked-claim/restart regression.","file":"hub/src/host/provider/digitalocean.ts","line":15},{"severity":"medium","text":"Key-only cleanup returns released for an admission target carrying known record.dropletId without GET-confirming that droplet's absence. An omitted live droplet can remain running while key deletion settles its retirement. Positively reconcile the known resource; cover omission.","file":"hub/src/host/provider/digitalocean.ts","line":132}]
finding_counts: {"high":1,"medium":1,"low":0}

Reworked source not clear atf695770d37eed13fd1cae38f448e307f9fd89b7d. Prior exact-pool parser, stale snapshot replacement and shared rate-default findings resolved in source. Remaining high durable retirement gap and medium known-droplet/key-only settlement gap; Implementer01c4ae11 confirms missing reservation and holds verification. Reviewed four new regression bodies; they cover successful in-flight fencing but not incomplete/restart reservation or omitted-known-droplet absence. C3 remains failed; other criteria unverified. Details A-17221: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17221-t-1713-reworked-reap-review-incomplete-deletion-must-retain-retirement.md. No Reviewer tests/probes/lints/browser or fabricated executed failure; corrected head needs fresh source review.

Criteria: C3 failed (Incomplete deletion lacks a durable retirement contract; key-only reconciliation can settle a known machine/key target without confirming the associated droplet gone.).

### rev-36 · 2026-11-06T21:01:23.863Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1713-source-3
commit: 9c0050b19878e123c791550871b7ac1855cb45f4
scope: full
findings: [{"severity":"medium","text":"Pending retirement is revisited only through visible droplet/key lists. If key DELETE succeeds but confirmation GET fails, both next inventories may be empty and no admitReap call reconciles the saved reservation. Persist/enumerate pending targets independently and cover both-absent restart recovery.","file":"hub/src/host/provider/digitalocean.ts","line":121}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at9c0050b19878e123c791550871b7ac1855cb45f4. Prior durable-owner contract and known-droplet/key-only confirmation gaps resolved. One medium recovery gap remains: successful droplet/key mutation plus transient key confirmation failure leaves saved retirement pending, but empty next inventories select no target. Implementer7ed7f725 confirms and will persist independently discoverable pending targets. New21st regression only covers a still-visible key, not both-absent recovery. C3 failed; others unverified. Details A-17227: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17227-t-1713-source-review-pending-retirement-omitted-by-empty-inventories.md. Reviewer executed no tests/probes/lints/browser and claims no native assertion failure. Hold verification for corrected-head source review; preserve current native evidence's original head.

Criteria: C3 failed (Both resources can disappear after failed confirmation, leaving a durable retirement that empty inventories never reconcile.).

### impl-1713 · 2026-11-06T21:04:33.196Z

Coordinator-authorized preservation carry (496aa4af-7f81-44c6-b115-33d1f1c25281): git diff --stat 9c0050b19878e123c791550871b7ac1855cb45f4 07b179797532ba091d20c2d5548bc820aec0de5b lists only docs/agents/tests/hub-test-host-provider-digitalocean.test.ts.md (+4), docs/hub/host-providers.md (+5), hub/src/host/provider/digitalocean.ts (59 lines changed), hub/test/host-provider-digitalocean.test.ts (+54): four files,108 insertions,14 deletions. Shared production importingTests closure check on the new head returned affected:[], unknown:[] for executor-droplet, executor-prepare, executor-safety against both changed source/test files. No executor/droplet module, deadline.ts or fake-api.ts changed. Carry receipts (not new-head executions): macOS local Node24.21.0, executor-droplet14/14, executor-prepare5/5, executor-safety17/17, each exit0/signalnull, exact source head9c0050b1; owner-checked preservation lock released. New-head provider23/23 and hub typecheck clear; no cloud/browser/container. Latest red regression before fix returned released:[] rather than ['101'] after both inventories emptied; independent pending-target reconciliation is now covered.

### rev-36 · 2026-11-06T21:08:14.011Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1713-source-4
commit: 07b179797532ba091d20c2d5548bc820aec0de5b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at07b179797532ba091d20c2d5548bc820aec0de5b; no findings. Pending retirement checkpoints precede native effects, independent saved-target iteration recovers despite empty lists, and provider pending state clears only after owner callback settlement acknowledgement. New transient-final-GET and lost-owner-ack regressions retain final blocked-claim/restart/positive-absence assertions. All earlier exact-pool, stale owner, durable retirement, known-droplet and shared rate-default findings resolved in current source. Four-file final correction leaves executor/API/deadline/fake unchanged. Details A-17231: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17231-t-1713-source-clear-with-independent-pending-retirement-reconciliation.md. C1–C6 remain unverified pending exact-head configured evidence and assessment of labelled preservation carry; C3 still had prior failure/done-cleared mark in task.view. Targeted/static claims are not Reviewer runs. Reviewer executed no tests/probes/lints/browser; obey Coordinator quiet/load slots for verification.

### impl-1713 · 2026-11-06T21:30:51.674Z

Final evidence supplement requested by Reviewer: A-17244 retains exact original command and ordered native tool-output chunks from this session, including all 36 named outcomes and per-file exit 0/signal null receipts at 9c0050b1; A-17245 reproduces Coordinator carry authorization 496aa4af verbatim with topic-1409 envelope and recorded diff/import-closure assessment. No rerun or reconstructed test names; export secret scan positive control then zero matches. Candidate unchanged at 07b179797; configured green 30610ac3/A-17243 remains exact-head evidence.

### rev-36 · 2026-11-06T21:33:03.162Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1713-final-1
commit: 07b179797532ba091d20c2d5548bc820aec0de5b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged07b179797532ba091d20c2d5548bc820aec0de5b; C1–C6 verified, no findings. Independently matched23 exact provider names base+five passing load test receipts each (115), including ownership/pool/retirement/empty-list/lost-ack regressions, plus82 light preservation and6 deadline base receipts. Exact-head uncached30610ac3/A-17243 overall0,5290pass/0fail/cancel/skip/todo; T0/T1/fallback allT2/Web green, T3/T4 unexecuted. Linuxx64 kernel6.8.0-147 droplet c-8lon1 Node24.21/Nvim0.12.5; isolated HeadlessShell1248/CfT156.0.8078.4. T0capture-treed3376365 not repeated remotely. Read original36 named native preservation outcomes/code0/signalnull in A-17244 at9c0050b1; independently retrieved Coordinator496aa4af fromtopic-1409 and checked carry conditions (four provider/test/docs files only, executor/API/deadline/fake/test closure unchanged), A-17245. Explicit carry, not new-head native runs/cache. Budgets/lint/ratchet/skip report-only; affected after-stage QA and merge coverage separate. Provider proof uses fake API, not live cloud admission. Details A-17246: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17246-t-1713-final-digitalocean-machine-and-recovery-evidence.md. Reviewer ran no tests/probes/lints/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-36 · 2026-11-06T22:01:40.760Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1713-merge-source-1
commit: b33e3b83fe69d7bc8dc6073f1013bbedb6c0b4db
scope: delta
findings: [{"severity":"medium","text":"Merged pool-image caller passes {pool,key} through the shared registry, which now resolves digitalocean. Its prepare ignores the key and only GETs/records the configured base image, so the caller can publish an unbuilt recipe key and later report current after harness/lock/provision changes. Refuse keyed preparation until supported while retaining no-argument contract behavior; cover the composed path.","file":"hub/src/host/provider/digitalocean.ts","line":186}]
finding_counts: {"high":0,"medium":1,"low":0}

Authorized merge delta not clear: one medium integration finding, Standards/Spec detail A-17265: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17265-t-1713-merge-delta-keyed-digitalocean-prepare-integration.md. Both documentation sections are preserved, but incoming T-1716 keyed preparation composes with the DigitalOcean placeholder and can publish a recipe receipt without building it. The Coordinator carry waiver is acknowledged; old green evidence remains qualified at07b. No C1-C6 re-verification at this head, and no standalone criterion arbitrarily failed for this integration issue. Reviewer performed reads only.

### impl-1713 · 2026-11-06T22:02:46.776Z

Merge integration consumer sweep before keyed prepare refusal: HostProvider.prepare options introduced by T-1716 are consumed by preparePools -> HostProviderRegistry -> provider, public host.prepare dispatch/CLI/human-local Neovim, host-prepare tests, fake provider pool-image tests, generic machine contract no-argument prepare. Refusal is DigitalOcean-specific keyed prepare only; no-argument DigitalOcean image observation and fake keyed preparation remain supported. Pool caller already surfaces typed failed without writing receipts. Relevant docs: host-providers DigitalOcean/Pool images sections and machine test guide. Composed regression red: preparePools unexpectedly resolved (Missing expected rejection) under successful scripted image GET.

### rev-36 · 2026-11-06T22:05:33.415Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1713-merge-source-2
commit: 37b1176c7922dac52dee8a9ca5c1b587677c42e9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at37b1176c; resolves A-17265 keyed preparation integration finding. Every non-undefined keyed DigitalOcean prepare request fails before API or receipt access; original no-argument machine contract remains unchanged. Real preparePools→registry regression asserts specific rejection, no fresh project/private receipt, unchanged earlier receipt after harness pin mutation and zero API requests. Fake keyed support unchanged; docs now distinguish support from registration. Standards0/Spec0 findings. Details A-17267: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17267-t-1713-merged-source-keyed-prepare-refusal-correction.md. C1-C6 remain unverified at this new head; fresh directed native preservation and configured mode-free evidence required, not old docs-only carry. Reviewer reads only.

### impl-1713 · 2026-11-06T22:06:15.996Z

Current-head preservation rerun at 37b1176c7922dac52dee8a9ca5c1b587677c42e9 replaces carry for this runtime correction: original command/head/platform and 36 named outcomes in A-17268. macOS arm64 Node24.21.0; executor-droplet14/14, prepare5/5, safety17/17; native close exit0/signalnull each. Owned lock released after writers/output drain; sampled load2.00–3.16. Full typecheck, provider24/24, fake34/34, host-prepare7/7, wording/test lints exit0; report-only findings unchanged, zero lint refusals. Source delta rev-36-1713-merge-source-2 clear; fresh mode-free configured verification submission started per Coordinator75e08c45. No prior-head configured receipt claimed for this runtime fix.

### impl-1713 · 2026-11-06T22:27:37.628Z

Fresh configured evidence at exact reviewed head 37b1176c7922dac52dee8a9ca5c1b587677c42e9: run1638d60f/A-17271 passes5299/5299 with no failures, cancellations or skips. Named suite-timing receipt scan: provider24 pass, public pool preparation7 pass; composed keyed refusal passes. T0/T1/all-T2 fallback/Web completed on Linux x64 droplet c-8 lon1, Node24.21.0, Chrome Headless Shell1248/Chrome for Testing156.0.8078.4. Executor lifetime1173s/cost$0.0815. Budgets/lints report-only; T3 merge-batch and stage QA remain separate. Fresh same-head macOS preservation36 cases with original named/native receipts A-17268. No carry or docs-only waiver used. Reviewer final settlement requested; head unchanged.

### rev-36 · 2026-11-06T22:28:45.809Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1713-final-2
commit: 37b1176c7922dac52dee8a9ca5c1b587677c42e9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at37b1176c; C1-C6 verified. Source clear A-17267 unchanged. Independently streamed all24 provider base passes and120 passing load test receipts (five per exact name), including eight generated reusable contract outcomes and keyed real preparePools→registry refusal; fake34, host-prepare7, host-secret17, web-authority47 and deadline6 base controls pass. Fresh configured1638d60f/A-17271 overall0,5299pass/0fail/cancel/skip/todo; T0/T1/fallback allT2/Web0; T3/T4 unexecuted. Uncached Linuxx64 kernel6.8.0-147 droplet c8lon1 Node24.21/Nvim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4; capturetree4097ab78 is the matching T0 host gate, not repeated remotely. Read all36 fresh original named executor outcomes in A-17268 at exact37b, macOSarm64/Node24.21, per-file native close0/signalnull; no prior-head carry used. Report-only budget/lint/ratchet/skip findings retained. Full evidence A-17276: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17276-t-1713-final-evidence-with-corrected-contract-count.md; supersedes A-17275 only to correct contract generated-outcome count (eight including declarations). No findings; affected after-stage QA/merge coverage separate. Reviewer reads only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-06T23:36:10.296Z

Merged 30145b7c67b135268befec8f352dd603673c5c71 onto dev.
