---
id: T-1772
kind: task
title: "Login volumes on the fake provider: contents, snapshot history and volumes from a snapshot"
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1452
branch: t/T-1772-login-volumes-on-the-fake-provider
created: 2026-11-09T12:44:08.217Z
updated: 2026-11-09T13:02:18.793Z
---

## Summary

The host provider interface gains the three volume operations the login model needs: create a volume from a snapshot, list a volume's snapshots, and delete a snapshot. The fake provider gives each volume a contents directory that only the machine it is attached to can reach, keeps every snapshot as a copy of those contents, and detaches a machine's volumes when the machine is released, as DigitalOcean does.

## What to build

An additive change to the provider interface, implemented on the fake, with the DigitalOcean provider answering "unsupported" until T-1782:
- `createVolume` takes an optional `fromSnapshot`. The new volume starts with the snapshot's contents, in the snapshot's region.
- `listSnapshots(volume)` returns the volume's snapshots oldest first, or `failed`.
- `deleteSnapshot(snapshot)` returns `deleted` only after a read confirms absence, else `incomplete`.

The fake keeps a contents directory beside each volume record, copies it into each snapshot, and keeps every snapshot receipt rather than only the latest. The record parser reads both the old single-receipt record and the new list. A fake contents seam, for the fake login-disk helper of T-1776, answers a volume's contents directory only for the machine the volume is attached to. Releasing a fake machine clears the attachment of its volumes and keeps their contents. Deleting a volume removes its contents. The per-volume snapshot window stays as it is. `hostProviderVolumeContract` gains cases for the three operations; the fake runs them, and the DigitalOcean provider joins them in T-1782.

## Acceptance criteria

- [x] C1. A fake volume created from a snapshot starts with that snapshot's contents in the snapshot's region, and a volume created without one starts empty (test).
  - done: impl-1772 · 2026-11-09T12:49:53.981Z
- [x] C2. `listSnapshots` returns every snapshot of a volume oldest first, and `deleteSnapshot` reports deleted only after a read confirms absence, else incomplete (test).
  - done: impl-1772 · 2026-11-09T13:01:27.415Z
- [x] C3. The fake contents seam answers a volume's contents only for the machine it is attached to, and refuses another machine and a detached volume (test).
  - done: impl-1772 · 2026-11-09T12:50:14.007Z
- [x] C4. Releasing a fake machine leaves its volumes detached with their contents intact (test).
  - done: impl-1772 · 2026-11-09T12:50:14.425Z
- [x] C5. A fake volume record written by the previous code, with one snapshot receipt, still reads, and malformed retained state still reports failed or incomplete with its bytes untouched (test).
  - done: impl-1772 · 2026-11-09T12:50:14.701Z
- [x] C6. The DigitalOcean provider answers each new operation `failed` naming it unsupported, with no API call, and the existing volume test files pass with no test edited (test).
  - done: impl-1772 · 2026-11-09T12:50:15.109Z

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/provider/provider.ts`, `hub/src/host/provider/fake.ts`, `hub/src/host/provider/fake-volume-record.ts`, `hub/src/host/provider/digitalocean.ts` (three refusing stubs only), `hub/test/host-provider-contract.ts` (new volume cases), `docs/hub/host-providers.md` (a new subsection, no paragraph rewritten).
- Tests: `hub/test/host-provider-volumes.test.ts` (T2, edit: new cases only); `hub/test/host-provider-digitalocean-volumes.test.ts` passes unchanged.
- Serves epic C2, C3 and C4 (the fake volume behaviour every later test stands on), and the DoD's "volumes attaching to one host at a time and a snapshot rate limit".

## Comments

### impl-1772 · 2026-11-09T12:47:05.436Z

Rule 20 sweep before implementation: shared suite importingTests graph across all hub/nvim/web .test.ts[x] roots reached 655 tests plus 15 unknowns counted reached; complete names/errors in item artifact provider consumer sweep. Explicit field/function search covers snapshotVolume, lastSnapshotAt, parseFakeVolumeRecord, createVolume, VolumeSnapshot, CreateVolumeOptions, listSnapshots. Consumers: provider.ts/fake.ts/fake-volume-record.ts/digitalocean.ts (migrated additively); host-provider-contract.ts (new cases opt-in for fake), host-provider-volumes.test.ts (new cases only), host-provider-digitalocean-volumes.test.ts (unchanged old shape regression); executor/droplet/api.ts (native API independent unchanged); docs/hub/host-providers.md (add subsection); qa/briefs/E-1533.md and docs/spec/v0.4.md (historical requirements unaffected). Production registry, pool runtime, provision/restart/watchdog, hub daemon/dispatch use machine lifecycle and unchanged Volume fields; no wire frame change. Other graph consumers retain old methods/fields, including T3/T4; no registration points touched. Red receipt: fake login contents case fails TypeError p.volumeContents is not a function on macOS Node 24.21.0, isolated local T2 name run.

### rev-35 · 2026-11-09T12:55:12.222Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1772-source-1
commit: c090c1d399385bdedaf57efb374101524e30a83b
scope: full
findings: [{"severity":"medium","text":"Spec/C2 amendment6fb3741c: listSnapshots still returns generic failed when the source volume is deleted, and HostProvider has no getSnapshot-by-id seam. Coordinator explicitly decided typed volume-gone listing and receipt/id-based surviving snapshot lookup/clone/delete, without tombstone/index. Add the shared outcome/lookup contract, fake behavior, unsupported DigitalOcean coverage and live-volume-deletion/surviving-id regression/docs before verification.","file":"hub/src/host/provider/provider.ts","line":60}]
finding_counts: {"high":0,"medium":1,"low":0}

NOT CLEAR,Standards0/Spec1medium; A-18052. Directly read Coordinator6fb3741c amendment: keep receipt/id-based survival,no tombstone/index; list deleted volume returns typed volume-gone and getSnapshot/clone/delete surviving IDs. Author confirms pending amendment. Other initial-task source behavior consistent; C1/C3–C6 runtime-unverified. A-18050 selected original tool transcripts and static null-status propagation/candidate limits inspected,not immutable gate proof; no provenance-only rerun. Normalized A-18049 inventory670paths retained,not coverage. Earlier no-native claim corrected: direct destroy-native/create-ready/provision-gate after fresh source clearance under lock,standing Linux/batch/T4 split. Head clean; no Reviewer execution; full after-stage QA separate.

Criteria: C2 failed (Coordinator6fb3741c requires typed volume-gone listing plus surviving snapshot lookup by id; current contract returns generic failed and lacks getSnapshot.).

### impl-1772 · 2026-11-09T12:56:01.955Z

Rule 20 amendment sweep before changes: prior full transitive graph inventory A-18042/A-18049 still applies (same provider modules/contract registrar, 670 reached including unknowns). Explicit getSnapshot/volume-gone/listSnapshots/deleteSnapshot/fromSnapshot field/function search: production consumers provider.ts, fake.ts, digitalocean.ts only; host-provider-contract.ts and host-provider-volumes.test.ts migrated additively; docs/hub/host-providers.md and per-test guide amended. No wire, persisted login record, CLI, QA or browser consumer currently calls these added operations. Retain VolumeSnapshot receipt inputs while widening to IDs; DigitalOcean previous methods remain unchanged. Coordinator 6fb3741c decides volume-gone listing, by-id lookup/clone/delete, no tombstone/index.

### rev-38 · 2026-11-09T13:00:07.124Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1772-source-2
commit: e9f824748011374a5c0f855f5f66f28a14866712
scope: full
findings: [{"severity":"medium","text":"ID delete removes the snapshot directory/volumeId sidecar before live-volume history publication. If #writeVolume fails, retry by ID skips history repair and reports deleted while listSnapshots permanently lists the deleted receipt. Retain recovery identity through publication and regress fault+recreated-provider ID retry.","file":"hub/src/host/provider/fake.ts","line":120}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at exacte9f824748011374a5c0f855f5f66f28a14866712. Coordinator6fb3741c amendment otherwise implemented: typedvolume-gone and surviving IDs lookup/clone/delete,no tombstone. One medium C2 retry/publication finding atfake.ts120–125; retained sidecar identity is lost before history write can settle. Prior source finding resolved; C1/C3–C6 runtime-unverified. Read full amended source/consumer/test/docs paths, no Reviewer test/native/browser execution. Candidate61T2/typecheck claims A-18057 remain pre-commit evidence, not configured proof. Fix+fresh source review before native preservation/verification; after-stage QA remains separate.

Criteria: C2 failed (ID-only retry after live-volume history publication failure returns deleted with stale snapshot listing because the snapshot's volumeId metadata was already removed.).

### rev-38 · 2026-11-09T13:02:18.793Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1772-source-3
commit: b9187618229fd9eabc0d5826d5018de6d7bf99f2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exactb9187618229fd9eabc0d5826d5018de6d7bf99f2. A-18062 C2 finding resolved: keep snapshot-owned recovery metadata until confirmed contents absence and durable live-history publication, then remove/read back directory absence. Recreated-provider ID-only retry regression retains final listing/lookup assertions; fake fault defaults off; no deleted-volume index. Coordinator6fb3741c typedvolume-gone/getSnapshot/IDclone/delete amendment retained, receipt compatibility and DO unsupported unchanged. Reviewed4-file correction with prior full source; C1–C6 remain runtime-unverified. Candidate62T2/typecheck A-18065 is not configured evidence. Proceed exact-head planned native preservation then mode-free verify; after-stage QA separate. Reviewer ran no tests/browser.
