---
id: T-1711
kind: task
title: Provider declarations and the billing minimum
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1707
topic: topic-1407
branch: t/T-1711-provider-declarations-and-the-billing
created: 2026-11-06T10:48:10.742Z
updated: 2026-11-06T14:37:35.706Z
closed: 2026-11-06T14:37:35.706Z
---

## Summary

Each provider declares its live and idle price per hour per size, whether a stopped machine bills compute (and so stopping destroys it), its billing granularity and minimum, its token confinement, its API pacing, its machine limit, its CPU architecture and any extra paid address its SSH needs, counted in the idle price. A pure policy function gives the earliest time a host may be stopped, which the scheduler's `idle_stop` (E-1534) must call.

Hot files: `hub/src/host/provider/provider.ts`, `hub/src/host/provider/declarations.ts` (new), `hub/src/host/provider/fake.ts`, `hub/test/host-provider-declarations.test.ts` (new)

## What to build

A validated declarations type, configurable on the fake provider, and `earliestStop` over the host's created time, its idle-since time, the pool's `idle_stop` and the declared minimum. The contract suite checks that every field is present and sane. Decision (coord, open question 6): `idle_stop` does not exist yet, so the criterion is met by `earliestStop` with a unit test; E-1534 calls it.

## Acceptance criteria

- [x] C1. The contract suite fails a provider missing any declared field, a negative price, or a minimum that is not a multiple of its granularity (test).
  - done: impl-1711 · 2026-11-06T13:08:56.343Z
  - verified: rev-35 [reviewer] · run rev-35-1711-final-1 · 2026-11-06T13:35:30.031Z · commit 2e6995e02f0fa8b7dda0db57ec8fb978c64a4c85
- [x] C2. An extra paid address is added to the declared idle price, and `stoppedBills = true` makes the declared stop action `destroy` (test).
  - done: impl-1711 · 2026-11-06T13:08:56.542Z
  - verified: rev-35 [reviewer] · run rev-35-1711-final-1 · 2026-11-06T13:35:30.032Z · commit 2e6995e02f0fa8b7dda0db57ec8fb978c64a4c85
- [x] C3. `earliestStop` never returns a time before the created time plus the declared billing minimum, even with an `idle_stop` shorter than it (test).
  - done: impl-1711 · 2026-11-06T13:08:56.780Z
  - verified: rev-35 [reviewer] · run rev-35-1711-final-1 · 2026-11-06T13:35:30.032Z · commit 2e6995e02f0fa8b7dda0db57ec8fb978c64a4c85

## Comments

### impl-1711 · 2026-11-06T13:05:24.996Z

Rule 20 sweep before edits: HostProvider implementations/importers are provider.ts, fake.ts, registry.ts and hub/test/host-provider-contract.ts plus host-provider-fake.test.ts. Guide consumers: docs/hub/host-providers.md and docs/agents/tests/hub-test-host-provider-fake.test.ts.md. Full field/function/import searches across hub, shared, web, nvim, docs, qa and .agents found no startup probes, shipped skill examples, wire clients, persisted declaration readers or T3/T4 consumers. Migrate these consumers additively; retain Machine, lifecycle outcomes and provider.json shape unchanged. T-1708 API pacing declaration requested through lead; independent billing work proceeds.

### rev-35 · 2026-11-06T13:11:28.792Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1711-source-1
commit: 8cbebdbe820bf7f817686e22d908c6e2e7b0364d
scope: full
findings: [{"severity":"medium","text":"New declarations permit single-architecture providers, but lifecycle/fault contract cases hard-code x86_64 and reap hard-codes arm64. Valid single-architecture providers cannot pass this reusable contract; the configurable fake masks unsupported requests. Select validated declared architecture per provider, retain returned-machine assertions, and register both single-architecture controls with enforcing acquire seams; make fake unsupported acquisition a typed failure.","file":"hub/test/host-provider-contract.ts","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17128: full source not clear, one medium architecture consumer migration gap confirmed by Implementer57e52a4f; no external both-architecture guarantee. Billing validation/normalization/earliestStop, pure test tiers, docs/index and unchanged lifecycle wire/storage inspected; no further findings. C1–C3 remain unverified, no executed billing criterion failure inferred. A-17127 local summaries qualified; no Reviewer execution/configured receipt. Fresh corrected source head before verification; affected after-stageQA separate.

### rev-35 · 2026-11-06T13:12:38.629Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1711-source-2
commit: 2e6995e02f0fa8b7dda0db57ec8fb978c64a4c85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17130: cumulative corrected source clear, no findings. Every lifecycle/fault contract acquire uses validated declared architecture; machine assertion preserved, both single-architecture full registrations enforce the acquire seam. Fake unsupported acquisition fails before creation; empty reap checked. Prior declaration validation, immutable price normalization/stopAction and earliestStop remain correct; tiers/docs/index inspected. No Reviewer execution. A-17129 targeted37/37 summary and final request typecheck claim qualified; C1–C3 remain unverified pending same-head configured evidence. Scheduler integration E-1534 and affected after-stageQA separate.

### rev-35 · 2026-11-06T13:35:30.032Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1711-final-1
commit: 2e6995e02f0fa8b7dda0db57ec8fb978c64a4c85
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17134: final same-head clear, C1–C3 verified. A-17132 run4cd721ab exit0 hub5207pass/zero fail,cancel,skip,todo; base5071pass and four empty failure arrays. Execution tree2eacf7df6fd8083301c496978b0ff4748814951e independently matches source projection. All37 provider cases basepass;22 new identities each five distinct passing load-gate test receipts, including malformed-field/contract controls, price/stopAction, earliestStop and both single-architecture contracts/unsupported acquisition. T0/T1/allT2/Web complete; T3deferred,T4unrun. A-17131 selected original-tool/timeline/type-only-change limits retained. Linuxx64 Node24.21/Nvim0.12.5 droplet c8nyc1 uncached, HeadlessShell1248/CfT156.0.8078.4. Report diagnostics advisory. Real-provider behavior, E-1534 scheduler integration and affected after-stageQA remain separate.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-06T14:37:35.706Z

Merged 5eb4c5158033ebc230e685400206c686a600190f onto dev.
