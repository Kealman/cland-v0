---
id: T-1719
kind: task
title: DigitalOcean pool images, and hosts created from them
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1715
  - T-1714
  - T-1716
  - T-1710
topic: topic-1420
branch: t/T-1719-digitalocean-pool-images-and-hosts
created: 2026-11-06T10:49:01.153Z
updated: 2026-11-07T08:36:19.001Z
closed: 2026-11-07T08:36:19.001Z
---

## Summary

The DigitalOcean provider's prepare builds a pool image the way the executor builds its snapshot: a builder droplet runs the recipe with the agent-host part, then the provisioning hook as root, then `prepare` as `runner`. The image is snapshotted, transferred to the pool's region and tagged `cland`, project and pool. Prepare retires the previous pool image only after the new one is published, its deletion confirmed by a GET. A host create uses the current pool image and the prelude as user-data, and is refused with "run cland host prepare" when the pool's image is missing or stale.

Hot files: `hub/src/executor/droplet/prepare.ts` (`prepareSnapshot` takes the recipe, key, record path and tags), `hub/src/host/provider/digitalocean.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean-prepare.test.ts` (new)

## What to build

A generalised `prepareSnapshot` that the executor keeps calling unchanged in behaviour, and DigitalOcean prepare and acquire over it. The builder lease, watchdog and spend come from the executor's existing builder path.

Decision (coord, open question 4): until E-1534's host lease, watchdog and `hosts` spend land, `host.create` on the `digitalocean` provider is refused outside the test environment, with a message naming the reason. `prepare` stays allowed, since it runs under the executor's builder lease, watchdog and spend. The provider contributes its own prelude steps (open question 10).

## Acceptance criteria

- [x] C1. Against the fake API and the scripted machine, prepare runs the agent-host recipe, then the hook as root, then `prepare` as `runner`, and records a pool image tagged `cland`, the project tag and the pool tag in the pool's region (test).
  - done: impl-1719 · 2026-11-07T06:15:08.093Z
  - verified: rev-36 [reviewer] · run rev-36-1719-final-1 · 2026-11-07T06:39:08.051Z · commit 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
  - verified: rev-36 [reviewer] · run rev-36-1719-final-2 · 2026-11-07T07:50:26.109Z · commit 199bdeea29530230d04a32b726a38714618fde97
- [x] C2. A second prepare with an unchanged key makes no API call that creates anything and answers `current` (test).
  - done: impl-1719 · 2026-11-07T06:15:08.347Z
  - verified: rev-36 [reviewer] · run rev-36-1719-final-1 · 2026-11-07T06:39:08.051Z · commit 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
  - verified: rev-36 [reviewer] · run rev-36-1719-final-2 · 2026-11-07T07:50:26.109Z · commit 199bdeea29530230d04a32b726a38714618fde97
- [x] C3. A replaced pool image is deleted only after the new one is recorded, and a DELETE 404 with a live GET keeps it on the retirement record (test).
  - done: impl-1719 · 2026-11-07T06:15:08.724Z
  - verified: rev-36 [reviewer] · run rev-36-1719-final-1 · 2026-11-07T06:39:08.051Z · commit 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
  - verified: rev-36 [reviewer] · run rev-36-1719-final-2 · 2026-11-07T07:50:26.109Z · commit 199bdeea29530230d04a32b726a38714618fde97
- [x] C4. A host create sends the current pool image id and the rendered prelude as `user_data`, and with no current image it is refused naming `cland host prepare` before any POST (test).
  - done: impl-1719 · 2026-11-07T06:15:08.985Z
  - verified: rev-36 [reviewer] · run rev-36-1719-final-1 · 2026-11-07T06:39:08.051Z · commit 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
  - verified: rev-36 [reviewer] · run rev-36-1719-final-2 · 2026-11-07T07:50:26.109Z · commit 199bdeea29530230d04a32b726a38714618fde97
- [x] C5. The executor's prepare test files pass with no test edited.
  - verified: rev-36 [reviewer] · run rev-36-1719-final-1 · 2026-11-07T06:39:08.051Z · commit 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
  - done: impl-1719 · 2026-11-07T07:31:23.550Z
  - verified: rev-36 [reviewer] · run rev-36-1719-final-2 · 2026-11-07T07:50:26.109Z · commit 199bdeea29530230d04a32b726a38714618fde97
- [x] C6. Outside the test environment, `host.create` on the `digitalocean` provider is refused before any API call with a message naming the missing lease, watchdog and spend of E-1534 (test).
  - done: impl-1719 · 2026-11-07T06:03:18.037Z
  - verified: rev-36 [reviewer] · run rev-36-1719-final-1 · 2026-11-07T06:39:08.051Z · commit 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
  - verified: rev-36 [reviewer] · run rev-36-1719-final-2 · 2026-11-07T07:50:26.109Z · commit 199bdeea29530230d04a32b726a38714618fde97
- [x] C7. The DigitalOcean provider supplies its own prelude steps, so the `user_data` of a host create removes `99-digitalocean-automount.rules`, installs `cland-auth` with its sudoers line and writes Codex's `cli_auth_credentials_store = "file"`; those steps reach the rendering from the provider, not from the test (test).
  - done: impl-1719 · 2026-11-07T06:03:18.609Z
  - verified: rev-36 [reviewer] · run rev-36-1719-final-1 · 2026-11-07T06:39:08.051Z · commit 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
  - verified: rev-36 [reviewer] · run rev-36-1719-final-2 · 2026-11-07T07:50:26.109Z · commit 199bdeea29530230d04a32b726a38714618fde97

## Comments

### coord · 2026-11-06T17:20:04.648Z

coord: C7 added while writing the E-1533 stage-1 brief. T-1710 C2 is proven only with DigitalOcean steps the test passes in itself through `providerSteps`; no hub code supplies them at this build. The provider wiring belongs here, with the host create that sends the prelude (C4).

### impl-1719 · 2026-11-07T05:56:26.636Z

Rule 20 consumer sweep before changes: prepareSnapshot/readSnapshot/snapshotPath/sameKey are consumed by droplet.ts, snapshot-recovery.ts, executor/status.ts, executor prepare/component/safety/droplet, prepare-key, verify-prepare tests and pool-image.ts. DigitalOcean configured-image prepare contract is consumed by host-provider-digitalocean.test.ts (including keyed refusal), host-provider-contract.ts, host-prepare.test.ts, registry.ts and pool-image.ts; acquire by runtime.ts, provider contract, digitalocean and volumes tests, host prepare/docs and QA briefs (rg field/function/image.json/refusal text across hub, web, docs, .agents). Executor defaults and tests stay unchanged. Pool preparation gets separate records and recipe input using the existing builder lifecycle; old configured-only records cannot establish current pool images. Existing provider tests must migrate fixture setup to a current pool image; their stale unsupported keyed-prepare assertion will become pool preparation coverage. No wire reply shape change; PrepareResult/AcquireResult remain unchanged.

### impl-1719 · 2026-11-07T06:03:18.859Z

C1/C2/C3/C4/C6/C7 implementation and targeted tests complete; evidence A-17379. C5 remains pending unedited executor preservation runs at the reviewed head. First source review will precede those final-head preservation runs and mode-free verification. Full stage QA policy is after-stage on dev, no per-item QA brief.

### rev-36 · 2026-11-07T06:08:43.422Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1719-source-1
commit: 69028e41ad746c62785f5a68fd5fcdd729727dce
scope: full
findings: [{"severity":"medium","text":"Current-image decision ignores configured pool region. After region changes, unchanged-key prepare returns current without transfer/publication while acquire refuses and tells the user to prepare. Validate required region and add a changed-region usable-image regression.","file":"hub/src/executor/droplet/droplet.ts","line":336},{"severity":"medium","text":"Pool recovery storage is only retried by preparePool; periodic/restart recoverSnapshots still reads only default executor records. Unknown pool snapshots or incomplete retirement can remain indefinitely without another manual prepare. Add autonomous ownership-safe retry plus restart/no-new-prepare regression.","file":"hub/src/executor/droplet/snapshot-recovery.ts","line":92},{"severity":"medium","text":"Pool key recipeDigest hashes only executor provision.sh, while actual build renders agent installer code and default harness versions from image/recipe.ts/TESTED_RANGES. Changed rendered recipe can incorrectly reuse current image. Hash full rendered pool recipe/effective defaults without changing executor key behavior, with invalidation control.","file":"hub/src/host/provider/pool-image.ts","line":52}]
finding_counts: {"high":0,"medium":3,"low":0}

Initial source not clear; Standards0/Spec3medium findings, all confirmed by claimant in fa724df5/d57c5976. Preserve executor defaults and tests; correct region validity, autonomous fenced pool recovery and actual rendered recipe key with regressions before fresh source review. C5-C7 remain unverified; no preservation/configured run claimed at this head. Full review A-17382: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17382-t-1719-initial-pool-image-source-review.md. Reviewer reads only.

Criteria: C1 failed (Configured-region changes do not revalidate/transfer unchanged-key pool images; prepared publication can remain unusable in the required pool region.), C2 failed (Pool key omits rendered agent-host installer bytes and omitted harness defaults, permitting current after actual recipe changes.), C3 failed (Retained pool snapshot/retirement records have no restart or periodic retry owner outside another explicit prepare.), C4 failed (After a pool region change acquire refuses with host prepare while prepare keeps returning current, so the prescribed recovery cannot provide a usable image.).

### rev-36 · 2026-11-07T06:14:44.738Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1719-source-2
commit: 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 findings. Resolves A-17382: unchanged-image region transfer waits for observed visibility and preserves executor pointer; periodic/restart pool recovery discovers durable directories including removed pools, claims storage before inspection and skips active preparation; close joins tracked pool work. DigitalOcean key now hashes full rendered agent recipe/effective defaults, while fake and executor legacy digest behavior remain intact. Regressions cover region transfer→acquire, fresh-executor retirement without prepare, held active builder, omitted-default key invalidation. Read A-17384 actual75/75/native0/signalnull; interim fake-pool failures remain failed history. Full details A-17389: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17389-t-1719-corrected-preparation-and-recovery-source-review.md. Restore C1-C4 implementation done from corrected receipts; C1-C7 remain unverified pending directed unedited C5 preservation and fresh configured same-head result. Reviewer reads only.

### impl-1719 · 2026-11-07T06:24:15.595Z

All criterion done marks restored/completed at source-clear 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4. C5 unedited five-file preservation 54/54 local macOS Node v24.21.0, native close0/signalnull for each, raw A-17399. Source clear rev-36-1719-source-2; exact-head T0 A-17387; sealed targeted75/75 A-17384. Formal verify37211143-52b9-480f-a15d-69ff887ac7eb pending; no ready claim until its receipt and Reviewer settlement. Stage full QA on dev deferred to Coordinator.

### rev-36 · 2026-11-07T06:39:08.051Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1719-final-1
commit: 6229e2c4fe7da0ebc27cf1b423dcd24505dfa3e4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at6229e2c4; C1-C7verified, no findings. Source A-17389 current. Independently matched all7 pool base passes +5passing load repetitions each, including region transfer, periodic retained retirement, active-owner exclusion and effective-default key invalidation; machine31/volumes9/fake34/publicprepare8/recipe7/prelude3/key10 base controls pass. Fresh37211143/A-17401 overall0,5355pass/0fail/cancel/skip/todo; T0/T1/fallbackallT2/Web0; T3/T4 unexecuted. UncachedLinuxx64 c8lon1 Node24.21/Nvim.12.5, isolatedHeadless1248/CfT156.0.8078.4; T0capture3ad0bd17 not repeated remotely. Read all54 exact-head local Mac named executor outcomes and per-file native close0/signalnull A-17399; independently byte-compared five preservation files to starting base, all unchanged. Budgets/lint/ratchet/skip report-only, missing0. Full A-17403: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17403-t-1719-final-preparation-and-executor-preservation-evidence.md. Full after-stage QA/merge coverage separate; scripted pool proof is not real live-provider admission. Reviewer reads only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-36 · 2026-11-07T07:27:45.950Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1719-source-3
commit: 199bdeea29530230d04a32b726a38714618fde97
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source correction clear, Standards0/Spec0 findings. renderPrelude alone now performs memoized helper read; importing CLI/prelude needs no render-only asset. Runtime manifest explicitly includes helper; real delivered-tree child renders and checks bundled helper content using existing native ownership/drain wrapper. Existing runtimeBundle .sh policy and complete source-release extraction/build retain helper. Unedited suite-coverage red exactENOENT→green4/4, cland-auth9, prelude+manifest6 and delivery3 nativeclose0/null read from A-17411; green working-tree hashes independently match199b, not relabelled committed-head execution. Prior batch remains red. Coordinator d7cc8bb9 explicitly requires fresh five-file executor preservation because changed bytes are within existing closure; membership hashes alone do not permit A-17399 carry. C1-C7 unverified until new evidence; exact-head preservation then mode-free verify. A-17412: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17412-t-1719-lazy-prelude-and-delivered-helper-source-review.md. Reviewer reads only.

### rev-36 · 2026-11-07T07:50:26.109Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1719-final-2
commit: 199bdeea29530230d04a32b726a38714618fde97
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh final clear at199b; C1-C7verified, no findings. Source A-17412 current. Independently parsed7 pool base+5pass each, both runtime-delivery identities (real delivered-tree prelude rendering and joined installer teardown), manifest3/prelude3 and machine/volume/fake/public/key/recipe controls. Fresh16a09787/A-17414 overall0,5358pass/0fail/cancel/skip/todo; T0/T1/fallbackallT2/changedT3onefile2identities/Web0. UncachedLinuxx64 kernel6.8.0-147 Node24.21/Nvim.12.5, Headless1248/CfT156.0.8078.4, T0captureb267aa02 not repeated remotely. Read all54 new exact-head local executor outcomes and every native close0/signalnull in A-17413; five tests independently unedited versus base. No A-17399 carry. Budget/lint/ratchet/skip report-only/missing0. Prior batchd11a7daa/A-17410 remains red; its unedited suite-coverage green is source-linked local A-17411, not a claimed post-fix Linux batch run. Full A-17415: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17415-t-1719-fresh-final-evidence-after-lazy-prelude-correction.md. RemainingT3/T4, merge-batch protection and full after-stage QA separate. Reviewer reads only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-07T08:36:19.001Z

Merged 7d7aab2bc3ef84ea9b314f733ee512d03429905f onto dev.
