---
id: T-1782
kind: task
title: "DigitalOcean login volumes: from a snapshot, snapshot history, no test-only refusal"
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
topic: topic-1462
branch: t/T-1782-digitalocean-login-volumes-from-a
created: 2026-11-09T12:44:10.329Z
updated: 2026-11-10T05:22:13.267Z
---

## Summary

The DigitalOcean provider implements T-1772's three volume operations through its API: a volume created from a snapshot, a volume's snapshots listed, and a snapshot deleted with a confirming read. Its volume creation drops the "test-only" refusal: it proceeds when the caller supplies a login admission, and without one it is refused before any API call. Volumes carry the cland, project and pool tags, so the hourly lost-work check finds them.

## What to build

The API calls behind the three operations:
- `POST /volumes` with `snapshot_id`;
- `GET /volumes/<id>/snapshots`;
- `DELETE /snapshots/<id>`, confirmed by a GET that reads 404.

The snapshot window's 429 keeps mapping to `refused` with `rate limited` and a retry time. The login model passes a login volume admission (login, project and pool), and a create without one is refused naming it. The fake DigitalOcean API grows the endpoints. `docs/hub/host-providers.md` gains a subsection in place of the test-only sentence. A real DigitalOcean volume is created only in E-1539's live run.

## Acceptance criteria

- [x] C1. Against the fake API, a volume created from a snapshot sends that snapshot id, the region, and the cland, project and pool tags (test).
  - done: impl-1782 · 2026-11-10T05:14:11.298Z
- [x] C2. `listSnapshots` and `deleteSnapshot` go through the fake API, and a delete reports deleted only after a GET reads 404 (test).
  - done: impl-1782 · 2026-11-10T05:14:11.514Z
- [x] C3. A volume create without a login admission is refused before any API call naming the admission, and with one it reaches the fake API outside the fake-host fence (test).
  - done: impl-1782 · 2026-11-10T05:14:11.856Z
- [ ] C4. The DigitalOcean provider passes the volume contract cases T-1772 added (test).
  - failed: rev-35 [reviewer] · 2026-11-10T05:18:44.788Z · note Retained T-1772 DigitalOcean snapshot refusal consumer contradicts the new provider and remains unmigrated; identity/project ownership contract negatives are also missing.
- [x] C5. No code, test or doc still names the test-only volume refusal.
  - done: impl-1782 · 2026-11-10T05:14:12.444Z

## Blocked by

- T-1772

## Notes

- Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/src/executor/droplet/api.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `docs/hub/host-providers.md`.
- Tests: `hub/test/host-provider-digitalocean-volumes.test.ts` (T2, edit), fake DigitalOcean API only; never a token or a real API.
- Serves epic C4 (single attachment on DigitalOcean) and C9 (the volume inventory), on the production provider path.

## Comments

### impl-1782 · 2026-11-10T05:10:10.670Z

Rule 20 sweep before change: suite importingTests transitive graph over hub/web/nvim all tiers reached 665 tests and 15 unknowns (counted reached); full list in consumer artifact in item topic. Explicit consumers: provider.ts, fake.ts, digitalocean.ts, droplet/api.ts and deadline.ts; prepare.ts, snapshot-recovery.ts, executor-prepare-component, executor-snapshot-confirmation, host-provider-digitalocean-prepare; host-provider-contract, host-provider-volumes, host-provider-digitalocean-volumes, host-login-disk; docs/hub/host-providers and both volume test guides. No CLI/wire/persisted-record shape changes. Admission is optional on the common options; fake callers remain valid. DigitalOcean fixture will supply admission; numeric droplet snapshot API remains compatible. No shipped skills, QA briefs or startup probes use these volume methods. Unknown graph tests are retained as reached, not excluded.

### impl-1782 · 2026-11-10T05:14:22.585Z

Implementation pushed at 55591ba14b761682c69808f5a1c5365cd68b07af. C1–C5 done; source review assigned to reviewer (full head corrected in topic). Local macOS Node 24.21.0: 65/65 focused cases, hub typecheck, child-env and closed-wording lints; scratch fake root inventory 0→0. Evidence A-18253. No changed native test files; full T3 deferred to merge batch, T4 to stage/epic. Linux mode-free verification awaits source verdict.

### rev-35 · 2026-11-10T05:18:44.788Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1782-source-1
commit: 55591ba14b761682c69808f5a1c5365cd68b07af
scope: full
findings: [{"severity":"high","text":"deleteSnapshot(receipt) discards captured volumeId/created and immediately deletes by id, unlike the fake receipt validator. A mismatched/stale receipt can authorize destructive mutation. Validate the supplied receipt against fresh snapshot identity before DELETE; ID-only deletion must retain its separately defined contract. Author confirms no other owner/exception.","file":"hub/src/host/provider/digitalocean.ts","line":374},{"severity":"high","text":"Restoration validates source receipt fields but never binds the source snapshot to options.project; an admitted project can clone a different project's login snapshot and tag the copy as its own. FakeHostProvider preserves source project ownership. Add a shared durable ownership path that also works after source-volume deletion and rejects mismatches before POST. Author confirms this is a gap.","file":"hub/src/host/provider/digitalocean.ts","line":383},{"severity":"medium","text":"The T-1772 DigitalOcean consumer still asserts all new snapshot operations fail/unsupported with no API calls. New outcomes violate it. Migrate this consumer and its per-test guidance; docs/hub/host-providers.md512–515 also still says the operations are unsupported, and the historical stage1 QA brief needs an explicit superseded disposition. No migration approval exists.","file":"hub/test/host-provider-volumes.test.ts","line":174},{"severity":"medium","text":"beforeDirectories awaits beforeClose before api.close without attempt-all/finally. If the held-action drain rejects, API drainage is skipped; immediate ownDirectory retains the root but does not close its producer. Prearm attempt-all joins and retain incomplete closure evidence/root. Author confirms no earlier close owner.","file":"hub/test/host-provider-digitalocean-volumes.test.ts","line":17},{"severity":"medium","text":"The removed test title still owns baseline0.009497 after its behavior/title changed to admission-based pooling. Existing duration-identity lint rejects proven-absent keys. Remove the orphan measurement rather than transplanting it to changed behavior; obtain new timing through ordinary producers. Author confirms no approved migration.","file":"hub/test/durations.json","line":11138}]
finding_counts: {"high":2,"medium":3,"low":0}

A-18257: Standards5(2high/3medium),Spec0additional. Confirmed missing delete-receipt identity and cross-project snapshot restore gates, stale unsupported consumer/docs/QA disposition, fail-fast fixture drainage and orphan timing identity. C4failed; runtimeC1–C5unverified. A-18256 transcript/candidate/initial-isolation limits retained; A-18255 preservation pending (normalize20objectT3 tiers). Correct at new head, fresh source review before verify; no reviewer experiments.

Criteria: C4 failed (Retained T-1772 DigitalOcean snapshot refusal consumer contradicts the new provider and remains unmigrated; identity/project ownership contract negatives are also missing.).

### impl-1782 · 2026-11-10T05:22:13.267Z

Review-fix timing disposition: removed only the orphan baselines for host-provider-digitalocean-volumes.test.ts::digitalocean volume creation requires a pool, shares pause and resolves acquire pool, and host-provider-volumes.test.ts::digitalocean new snapshot operations refuse without API calls. Both test identities no longer exist at this candidate; their measurements were not transferred. Snapshot ownership now persists by root/project/source receipt for restore and delete. Preservation slot acquired via successful mkdir but no native file launched; Coordinator reassigned slot to T-1778 during a collision, so waiting after T-1778 and T-1777, lock left untouched.
