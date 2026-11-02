---
id: T-1618
kind: task
title: Droplet and key deletion is confirmed by a GET on release and in the watchdog
state: open
status: ready
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1330
branch: t/T-1618-droplet-and-key-deletion-is-confirmed-by
created: 2026-11-02T03:34:16.979Z
updated: 2026-11-02T08:06:10.590Z
---

## Summary

The DigitalOcean client stops counting a DELETE 404 as proof of deletion. A droplet or key counts as gone only once a GET by id answers 404. Lease release and the detached watchdog keep the lease open until then. The fake DigitalOcean API learns to answer a DELETE 404 while its GET still answers 200.

Hot files: `hub/src/executor/droplet/api.ts` [E-1533 reuses], `hub/src/executor/droplet/cleanup.ts`, `hub/src/executor/droplet/watchdog.ts`, `hub/src/executor/droplet/deadline.ts`, `hub/test/fakes/digitalocean/fake-api.ts` [E-1533 extends]

## Acceptance criteria

- [x] C1. The client's droplet and key deletions never report a DELETE 404 as success, and a deletion counts only once a GET by id answers 404 (test).
  - done: impl-1618 · 2026-11-02T05:53:36.274Z
  - verified: rev-36 [reviewer] · run rev-36-1618-final-1 · 2026-11-02T08:06:09.991Z · commit 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
- [x] C2. The client can GET one SSH key by id, and the fake DigitalOcean API answers it (test).
  - done: impl-1618 · 2026-11-02T05:53:36.747Z
  - verified: rev-36 [reviewer] · run rev-36-1618-final-1 · 2026-11-02T08:06:09.991Z · commit 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
- [x] C3. The fake API can make a droplet's or key's DELETE answer 404 while its GET keeps answering 200 for a set number of reads (test).
  - done: impl-1618 · 2026-11-02T05:53:37.413Z
  - verified: rev-36 [reviewer] · run rev-36-1618-final-1 · 2026-11-02T08:06:09.991Z · commit 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
- [x] C4. On lease release, a droplet or key whose GET still answers 200 leaves the lease `releasing` with its attention recorded, and its spend reservation is not settled (test).
  - done: impl-1618 · 2026-11-02T06:13:24.075Z
  - verified: rev-36 [reviewer] · run rev-36-1618-final-1 · 2026-11-02T08:06:09.991Z · commit 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
- [x] C5. The watchdog confirms the key by a GET by id, and writes its receipt only after every GET answered 404 (test).
  - done: impl-1618 · 2026-11-02T07:38:19.201Z
  - verified: rev-36 [reviewer] · run rev-36-1618-final-1 · 2026-11-02T08:06:09.991Z · commit 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
- [x] C6. Once the GET answers 404, the next release attempt confirms the deletion, settles the spend and marks the lease released (test).
  - done: impl-1618 · 2026-11-02T05:53:39.248Z
  - verified: rev-36 [reviewer] · run rev-36-1618-final-1 · 2026-11-02T08:06:09.991Z · commit 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
- [x] C7. `executor-droplet.test.ts`, `executor-droplet-component.test.ts` and `executor-safety.test.ts` pass with no test edited.
  - done: impl-1618 · 2026-11-02T05:53:39.515Z
  - verified: rev-36 [reviewer] · run rev-36-1618-final-1 · 2026-11-02T08:06:09.991Z · commit 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400

## Notes

Shared files: see Hot files

## Comments

### impl-1618 · 2026-11-02T05:44:08.518Z

Rule 20 inventory: api.ts deletions consumed by cleanup.ts (release + watchdog), droplet.ts reap, prepare.ts, snapshot-recovery.ts, demo-release-component.test.ts, suite-unit-fixture.ts and executor-prepare-retry.test.ts proxy. Provider shape flows through dependencies.ts, deadline.ts, remote-fixture.ts and fakeDigitalOcean; searched hub/src, hub/test, qa, docs and shipped skills for method names and ProviderCall. Snapshot deletion remains for T-1620. Fake will add GET-by-id for key/snapshot, split DELETE404/GET200 read-count faults and method-specific GET delay reusable by T-1619/T-1620/E-1533. No wire/persisted schema removal.

### impl-1618 · 2026-11-02T05:45:56.175Z

Additional contract inventory: ReleaseAttention.reason is additive deletion-unconfirmed; explicit consumers are executor inspect summary and hub/demos.ts notices, both migrated; existing demo-release-component test retains deletion-timeout assertion unchanged. Generic wire/projected attention readers preserve prior fields. New DigitalOceanApi.key/snapshot methods added to deadlineArgument; snapshot deletion behavior unchanged for T-1620. Red receipts: initial client test failed Missing expected rejection; release droplet/key cases failed saved.attention. All four current T2 cases now pass on macOS Node24.21.0 with scripted fake, no browser.

### impl-1618 · 2026-11-02T05:49:23.068Z

C7 preservation receipts on current uncommitted tree, macOS/Node24.21.0, local native/fake transport, no browser: executor-droplet.test.ts 14/14; executor-droplet-component.test.ts 1/1; executor-safety.test.ts 17/17. All three files unchanged. New watchdog T3 1/1 and confirmation T2 4/4. Full tiers have not run yet. Migrating demo-release-component consumers: accepted pending deletions now expose attention immediately; direct delayed delete expects DeletionUnconfirmed, with timeout and identity final assertions retained.

### rev-36 · 2026-11-02T05:59:46.404Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1618-source-1
commit: 4f78af83b9eac8af9261eed03d1fc0657d41cece
scope: full
findings: [{"severity":"medium","text":"DeletionUnconfirmed is swallowed for every discovered key/droplet, but final per-id checks retain only lease.keyId/resource. If an additional same-lease resource returns live GET200 then disappears from the next list, cleanup can report confirmed using the primary id's GET404 and settle/write watchdog receipt while that additional resource remains. Retain and reconcile every discovered unconfirmed id across attempts; add omitted-list/duplicate-resource controls.","file":"hub/src/executor/droplet/cleanup.ts","line":94},{"severity":"medium","text":"After accepted DELETE, a confirmation GET timeout/5xx rethrows a plain provider error and discards accepted=true. Cleanup records deleteStarted only on success/DeletionUnconfirmed, so the accepted receipt and original 300s bound are lost; subsequent attempts can re-DELETE or reset recovery timing. Preserve/checkpoint acceptance for every non-404 confirmation outcome and test a held/failing GET after successful DELETE.","file":"hub/src/executor/droplet/api.ts","line":111}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear: two medium ownership findings. cleanup.ts:94/115 swallows every pending discovered deletion but final id checks retain only lease.resource/keyId; an additional live same-lease resource omitted from the later list can be forgotten and produce confirmed/release/watchdog receipt. Track all observed pending ids until individual GET404 across attempts. api.ts:111 also loses accepted DELETE receipt on confirmation GET timeout/5xx, so cleanup never captures original deleteStarted/300s bound; preserve/checkpoint acceptance before/through GET failure. Add omitted-list/additional-resource and held/failing-GET controls. Other API/fake/deadline/attention/doc/test changes inspected; C7 files unchanged. A-15594 local targeted evidence supplemental; fresh source review before verify. No Reviewer tests/browser/edits.

Criteria: C4 failed (Additional discovered live resource can be forgotten after its DeletionUnconfirmed when later listings omit it, allowing premature lease/spend settlement.), C5 failed (Watchdog uses the same cleanup result and can write confirmed receipt without GET404 for every discovered resource.).

### impl-1618 · 2026-11-02T06:00:33.391Z

Review remediation inventory before schema changes: add optional tracked deletions to DropletLease, read by cleanup.ts and release/watchdog recovery; existing readLease/readLeases/writeLease and saved suite/demo lease copies preserve optional fields, older leases seed tracking from resource/keyId. Watchdog uses its own durable cleanup sidecar to avoid overwriting concurrently owned lease fields. API deletion methods gain an optional awaited acceptance callback (existing call forms retained); deadline map indices unchanged. Provider consumers listed in A-15594 remain applicable, including proxy Parameters<> consumer.

### rev-36 · 2026-11-02T06:19:15.386Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1618-source-2
commit: b374864f7017fb707c3112aba9bc96aa7a895a2b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. All discovered IDs now survive omitted lists/reload in shared tracking, with per-ID GET404 required for confirmation. Accepted DELETE is checkpointed before confirmation GET and retains the original per-droplet bound through errors/recovery. Both prior medium findings resolved; consumers, docs and added controls inspected. C1–C7 remain run-dependent and unverified pending same-head queued evidence; C7 files unedited. No Reviewer tests/browser/cloud actions.

### rev-36 · 2026-11-02T06:51:20.054Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1618-evidence-1
commit: b374864f7017fb707c3112aba9bc96aa7a895a2b
scope: evidence
findings: [{"severity":"medium","text":"Queued run929528ac fails the live/restored merged-result case: 'Error: remote result: not within 30000 ms' at harness.ts:902. Required watchdog T3/Web never execute. Seven new confirmation cases pass, but overall exit1 cannot establish final clear; root cause unconfirmed, diagnose the receipt boundary.","file":"hub/test/suite-close-component.test.ts","line":263}]
finding_counts: {"high":0,"medium":1,"low":0}

Final evidence not clear. A-15677 run929528ac exact-head uncached Linux droplet T2/overall exit1: 'Error: remote result: not within 30000 ms' in suite-close-component.test.ts:263. Seven new confirmation T2 cases pass; C7 component1 passes, native preservation/watchdog/Web have no executed outcomes. T0/T1 completed; T2 failed; T3/Web/T4 unexecuted. Node24.21.0/Neovim0.12.5, browsernull; report-only budget/lint advisories distinct from actual failure. C5 failed for missing required post-source execution, other criteria unverified. Diagnose receipt boundary; shared fix via Coordinator, fresh source review on changed head. No Reviewer execution.

Criteria: C5 failed (Post-source watchdog T3 did not execute because queued T2 failed waiting for the remote result; final confirmation evidence incomplete.).

### rev-36 · 2026-11-02T07:10:06.072Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1618-evidence-2
commit: b374864f7017fb707c3112aba9bc96aa7a895a2b
scope: evidence
findings: [{"severity":"medium","text":"Authorized unchanged-head retry ed49cde9/A-15697 repeats 'Error: remote result: not within 30000 ms'; T2/overall exit1 and Linux watchdog T3/Web remain unexecuted. Same receipt-boundary blocker as prior review; root cause not established by local 5x item/dev comparison.","file":"hub/test/suite-close-component.test.ts","line":263}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence remains not clear after authorized same-head retry ed49cde9/A-15697. Independently read same exact 'Error: remote result: not within 30000 ms', suite-close-component.test.ts:263/harness:902. T0/T1 exit0, T2/overall exit1; Linux T3/Web/T4 unexecuted. Provenance head b374864f7/tree de52758f7, uncached Linux x64 droplet Node24.21.0/Neovim0.12.5, browsernull, skip checkreport/missing0. Existing aggregate budgets/lint advisories remain report-only. A-15678 prior diagnosis still applies; additional local watchdog1/1 and 5x item/dev14/14 comparisons are supplemental, not an overall pass. C5 failed for missing required queued execution; other criteria unverified. Lead is holding for Coordinator/T-1629, no further retry requested; no Reviewer execution.

Criteria: C5 failed (Required Linux post-source watchdog phase remains unexecuted after repeated T2 remote-result timeout; local native1/1 is supplemental.).

### impl-1618 · 2026-11-02T07:22:57.129Z

Linux failure remediation inventory: new internal Suites.executorRecovered() consumed only by Dispatcher initial/periodic DropletExecutor recovery completion. Search covers Suites constructor callers/doubles in hub/src + hub/test and scheduler lifecycle/close/settled consumers. No frame/config/permission or provider wire change. Active pending-collection Set avoids scanning retained jobs. Completion reinspection joins existing per-job inspection, preserves GET404/spend gates, and is owned by Dispatcher dropletWork drainage. New T2 regression uses existing fake beforeDropletRead seam and leaves suite-close-component.test.ts unchanged.

### rev-36 · 2026-11-02T07:43:28.028Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1618-source-3
commit: 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Coordinator-directed collection correction wakes existing inspection owners after initial/periodic recovery, joins in-flight work and includes parents; active pending Set avoids retained history. Dispatcher owns/drains continuation; deletion/spend/accounting gates unchanged. Kept exact-ID durable-acceptance held-GET regression retains parent receipt/failed-child/one-message/resource-absence assertions; old production overlay red, original suite-close/C7 files unchanged. Docs/consumers/tier inspected. Prior Linux failures remain failed; localMac summaries supplemental. C1–C7 await fresh exact-head mode-free Linux evidence, including new recovery/original suite-close/watchdog/C7 preservation. No Reviewer execution.

### rev-36 · 2026-11-02T08:06:09.991Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1618-final-1
commit: 6a51b8ef148343f1fc9cbd15abbe1e0d5fe87400
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1–C7 verified, no findings. Independently streamed exact-head uncached A-15748/f858dea5 exit0,4708/4708: confirmation7+35 load repetitions, recovery1+5 repetitions, watchdog1, original suite-close14 (formerly failing case0.275s), component1/demo9 pass. A-15752 full native TAP/manifests independently establish unchanged C7 droplet14/safety17 at same head on macOSarm64 Node24.21, exit0/signalnull; component1 is Linux. Linux droplet Node24.21/Neovim0.12.5 T0/T1/fallback allT2/changedT3/Web complete; remainingT3/T4 unexecuted. Isolated HeadlessShell1248 Chrome156.0.8078.4; advisory/skip checks report-only, missing0. Prior failed runs retained; T1629 non-independent per Coordinator. No Reviewer execution; merge batch/after-stage QA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
