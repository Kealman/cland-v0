---
id: T-943
kind: task
title: "hub/README.md: budget modes, T1-only batches with periodic and release T3, and CLAND_OPEN_SESSION"
state: closed
status: done
size: XS
criterion_seq: 4
labels:
  - ready-for-agent
  - qa-found
assignee: null
parent: E-617
blocked_by: []
topic: topic-704
branch: t/T-943-hub-readme-md-budget-modes-t1-only
created: 2026-10-20T07:21:47.329Z
updated: 2026-10-20T07:32:32.945Z
closed: 2026-10-20T07:32:32.945Z
---

## Summary

E-617's DoD demo (qa-676, run qa-2026-10-20-1, at release candidate 3, 543b2533; evidence .cland/qa/E-617/qa-2026-10-20-1/D3-findings.txt and D3-matrix.txt) found hub/README.md stale against v0.1.4 as built. docs/agents/tests.md is already correct.
- ~2841–2851: says a run fails when a new test exceeds 5 s or a new file 60 s, with no word of `budget.mode` (report or enforce). This repository runs report mode (D73, hub/test/durations.json).
- ~2716–2724: says batches run T1/T3, with no word that `[merge] batch_tiers` defaults to `["T1","T3"]` and this repository sets `["T1"]` (D67). It also omits `[verification] dev_t3_every` and the release gate's T3.
- `CLAND_OPEN_SESSION` (the session the workbench opens in its centre, as the first page describes) is not named in hub/README.md.

## Acceptance criteria

- [x] C1. hub/README.md describes `budget.mode` (report and enforce, what each does to a run) and that this repository runs report mode under D73, consistent with docs/agents/tests.md.
  - done: impl-943 · 2026-10-20T07:23:55.280Z
  - verified: rev-31 [reviewer] · run rev-20261020-943-source · 2026-10-20T07:24:44.043Z · commit ad181c313391e580e86e03a5b586ee0fb5ef6074
  - verified: rev-31 [reviewer] · run rev-20261020-943-final · 2026-10-20T07:32:22.636Z · commit ad181c313391e580e86e03a5b586ee0fb5ef6074
- [x] C2. The merge-queue section states `batch_tiers` with its default and this repository's `["T1"]` (D67), `dev_t3_every` with its default and this repository's value, and that release runs cover T3, consistent with docs/agents/tests.md.
  - done: impl-943 · 2026-10-20T07:23:55.955Z
  - verified: rev-31 [reviewer] · run rev-20261020-943-source · 2026-10-20T07:24:44.043Z · commit ad181c313391e580e86e03a5b586ee0fb5ef6074
  - verified: rev-31 [reviewer] · run rev-20261020-943-final · 2026-10-20T07:32:22.636Z · commit ad181c313391e580e86e03a5b586ee0fb5ef6074
- [x] C3. hub/README.md names `CLAND_OPEN_SESSION` where the workbench and setup are described, matching nvim/README.md and the code.
  - done: impl-943 · 2026-10-20T07:23:56.671Z
  - verified: rev-31 [reviewer] · run rev-20261020-943-source · 2026-10-20T07:24:44.043Z · commit ad181c313391e580e86e03a5b586ee0fb5ef6074
  - verified: rev-31 [reviewer] · run rev-20261020-943-final · 2026-10-20T07:32:22.636Z · commit ad181c313391e580e86e03a5b586ee0fb5ef6074
- [x] C4. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-943 · 2026-10-20T07:32:01.166Z
  - verified: rev-31 [reviewer] · run rev-20261020-943-final · 2026-10-20T07:32:22.636Z · commit ad181c313391e580e86e03a5b586ee0fb5ef6074

## Comments

### impl-943 · 2026-10-20T07:23:19.517Z

C1–C3 implemented in hub/README.md only: budget report/enforce semantics and D73, batch tier defaults and D67 override with periodic/release T3, and CLAND_OPEN_SESSION setup/workbench behavior. QA policy scope is none; requesting source review before mode-free verification.

### rev-31 · 2026-10-20T07:24:44.043Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-943-source
commit: ad181c313391e580e86e03a5b586ee0fb5ef6074
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7197: README-only Standards/Spec review clear. C1 budget modes/D73/new-identity gate agree with tests guide/manifest. C2 default/current batch tiers and periodic cadence plus release-T3 coverage/refusal agree with config and gate. C3 opening-session/setup/attach/no-Aide behavior agrees with handover and nvim source. C1–C3 verified; C4 awaits exact-head mode-free green. No new test identities.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-943 · 2026-10-20T07:32:07.700Z

C4 complete: mode-free verify f4073035-4dc8-4490-a561-a8d09f2d3acb passed at reviewed ad181c313391e580e86e03a5b586ee0fb5ef6074, all 1944 tests green. Receipt A-7198; Linux x64 droplet c-8 lon1, lifetime 396 s, cost $0.0275. Awaiting Reviewer final same-head verdict and hub ready event.

### rev-31 · 2026-10-20T07:32:22.636Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-943-final
commit: ad181c313391e580e86e03a5b586ee0fb5ef6074
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7199: exact-head A-7198/f4073035 audited: 1944 ordinary passes, host/T1/fallback T2 green and no resource/duration failures. README-only no new identities. C4 verified; C1–C3 retained from A-7197 source. All claimant done marks present. Inherited report-only baseline/ratchet diagnostics disclosed; no stage/release T3 coverage claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-20T07:32:32.945Z

Merged 6dc2ff7205e635959c2d421b99d5d187d352be35 onto dev.
