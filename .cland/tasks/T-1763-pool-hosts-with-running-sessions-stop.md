---
id: T-1763
kind: task
title: "Pool hosts with running sessions stop renewing their lease and get deleted: creation passes no in-use predicate"
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
regression_of: T-1746
topic: topic-1442
branch: t/T-1763-pool-hosts-with-running-sessions-stop
created: 2026-11-08T11:58:49.461Z
updated: 2026-11-08T13:20:12.451Z
closed: 2026-11-08T13:20:12.451Z
---

## Summary

A pool host with a running session lost its lease renewal and was deleted by its watchdog (E-1534 stage-2 QA, E1534S2-55, A-17820). Host creation passes no `inUse` callback (`hub/src/hub/dispatch.ts:550–558`), so lease renewal falls back to `heldByMinimum` (`hub/src/host/provision-host.ts:86`). With `min_hosts = 1`, the startup host H1 (running w1) stopped counting once on-demand host H2 appeared, its 30 s lease lapsed, and the watchdog deleted it at 11:51:01Z while w1 was still recorded running.

## What to build

One shared in-use predicate for every create path: the `min_hosts` startup create, on-demand scale-up, and manual `cland host create`. A host is in use, and its lease keeps renewing, while any of these holds:
- it carries a session that has not exited;
- it holds a placement promise (milli-slot reservation) for a waiting or launching session;
- it is one of the hosts kept for `min_hosts`.

The `min_hosts` choice must be stable: never move the minimum onto a newer host while an older one is in use, and prefer the hosts that are in use. Sessions and pool runtime already know usage; wire them in, don't duplicate the counts.

## Acceptance criteria

- [x] C1. A host with a running session keeps renewing its lease when another host in the pool appears, with `min_hosts = 1` and `max_hosts = 2`. Reproduce QA's sequence on the fake provider with the hub clock, red first.
  - done: impl-1763 · 2026-11-08T12:04:30.682Z
  - verified: rev-35 [reviewer] · run rev-35-1763-final-1 · 2026-11-08T12:27:20.793Z · commit 8ca8c76bdb8280cfed9e522bc66e0105fbc7f884
- [x] C2. A host holding a placement promise for a waiting or launching session keeps renewing until the promise is released.
  - done: impl-1763 · 2026-11-08T12:04:39.477Z
  - verified: rev-35 [reviewer] · run rev-35-1763-final-1 · 2026-11-08T12:27:20.794Z · commit 8ca8c76bdb8280cfed9e522bc66e0105fbc7f884
- [x] C3. An idle host beyond `min_hosts` stops renewing, so expiry and confirmed destroy proceed as T-1747 built them. The min-host set prefers hosts in use and never drops a host in use.
  - done: impl-1763 · 2026-11-08T12:04:39.738Z
  - verified: rev-35 [reviewer] · run rev-35-1763-final-1 · 2026-11-08T12:27:20.794Z · commit 8ca8c76bdb8280cfed9e522bc66e0105fbc7f884
- [x] C4. Manual `cland host create`, startup `min_hosts` and on-demand scale-up all pass the same predicate. One test per path shows it.
  - done: impl-1763 · 2026-11-08T12:04:40.116Z
  - verified: rev-35 [reviewer] · run rev-35-1763-final-1 · 2026-11-08T12:27:20.794Z · commit 8ca8c76bdb8280cfed9e522bc66e0105fbc7f884

## Comments

### impl-1763 · 2026-11-08T12:00:10.906Z

Consumer sweep before renewal policy wiring: production createHost callers are Dispatcher.#createPoolHost (manual host.create and Sessions.startPoolScaling startup/demand); direct createHost fixtures in host-lease, host-create, host-watchdog and host-allow-list. PoolRuntime consumes Sessions.#capacityProcesses (running, pending-stop and retained unknown-closure generations) and placement promises. heldByMinimum is used by createHost fallback and host-provision-records tests. No wire/record shape changes or fake API changes planned; existing clients, startup probes, persisted readers and T3/T4 callers retain their interfaces. T2 seam explicitly supplied by Coordinator: injected creator on projectHub, real lease owner and hub FakeClock; native fake-provider acquisition remains in preservation files.

### rev-35 · 2026-11-08T12:07:35.938Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1763-source-1
commit: 8ca8c76bdb8280cfed9e522bc66e0105fbc7f884
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17824 source clear, Standards0/Spec0; C1–C4 runtime-unverified. Shared Dispatcher creator supplies live Sessions/PoolRuntime predicate on manual/startup/demand; existing capacity generations and promises reused, current minimum busy-first then age/id. Existing ready gate/lease30s/expiry/deletion unchanged. Three T2 clock/lease controls cover paths and release boundaries; prearmed fixture release/join and mirror observations inspected. Exact clean head/base4688f9566/diffcheck0 confirmed. A-17823 qualified original tool excerpts show red1fail→components78/78/nativewatchdog2/2/typecheck0, status propagation and candidate/post-run-unused-local/docs changes, no immutable head/fullraw/Linux claim. Proceed exact-head mode-free configured verification for final settlement; no Reviewer runtime/edit/delegation or extra native/fullsuite/provenance repeat/dev merge requested. Affected after-stage QA separate.

### rev-35 · 2026-11-08T12:27:20.794Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1763-final-1
commit: 8ca8c76bdb8280cfed9e522bc66e0105fbc7f884
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final A-17826 audits same-head A-17825/cbe6ec7d. Clean unchanged8ca8c76bd and independently rebuilt exportb7e14f660b92d4e10fcc198ae40057eeb0a2066f match. Three new lease cases basepass1.093035483/0.296744329/0.493012483s plus5/5load each=15pass; maxload1.202643146s, no allowance needed. Poolscale19/19 and hostlease17/17 base pass. C1–C4 verified, Standards0/Spec0. Hub5579/5579, base5441/5441, five empty failure arrays; T0/allT1/fallbackallT2/mappedT4base/Web nativeuncachedLinuxx64Node24.21Nvim0.12.5green, zero fail/cancel/skip/todo; Shell1248/CfT156.0.8078.4. No configuredT3, remainingT3batch/T4repetitions skipped; report-only notices retained. A-17823 candidate/native provenance limits retained. No Reviewer runtime/edit/delegation or extra unchanged/provenance repeat/devmerge requested. E1534 affected after-stage QA separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-08T13:20:12.451Z

Merged 550e59aca718ee0e8952ce86dfdde984cfc9e33d onto dev.
