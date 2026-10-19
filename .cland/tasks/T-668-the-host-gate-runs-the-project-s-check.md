---
id: T-668
kind: task
title: The host gate runs the project's check, and only cland's own suite is sharded
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-667
topic: topic-653
branch: t/T-668-the-host-gate-runs-the-project-s-check
created: 2026-10-16T16:35:25.248Z
updated: 2026-10-19T21:57:23.536Z
closed: 2026-10-19T21:57:23.536Z
---

## Summary

Before a droplet is made, the host gate runs the recorded `check` and names it in its result, and it is skipped with a line when `check` is unset (E-614 C1, the host gate). Stage, epic and release closes are sharded only for a candidate carrying cland's own runner. Another project's close runs its `test` once.

## What to build

- **The host gate** (`#hostGate` in `hub/src/hub/suites.ts`). It runs the job's recorded `check` (ticket T-666) and logs `Host gate: <line>`. On failure it reports `host check failed (exit <n>); no droplet created`, replacing `host typecheck failed`. An unset `check` logs `Host gate: check not set` and goes on to acquisition. Update the tests and docs that match the old text, and grep `hub/`, `nvim/` and `docs/` for `host typecheck failed`.
- **Shards** (`#planShards`). A candidate without cland's runner (ticket T-667's predicate) is never sharded. Its close run records `sharding skipped: project commands are not sharded` through the existing `onShardingSkipped` path and the `verification-sharding-skipped` log event, then runs once on one droplet. The stage-cover rules (`stageCovers`) treat that skip as they treat any recorded skip today.

**Keeping cland's own suite intact.** This repository's `check` is `npm run typecheck`, so its host gate runs the same command. Only the failure message's word changes, from "typecheck" to "check". Its candidates carry the runner, so sharding, shard reservation, coverage merging and stage covers stay as they are. The stage close after this ticket uses the usual sharded droplet cover, which proves that.

## Acceptance criteria

- [x] C1. A fake-droplet run whose `check` fails on the host reports `host check failed (exit 2); no droplet created`, and the fake API saw no create (`executor-run.test.ts`, the host-failure case updated).
  - done: impl-668 · 2026-10-19T21:52:26.931Z
  - verified: rev-31 [reviewer] · run rev-20261019-668-final · 2026-10-19T21:52:52.029Z · commit 6bf6b0190062d4b688860f83cf8ca0f96effc464
- [x] C2. A fake-droplet run with `check` unset logs `Host gate: check not set` and runs on the machine.
  - done: impl-668 · 2026-10-19T21:52:27.420Z
  - verified: rev-31 [reviewer] · run rev-20261019-668-final · 2026-10-19T21:52:52.029Z · commit 6bf6b0190062d4b688860f83cf8ca0f96effc464
- [x] C3. An integrated `verify all --occasion stage` of a project without cland's runner on the fake droplet skips sharding with `project commands are not sharded` and runs on one machine (`suite-stage-cover.test.ts` or `suite-close.test.ts`).
  - done: impl-668 · 2026-10-19T21:52:28.032Z
  - verified: rev-31 [reviewer] · run rev-20261019-668-final · 2026-10-19T21:52:52.029Z · commit 6bf6b0190062d4b688860f83cf8ca0f96effc464
- [x] C4. A cland-shaped close run is still split into its shards, and the existing `suite-close.test.ts` and `suite-stage-cover.test.ts` cases pass unchanged.
  - done: impl-668 · 2026-10-19T21:52:28.533Z
  - verified: rev-31 [reviewer] · run rev-20261019-668-final · 2026-10-19T21:52:52.029Z · commit 6bf6b0190062d4b688860f83cf8ca0f96effc464

## Comments

### impl-668 · 2026-10-19T21:36:26.429Z

Implemented tight host gate/sharding diff and docs. C1 red→green verified (exact exit-2 failure, zero machines); T2 integrated other-stack stage close verifies unset-check log, sharding warning and one machine. Typecheck/test:lint green. Serial suite-*, verify-* and merge-queue file sweep underway before source review.

### impl-668 · 2026-10-19T21:41:28.006Z

Head 6bf6b0190062d4b688860f83cf8ca0f96effc464 pushed to origin after fetching/merging origin/dev. All 59 required suite-*/verify-*/merge-queue files plus executor-run passed one at a time (373.769s total). Typecheck, test:lint and diff whitespace check passed. C1 exact failure and no API create; C2/C3 new T2 scripted integrated other-stack stage close; C4 unchanged native suite-close (19.895s), suite-stage-cover (18.128s). QA policy scope none / after-stage, no item QA required. Requesting source review before mode-free verification.

### rev-31 · 2026-10-19T21:43:24.858Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-668-source
commit: 6bf6b0190062d4b688860f83cf8ca0f96effc464
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6738: Standards and Spec clear. Recorded check/unset logging precedes either injected/native host path; both exit failures use exact host-check wording and no stale text remains at pinned head. Existing clandRunner gates sharding through unchanged durable skip/warn/event/cover path, without touching cland shard reservation/delivery/coverage. New scripted integrated other-stack T2 case proves unset log, exact warning, one machine/report and cleanup. Native C1 assertion now checks exact exit 2 and zero provider create. Independent A-6734 raw audit confirms 60 serial files, 440/440 tests/subtests, no fail/cancel/skip; new T2 .236890875s, native host group 8.982803458s. Required native suite-close/stage-cover unchanged and locally green. No tiers/baseline/allowance edits. C1–C4 remain unverified pending fresh same-head configured mode-free gate plus retained local native receipts; new T2 identity needs scheduled 5/5 and zero owned resource/budget violations. Linux T3 remains periodic/integrated landing/stage evidence; no full task-head run requested.

### impl-668 · 2026-10-19T21:52:07.011Z

Same-head mode-free droplet run b4ba98e3-a18f-43ac-9b07-ef487aefbab1 passed: 1901/1901, no skips/cancel/TODO; A-6745. New T2 case load gate 5/5 at log line 47575; ordinary case 0.178s and repetitions 0.345–0.417s, below 2s budget. Linux x64 / Node v24.21.0 / Neovim v0.12.5; lifetime 360s, cost $0.0250. Head remains 6bf6b019; waiting for Reviewer final evidence verdict.

### rev-31 · 2026-10-19T21:52:52.029Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-668-final
commit: 6bf6b0190062d4b688860f83cf8ca0f96effc464
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6747 independently audits complete same-head configured mode-free b4ba98e3/A-6745: 1901/1901 ordinary passes, new T2 case ordinary .177670316s plus five distinct passing repeats max .416507781s, zero tier mismatch/load failure/owned budget issue. C2/C3 exact unset-check/skip-warning/one-machine/stage-result/report/cleanup assertions pass. C1 combines exact native host failure source assertion with retained A-6734 executor-run local pass (exit2, no provider create); C4 combines unchanged suite-close/stage-cover source and retained native local 3/3 and 1/1 passes plus fresh component shard controls. C1/C4 native T3 files are absent from task gate; no Linux native execution claimed here. A-6738 full source review unchanged; no allowance edit. Claimant C1–C4 done confirmed, all four final verified. Linux T3 remains periodic/integrated landing/stage evidence. Known external report-only file notices retained without duplicate aside.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T21:57:23.536Z

Merged 83e155e8cdf295f5766545fde9ee14a7b33307f5 onto dev.
