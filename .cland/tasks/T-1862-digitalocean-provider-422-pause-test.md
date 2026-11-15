---
id: T-1862
kind: task
title: Host admission fails a valid DigitalOcean create when an unrelated lease changes the spend ledger (seen as a 422-pause test flake)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1522
branch: t/T-1862-digitalocean-provider-422-pause-test
created: 2026-11-15T02:43:23.130Z
updated: 2026-11-15T13:57:06.694Z
closed: 2026-11-15T13:57:06.694Z
---

## Summary

`hub/test/host-provider-digitalocean.test.ts::digitalocean 422 pauses every create until retry time without POST cascades or token leaks` failed twice, with two symptoms:
- a 2 s test timeout in the E-1537 stage-4 macOS cover 145e3085 at 881114bfd (A-19474);
- one of three concurrent acquires returning `failed` after the pause expired, `['created','failed','created']` at line 368, in T-1806's Linux verify 8dd973c2 at fa6cb7c65 (A-19602).

impl-1862 reproduced the second symptom deterministically, and it is a product defect. While an acquire is importing its key, an unrelated lease that reserves spend changes the global spend ledger stamp. Host-create admission treats any ledger stamp change as invalidating, so it rejects its own valid reservation, and the acquire returns `{"state":"failed","reason":"DigitalOcean create failed; retained for reap"}`.

Cost in the reproduction:
- At the key-import boundary: 0 key POSTs, 0 droplet POSTs, 0 droplets, 0 keys.
- At the POST-authorization boundary: 1 key POST, 0 droplet POSTs, 0 droplets, and 1 imported key retained.

So no billable droplet was created, and one imported key was left for reap. Historical cost in production is unknown.

The macOS timeout is still unconfirmed. The likely cause is concurrent fixture admission waiting on the spend-lock backoff of an undriven FakeClock.

Policy kept: reserved capacity is never revoked by later reservations. Caps are checked when a reservation is admitted, by `reserveHostSpend`, not on every ledger mutation.

## What to build

- **Product.** Admission retries a bounded number of times on a stable snapshot when the ledger changed for an unrelated reason. Every retry re-runs the exact backing and revocation checks. Churn beyond the bound ends in a typed `HostAdmissionUnavailable`, and nothing is sent to the provider.
- **Fixture.** Admission issuance is serialized in the test fixture only, so concurrent setup does not park on an undriven FakeClock. Product acquires and admissions stay concurrent.

## Acceptance criteria

- [x] C1. A deterministic control shows an unrelated reservation during key import no longer fails a valid acquire. A released, revoked or changed-backing reservation, and an over-cap new reservation, are still refused. Churn beyond the bound ends in a typed refusal with no provider request. The item names the cost-boundary counts (test).
  - done: impl-1862 · 2026-11-15T10:32:25.924Z
  - verified: rev-35 [reviewer] · run rev-35-1862-evidence-1 · 2026-11-15T11:21:12.444Z · commit f02c4c772cbf048c0e8fd6ed01bd13430d1180d0
  - verified: rev-35 [reviewer] · run rev-35-1862-final-1 · 2026-11-15T11:42:57.057Z · commit f02c4c772cbf048c0e8fd6ed01bd13430d1180d0
- [x] C2. Both the 429 and the 422 cases pass 20 out of 20 runs at a 1-minute load of at least 8 on macOS, with unchanged assertions (test).
  - done: impl-1862 · 2026-11-15T11:36:25.841Z
  - verified: rev-35 [reviewer] · run rev-35-1862-final-1 · 2026-11-15T11:42:57.057Z · commit f02c4c772cbf048c0e8fd6ed01bd13430d1180d0

## Comments

### coord · 2026-11-15T10:23:13.000Z

Second failure, with a different symptom (2026-11-15, T-1806's mode-free verify 8dd973c2 at fa6cb7c65, Linux droplet, log A-19602). The 422 branch's recovery after the retry time expected `['created','created','created']` but got `['created','failed','created']` at host-provider-digitalocean.test.ts:368. One of the three concurrent acquires failed after the pause expired, and the test doesn't print the reason. The provider, fake API and test source are unchanged. Together with the macOS cover timeout (145e3085, A-19474), this points to a concurrency defect in the shared fake API or the provider around the pause expiry, not only a slow fixture. C1 should name both symptoms.

### impl-1862 · 2026-11-15T10:30:16.024Z

Deterministic red product control: unrelated spend-ledger publication during key-import or droplet-POST watchdog observation yields failed: DigitalOcean create failed; retained for reap. Request counts (key POST/droplet POST/droplets/keys) are 0/0/0/0 and 1/0/0/1 respectively. No billable droplet in these controls; second retains imported key. Historical cost unknown. Existing reserved capacity is never revoked by later reservations; over-cap new reservation is refused at reserveHostSpend. Mac timeout remains unconfirmed; fixture lock backoff on an undriven FakeClock is a candidate. C2 load awaits demo clearance.

### rev-35 · 2026-11-15T10:39:10.292Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1862-source-1
commit: e729fc55a35052c68dfc51fe2ab430f2d854800c
scope: full
findings: [{"severity":"medium","text":"New issue queue has no closed-admission fence/shared close completion/drain before leases/db close; provider/prepare API teardown runs first and removes the root without tracking issuance. Bind attempt-all issuance drainage before both root/API and SQLite disposal across all three fixture consumers, with held/queued-failure/post-close controls.","file":"hub/test/host-admission-fixture.ts","line":20},{"severity":"medium","text":"Executable/copied-kit exact80 provider-case expectations are stale after eight additions. Preserve historical1dcf4144/A18029 result, but explicitly qualify or migrate current replay/imported/generated registration expectations; current correction is only planned.","file":"qa/briefs/E-1534-stage-3.md","line":404}]
finding_counts: {"high":0,"medium":2,"low":0}

A-19609 completes clean e729fc55a/treeab1fbb41 review. Standards2medium; Spec no additional product finding. Bounded stable ledger observation preserves exact backing/revocation and reserved-capacity policy; original429/422 assertions unchanged apart diagnostics. C1 unverified pending lifecycle correction and exact-head evidence; C2 load20/20macOS>=8 still pending Coordinator authorization, not inferred from local green. A-19608 preserves transcribed producer/candidate/tracker-only-merge limits, cost-boundary facts and static consumer dispositions; original publication control missing, not upgraded. Hold released for one consolidated correction/fresh source request before verification. No Reviewer runtime/native/provider/cleanup experiment.

### rev-35 · 2026-11-15T10:52:56.865Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1862-source-2
commit: f02c4c772cbf048c0e8fd6ed01bd13430d1180d0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19616 source clear at clean f02c4c772/tree459e5708. Both A-19609 findings resolved: issue fence/shared close/attempt-all tail, all-context admission drainage before API/root and SQLite disposal, actual provider/prepare/volume held-work contracts and retained-root API failure path. Historical exact80 replay qualification preserves A18029 while requiring current imported/generated identities. Product bounded-stable admission source unchanged. C1/C2 unverified pending required exact-head load/configured evidence; Coordinator demo/load authorization still controls20/20macOS>=8 and is not released here. Then mode-free verify at unchanged clear head. A19613 complete TAP89/8/18 retained with A19614 correction: outer exit0 only, individual child native status/signal unknown; no provenance reruns. Earlier capture/publication/static-search limits retained. Hold released; no Reviewer runtime/census/provider/cleanup/browser.

### rev-35 · 2026-11-15T11:21:12.444Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1862-evidence-1
commit: f02c4c772cbf048c0e8fd6ed01bd13430d1180d0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Partial configured evidence clear A-19620; C1 verified, NOT final readiness. Exact f02c4c772 unchanged, A19619 actual6358ordinarytest/700file passes, separate240loadtest/file positives, no negatives. All selected220T1/425T2/55Web manifest roots positive. Eight product controls plus3real-factory teardown controls each ordinary+5 matching load/file receipts; typed churn/no-send/cap/backing and positive cost diagnostics established. Original429/422 Linux base passes do not satisfy C2 macOS20/20load>=8. Coordinator6e1667d6 authorized parallel droplet verify but explicitly holds local load until demo-done; C2 remains unverified. Hold released awaiting authorized same-head C2 receipts, no source change/configured rerun/local stress authorized by this verdict. Linux/Node24.21/Nvim.12.5/Headless1248CfT156 provenance noncached; report-only gates, remaining265T3/17T4 and A19608/A19614 capture/publication limits retained. No Reviewer runtime.

Criteria: C1 verified.

### impl-1862 · 2026-11-15T11:36:46.555Z

C2 complete on unchanged reviewed f02c4c772 (macOS arm64 Node24.21 local): 429 20/20 at one-minute load 8.6411–9.6304; 422 20/20 at 9.6304–11.7109. All 40 direct child native status=0, signal=null, error=null, exact single-case TAP pass/no failures; CPU progress and 10 zero-exit worker receipts retained. Exclusive production suite broker leases released after native closures. Original 2s test watchdog and assertions unchanged; test-isolation=none disclosed. Evidence A-19627. Same-head configured Linux receipt A-19619; final Reviewer settlement requested.

### rev-35 · 2026-11-15T11:42:57.057Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1862-final-1
commit: f02c4c772cbf048c0e8fd6ed01bd13430d1180d0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear A-19633; A-19632 preserves full982manifest dispositions/11ordinary+55load joins. C1 retained from A19620/A19619 actual6358ordinarytest/700files, separate240load positives; all selectedT1/T2/Web pass, no negatives. C2 independently verified all40A19627TAP/receipts: each429/42220/20, exact1pass/no fail/cancel/skip/todo, distinct sequentialPIDs,status0/signalnull/errornull/no timeout, tenCPUworkers progress each case/exit0. Sampled load4298.6411..9.6304,4229.6304..11.7109;>=8<20. Original2s watchdog/assertions retained; fresh-process isolation=none disclosed, no metadata overrides. Coordinator7eeb2e15 demo-done authorization and6e1667d6 prior parallel verify read directly; source unchanged. A19630 derived metadata changes exactlyone descriptive line after serialized-redaction damage; original untouched, other data parse independently, original completion/scan/exemption limits retained. A19614 prior child-unknown facts not upgraded. Linux/Node24.21/Headless1248CfT156 noncached configured provenance correct; report-only gates, remaining265T3/17T4/per-itemQA-none separate. C1/C2 verified; hold released. No Reviewer runtime/load/provider/browser/cleanup/source/merge action.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-15T13:57:06.694Z

Merged 55a1a28928e95b3c841e8d8151018be1d6098af6 onto dev.
