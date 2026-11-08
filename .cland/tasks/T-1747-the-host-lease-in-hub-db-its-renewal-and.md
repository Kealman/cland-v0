---
id: T-1747
kind: task
title: The host lease in `hub.db`, its renewal and its spend reservation
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1737
  - T-1738
  - T-1742
topic: topic-1435
branch: t/T-1747-the-host-lease-in-hub-db-its-renewal-and
created: 2026-11-07T16:01:58.643Z
updated: 2026-11-08T02:12:01.845Z
closed: 2026-11-08T02:12:01.845Z
---

## Summary

Every host has a lease in `hub.db`, in its own table. The lease is written before the provider's create call, with a deadline of `[hosts] lease` (12 h by default), and is held until the host's deletion is confirmed. At create, the host reserves its price up to the deadline under the ledger's `hosts` category; a reservation the caps refuse stops the create before any provider call. While the host has sessions or is held by `min_hosts`, the lease is renewed to a full lease from now, and its reservation raised, every min(1 h, lease / 4). Deletion settles the cost on the real lifetime. A per-host lease file mirrors the deadline for the detached watchdog (T-1748).

## What to build

The lease table and a per-host renewal timer on the hub clock, armed at create, with a caller-supplied "in use" predicate. The reservation and settlement go through T-1742's API. The lease file is written after the database and never holds a later deadline than it; the watchdog never opens `hub.db`. There is no `daemon.ts` change: re-attaching renewal after a hub restart is T-1752's. Until then a restarted hub does not renew leases, which is acceptable on the fake provider, since DigitalOcean creation stays refused until T-1756.

## Acceptance criteria

- [x] C1. A lease row with deadline create + `[hosts] lease` exists before the provider's acquire is called, and the hosts reservation is in the ledger with the host's pool (test).
  - done: impl-1747 · 2026-11-08T01:07:38.009Z
  - verified: rev-36 [reviewer] · run rev-36-1747-final-1 · 2026-11-08T01:34:59.315Z · commit 5515564ed432d577cd61a6a6d1d244df333f5a3f
- [x] C2. A create whose reservation the hosts cap refuses makes no provider call and leaves no lease (test).
  - done: impl-1747 · 2026-11-08T01:07:40.450Z
  - verified: rev-36 [reviewer] · run rev-36-1747-final-1 · 2026-11-08T01:34:59.315Z · commit 5515564ed432d577cd61a6a6d1d244df333f5a3f
- [x] C3. On the hub clock, a host with a session or held by `min_hosts` is renewed every min(1 h, lease / 4) to a full lease from now, with its reservation raised, and an empty host above `min_hosts` is not renewed (test).
  - done: impl-1747 · 2026-11-08T01:07:40.659Z
  - verified: rev-36 [reviewer] · run rev-36-1747-final-1 · 2026-11-08T01:34:59.315Z · commit 5515564ed432d577cd61a6a6d1d244df333f5a3f
- [x] C4. The lease is released and the cost settled on the real lifetime only after the provider confirms deletion, and an unconfirmed deletion keeps both (test).
  - done: impl-1747 · 2026-11-08T01:07:41.135Z
  - verified: rev-36 [reviewer] · run rev-36-1747-final-1 · 2026-11-08T01:34:59.315Z · commit 5515564ed432d577cd61a6a6d1d244df333f5a3f
- [x] C5. The lease file's deadline never runs later than the database's, including across a renewal (test).
  - done: impl-1747 · 2026-11-08T01:07:41.338Z
  - verified: rev-36 [reviewer] · run rev-36-1747-final-1 · 2026-11-08T01:34:59.315Z · commit 5515564ed432d577cd61a6a6d1d244df333f5a3f

## Blocked by

- T-1737
- T-1738
- T-1742

## Notes

- Hot files: `hub/src/host/host-leases.ts` (new), `hub/src/host/provision-host.ts` (lease and reservation before acquire, renewal timer, settle at confirmed release), `hub/src/host/provision-records.ts` (if the lease joins that store).
- Tests: new `hub/test/host-lease.test.ts` (T2, fake clock, fake provider, isolated `XDG_STATE_HOME`).
- Serves epic C5 and C7.

## Comments

### impl-1747 · 2026-11-08T00:40:10.789Z

Rule-20 sweep before edits: createHost consumers hub/src/host/host-create-entry.ts, hub/src/cli/host.ts; destroyHost via hub/daemon.ts; persisted provisions via host/records.ts, provision-records.ts, provision-host.ts and store initialization. Runtime importing tests: host-create-ready (T3), host-provision-gate (T3), host-destroy (T3), host-destroy-native (T3), host-provision-recovery (T2); type-only host-create-entry (T1). New lease table/API and mirror are additive, no ProvisionRecord or wire-shape changes. host-provision-records (T1) exact record expectations remain unchanged; host-spend (T1) ledger contract remains unchanged. Broader field/function sweep found no web/nvim consumers of provision-host; will rerun listed files and T0. A-17473 decisions 9/10/14/17 bind lease ordering, cadence, shared manual admission, ledger compatibility.

### impl-1747 · 2026-11-08T00:44:53.366Z

Expanded rule-20 runtime sweep covers HostRecords additive constructor and registry shutdown: host-agent-closure, host-agent-restart, host-attach, host-attach-routing, host-clone-integration, host-readiness-owner, host-records, host-relaunch, host-relaunch-native, host-relaunch-retry, host-runtime-owner, host-secret-admission, host-ssh-contract, host-ssh-registry, host-survival-native, host-reboot-native, remote-discovery-host, transport-forwards, transport-records, transport-ssh, transport-status. host-create-entry imports type only; state-paths-lint names records as a string and is unaffected. Existing record fields/exact shapes and hostPaths unchanged. Registry close now awaits leases.close; T-1748/T-1752 reuse records.leases and hostLeasePath. New docs specify the mirror shape; no wire change.

### impl-1747 · 2026-11-08T00:45:23.935Z

Coordinator approved exactly clock:core.clock in hub/src/hub/dispatch.ts:2078 destroyHost arguments, committed separately for lane-1 merge coordination. All other dispatch content unchanged. Native slot began 00:44Z; remaining registry/record consumer files run serially and will release within 15 minutes.

### impl-1747 · 2026-11-08T00:54:56.099Z

Rule-20 sweep for Coordinator-approved zero-cost host reservation cancellation API (before contract edit): production ledger reader/writers hub/src/executor/droplet/spend.ts (totals, reconcile, reserve/renew/settle/inspect); droplet.ts (verify admissions/inspection), hub dispatch executor/spend replies, later T-1755 host status and T-1751 sub-cap use inspectHostSpend/totals. Existing ledger v1 readers keep additive category/pool fields and cost=0/released as settled (legacy reconcile max reservation, settlement cost). New API will reuse locked() and durable project+lease identity; no ledger version or row-shape change required. Tests importing spend.ts: host-spend, droplet-spend-async, droplet-legacy-retire, droplet-ledger-identity, droplet-project-reconcile, droplet-projects-async, droplet-identity, droplet-executor, host-lease (exact list checked by rg). QA/skills/docs existing ledger paths retain cost/null semantics; cancellation adds cost=0, so no live reservation after cancellation. ProvisionRecord gets an additive pinned never-acquired receipt; unknown in-flight acquisition is ineligible. Previous record shapes stay supported.

### impl-1747 · 2026-11-08T00:55:05.003Z

Correction to prior ledger-consumer test names: actual rg results (no droplet-* files named there exist) are executor-spend, executor-lock-liveness, executor-reap-confirmation, executor-deletion-confirmation, suite-accounting, suite-dry-run, executor-safety, suite-close-component, executor-admission-lock, executor-retirement-component, account-fixture-env, state-paths, suite-soak-component, host-spend and host-lease. These actual files, plus indirect executor callers, define the cancellation regression selection. Existing wire/ledger shapes remain unchanged.

### rev-36 · 2026-11-08T00:56:45.658Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1747-source-1
commit: 66468c5a1b0cdfe45b35a3a6430985b8be3f8c65
scope: full
findings: [{"severity":"high","text":"Reservation/DB/initial mirror and provision save precede creation ownership and try/finally. Post-reservation admission failure can leave an orphan ledger reservation/lease with no provision id or timer for recovery. Install durable ownership and zero-acquire unwind/recovery; test initial DB/mirror/checkpoint failures.","file":"hub/src/host/provision-host.ts","line":71},{"severity":"high","text":"arm runs before creations.set. Ledger admission can outlast a30s lease; immediate expiry then sees no creation owner/machine and stops, while create subsequently proceeds to acquire under the expired lease. Register cancellation/completion first and gate acquire on a live effective deadline; test held admission across expiry.","file":"hub/src/host/provision-host.ts","line":73},{"severity":"medium","text":"Published mirror read/parse errors escape schedule/timer callbacks outside owned error handling and can reject finally(schedule). leases.close rejection also skips registry native closeOwners. Handle malformed/unreadable published files conservatively through owned errors/expiry and drain remaining owners even on failure.","file":"hub/src/host/host-leases.ts","line":59},{"severity":"medium","text":"Known pre-acquire failure or explicit acquire refusal uses leases.release/settleHostSpend, which charges billing minimum despite no resource. Add zero-cost cancellation bound to never-called/refused receipt, retain unknown outcomes, and test nonzero price/minimum.","file":"hub/src/host/provision-host.ts","line":134}]
finding_counts: {"high":2,"medium":2,"low":0}

A-17655 full source review not clear:2high/2medium. Exact initial-publication, ledger-held expired-admission, published-file read and non-acquisition charge paths documented. C2/C5 remain unverified; no configured verification yet. Evolving-tree importer receipts qualified, no Reviewer execution. Implementer acknowledged directions7638ee9c/92cdde5f; correct at new head with retained red/green and fresh source review before verification. Affected after-stageQA separate.

Criteria: C1 failed (Post-reservation admission failures lack durable creation/recovery ownership and can orphan lease/spend.), C3 failed (Expiry can precede creation ownership and timer mirror errors escape owned drainage.), C4 failed (Positively known non-acquisition is settled with a nonzero billing minimum rather than zero-cost cancellation.).

### rev-36 · 2026-11-08T01:04:34.261Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1747-source-2
commit: f21a22cce02b17ad28710621468538f9390f6188
scope: full
findings: [{"severity":"medium","text":"admissionFixture registers leases.close/db.close in beforeDirectories first; this later same-phase callback releases the ledger lock and joins create only after SQLite has closed on early body failure. Runtime owner.close at226 is similarly after DB close. Move producer/lock/runtime drainage to onCleanup resource phase and prove forced early failure joins work before storage/root disposal.","file":"hub/test/host-lease.test.ts","line":211}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17661 source2 not clear on one new medium fixture-ordering issue. All four A-17655 production findings are source-resolved: durable admission before spend, effective deadline checks, typed conservative published-read expiry/registry drainage, positive-receipt zero cancellation with unknown outcomes held. New async failure fixture registers DB close before producer/native-owner drainage; implementer db536901 acknowledged, will join active native batch then test-only fix/fresh review. All criteria remain runtime-unverified; no Reviewer execution, affected after-stageQA separate.

Criteria: C3 failed (Held-admission and runtime shutdown failure controls can close SQLite before pending producer/runtime owners are joined.).

### rev-36 · 2026-11-08T01:09:16.516Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1747-source-3
commit: 5515564ed432d577cd61a6a6d1d244df333f5a3f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17664 source clear. A-17661 fixture issue resolved with producer/lock/runtime drainage in resource phase before DB, same-fixture forced early exit proving join while open then storage closed. Production unchanged from source-resolved f21a22cce. Coordinator5d414f57 carry conditions independently checked: only host-lease.test.ts changes, no external/native imports/exports. A-17663 predecessor native/importer outcomes remain qualified; final needs retained originals plus fresh new-head configured named receipts. C1–C5 remain unverified, no Reviewer execution; affected after-stageQA separate.

### rev-36 · 2026-11-08T01:34:59.315Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1747-final-1
commit: 5515564ed432d577cd61a6a6d1d244df333f5a3f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17679 final clear; C1–C5 verified at unchanged5515564ed. Independently read37 criterion-file finishes+100/100 new load passes,26/26 T1/T2 importer file completions, fresh0f428ba1/A-17675 green5479/5479,T0/T1/fallbackT2/changedT3gate5/Web. A-17666 carries17 T3 files129pass/normalexit0 fromf21a22cce under Coordinator5d414f57's independently checked test-only/no-import conditions; per-case native stdout omitted/unavailable, not reconstructed. Current Linux named criteria separate. Prior4production+fixture findings resolved; actual phase/provenance limits retained. No Reviewer execution; remainingT3/T4/affected after-stageQA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-08T02:12:01.845Z

Merged 77579ea01c7d2ccc47e9aa39967d58901b83ab21 onto dev.
